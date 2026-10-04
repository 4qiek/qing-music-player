package com.qing.player.player

import android.app.PendingIntent
import android.app.TaskStackBuilder
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.KeyEvent
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.qing.player.MainActivity
import com.qing.player.data.SettingsStore
import com.qing.player.data.db.AppDatabase
import com.qing.player.data.db.HistoryEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * 后台播放服务：MediaSessionService + ExoPlayer。
 *
 * 职责：
 * - 前台服务 + 通知栏常驻（封面 / 标题 / 艺术家 + 播放暂停上一曲下一曲）
 * - 接住设备物理播放键与耳机线控（KEYCODE_MEDIA_*）
 * - 音频焦点交由 ExoPlayer 托管（handleAudioFocus = true）
 * - 断点续播：退出时保存最后一首与进度
 * - 系统级 EQ 绑定与睡眠定时
 *
 * 兼容性注意：
 * - 不引入任何 Google Play 服务依赖，离线环境也能正常工作；
 * - 第三方应用输出受系统限制，不强行指定采样率，全部交给 ExoPlayer 默认行为。
 */
class PlaybackService : MediaSessionService() {

    private lateinit var player: ExoPlayer
    private var mediaSession: MediaSession? = null
    private lateinit var settings: SettingsStore
    private lateinit var equalizer: EqualizerManager

    private val mainHandler = Handler(Looper.getMainLooper())
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    /** 睡眠定时到点后暂停播放 */
    private var sleepRunnable: Runnable? = null
    private var sleepEndAt: Long = 0L

    private val playerListener = object : Player.Listener {

        /** audioSessionId 就绪后才能绑 EQ */
        override fun onAudioSessionIdChanged(audioSessionId: Int) {
            equalizer.attach(audioSessionId)
        }

        override fun onMediaItemTransition(mediaItem: androidx.media3.common.MediaItem?, reason: Int) {
            savePlaybackState()
            recordHistory(mediaItem?.mediaId?.toLongOrNull())
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            if (!isPlaying) savePlaybackState()
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
            if (playbackState == Player.STATE_ENDED) savePlaybackState()
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        settings = SettingsStore.getInstance(this)
        equalizer = EqualizerManager(settings)

        // 音频属性：音乐用途；handleAudioFocus = true 让 ExoPlayer 自动处理焦点申请/放弃
        val audioAttributes = AudioAttributes.Builder()
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .setUsage(C.USAGE_MEDIA)
            .build()

        // 缓冲区策略（针对本地文件 + 存储卡的便携播放器场景调过）：
        // ExoPlayer 默认的 maxBuffer 是按网络流媒体定的（50 秒），本地无损文件照这个
        // 值读会预读一大块进内存——存储型设备内存有限，容易触发 LMK 回收别的进程。
        // 这里收窄到 25 秒上限，同时把起播门槛压到 1.5 秒，点歌出声更快；
        // prioritizeTimeOverSizeThresholds 让缓冲以时间为准，慢速 microSD 上更稳。
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                /* minBufferMs = */ 10_000,
                /* maxBufferMs = */ 25_000,
                /* bufferForPlaybackMs = */ 1_500,
                /* bufferForPlaybackAfterRebufferMs = */ 3_000
            )
            .setPrioritizeTimeOverSizeThresholds(true)
            .build()

        player = ExoPlayer.Builder(this)
            .setAudioAttributes(audioAttributes, /* handleAudioFocus = */ true)
            .setHandleAudioBecomingNoisy(true)   // 耳机拔出自动暂停
            .setLoadControl(loadControl)
            .build()
            .apply {
                addListener(playerListener)
            }

        mediaSession = MediaSession.Builder(this, player)
            .setSessionActivity(sessionActivityPendingIntent())
            // 媒体按键在这里显式处理（机身物理播放键 / 耳机线控都会走到这里）
            .setCallback(SessionCallback())
            .build()

        // 周期保存播放进度，避免意外杀进程导致断点丢失
        mainHandler.postDelayed(::periodicSave, SAVE_INTERVAL_MS)

        Log.d(TAG, "PlaybackService 已创建")
    }

    /**
     * 媒体按键与所有播放命令的回调。
     *
     * 设备的实体播放键与耳机线控发的是标准 KEYCODE_MEDIA_*，
     * 系统把它们包成 ACTION_MEDIA_BUTTON 交给 MediaSessionService，
     * 最终落到这里；返回 true 表示已消费。
     */
    private inner class SessionCallback : MediaSession.Callback {

        override fun onMediaButtonEvent(
            session: MediaSession,
            controllerInfo: MediaSession.ControllerInfo,
            intent: Intent
        ): Boolean {
            if (intent.action != Intent.ACTION_MEDIA_BUTTON) return false
            val keyEvent = if (Build.VERSION.SDK_INT >= 33) {
                intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT, KeyEvent::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT)
            } ?: return false

            // 只处理按下，避免抬起时重复触发
            if (keyEvent.action != KeyEvent.ACTION_DOWN) return true

            when (keyEvent.keyCode) {
                KeyEvent.KEYCODE_MEDIA_PLAY -> {
                    player.play()
                    return true
                }
                KeyEvent.KEYCODE_MEDIA_PAUSE -> {
                    player.pause()
                    return true
                }
                KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
                KeyEvent.KEYCODE_HEADSETHOOK -> {
                    // 耳机单击：播放/暂停切换
                    if (player.isPlaying) player.pause() else player.play()
                    return true
                }
                KeyEvent.KEYCODE_MEDIA_NEXT -> {
                    player.seekToNextMediaItem()
                    return true
                }
                KeyEvent.KEYCODE_MEDIA_PREVIOUS -> {
                    player.seekToPreviousMediaItem()
                    return true
                }
                KeyEvent.KEYCODE_MEDIA_STOP -> {
                    savePlaybackState()
                    player.stop()
                    return true
                }
                else -> return false
            }
        }
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = mediaSession

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        savePlaybackState()
        // 用户从最近任务划掉且当前未在播放时，直接结束服务，省电
        if (!player.isPlaying) {
            stopSelf()
        }
    }

    override fun onDestroy() {
        savePlaybackState()
        sleepRunnable?.let { mainHandler.removeCallbacks(it) }
        serviceScope.cancel()
        mainHandler.removeCallbacksAndMessages(null)
        mediaSession?.release()
        mediaSession = null
        player.removeListener(playerListener)
        player.release()
        equalizer.release()
        instance = null
        super.onDestroy()
    }

    /** 通知栏点击回到主界面 */
    private fun sessionActivityPendingIntent(): PendingIntent {
        val flags = if (Build.VERSION.SDK_INT >= 23) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val intent = Intent(this, MainActivity::class.java)
        // 用 TaskStackBuilder 保证点击通知后回到已存在的任务栈
        return TaskStackBuilder.create(this)
            .addNextIntentWithParentStack(intent)
            .getPendingIntent(0, flags) ?: PendingIntent.getActivity(this, 0, intent, flags)
    }

    private fun periodicSave() {
        savePlaybackState()
        mainHandler.postDelayed(::periodicSave, SAVE_INTERVAL_MS)
    }

    /** 保存断点：最后一首歌曲 id、进度、整个队列 */
    private fun savePlaybackState() {
        val currentId = player.currentMediaItem?.mediaId?.toLongOrNull() ?: return
        settings.lastSongId = currentId
        settings.lastPositionMs = player.currentPosition.coerceAtLeast(0)
        val ids = ArrayList<Long>(player.mediaItemCount)
        for (i in 0 until player.mediaItemCount) {
            player.getMediaItemAt(i).mediaId.toLongOrNull()?.let { ids += it }
        }
        if (ids.isNotEmpty()) settings.lastQueue = ids
    }

    /** 写入播放历史（Room，IO 线程） */
    private fun recordHistory(songId: Long?) {
        val id = songId ?: return
        if (id <= 0) return
        serviceScope.launch(Dispatchers.IO) {
            runCatching {
                AppDatabase.getInstance(this@PlaybackService)
                    .historyDao()
                    .insert(HistoryEntity(songId = id, playedAt = System.currentTimeMillis()))
            }
        }
    }

    // ------------------------------------------------------------------
    // 供 UI 直接调用的控制项（同一进程，无需自定义 SessionCommand）
    // ------------------------------------------------------------------

    /** 睡眠定时：minutes <= 0 表示取消 */
    fun setSleepTimer(minutes: Int) {
        sleepRunnable?.let { mainHandler.removeCallbacks(it) }
        sleepRunnable = null
        sleepEndAt = 0L
        if (minutes <= 0) return

        val delay = minutes * 60_000L
        sleepEndAt = System.currentTimeMillis() + delay
        val runnable = Runnable {
            player.pause()
            savePlaybackState()
            Log.d(TAG, "睡眠定时到点，已暂停")
        }
        sleepRunnable = runnable
        mainHandler.postDelayed(runnable, delay)
    }

    /** 剩余睡眠时间（毫秒），无定时返回 0 */
    fun sleepRemainingMs(): Long =
        if (sleepEndAt == 0L) 0L else (sleepEndAt - System.currentTimeMillis()).coerceAtLeast(0)

    fun applyEqualizerLevels(levels: IntArray) = equalizer.setLevels(levels)

    fun applyEqualizerPreset(index: Int): IntArray = equalizer.applyPreset(index)

    fun setEqualizerEnabled(enabled: Boolean) = equalizer.setEnabled(enabled)

    fun setBassBoost(enabled: Boolean, strength: Int) = equalizer.setBassBoost(enabled, strength)

    companion object {
        private const val TAG = "PlaybackService"
        private const val SAVE_INTERVAL_MS = 5_000L

        @Volatile
        var instance: PlaybackService? = null
            private set
    }
}
