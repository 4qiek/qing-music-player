package com.qing.player.player

import android.content.Context
import android.media.audiofx.Equalizer
import android.util.Log
import com.qing.player.data.SettingsStore
import kotlin.math.roundToInt

/**
 * 系统级均衡器封装（android.media.audiofx.Equalizer）。
 *
 * 两点必须说明清楚：
 * 1. 这是**安卓系统级的 EQ**，作用于本 app 的 audio session，
 *    与厂商自家的私有音效引擎（各类音质增强 DSP）完全无关——
 *    那些效果只有厂商自带播放器能通过私有接口调用，第三方应用拿不到。
 * 2. 第三方应用的音频输出受系统音频通路限制（采样率可能被重采样），
 *    这里不会试图指定采样率，全部交给 ExoPlayer 与音频通路的默认值。
 *
 * 设备实际的频段数不一定是 10（常见为 5 段），
 * 因此 UI 的十段滑杆会按比例映射到设备真实频段上。
 */
class EqualizerManager(private val settings: SettingsStore) {

    @Volatile
    private var equalizer: Equalizer? = null

    private var sessionId: Int = 0
    private var deviceBandCount: Int = 0
    private var minLevel: Int = -1500
    private var maxLevel: Int = 1500
    private var pendingLevels: IntArray? = null

    /** UI 十段增益（毫贝尔） */
    private var levels: IntArray = settings.eqLevels

    /**
     * 绑定到播放器的 audioSessionId。
     * ExoPlayer 的 audioSessionId 在播放开始后才有效并可能变化，故由监听器回调触发。
     */
    fun attach(audioSessionId: Int) {
        if (audioSessionId <= 0) return
        if (sessionId == audioSessionId && equalizer != null) return

        release()
        sessionId = audioSessionId
        try {
            val eq = Equalizer(/* priority = */ 0, audioSessionId)
            // bandLevelRange 是 short[2] = {min, max}，单位毫贝尔；numberOfBands 是 short
            val range = eq.bandLevelRange
            minLevel = range[0].toInt()
            maxLevel = range[1].toInt()
            deviceBandCount = eq.numberOfBands.toInt()
            eq.enabled = settings.eqEnabled
            equalizer = eq
            Log.d(TAG, "EQ 已绑定 session=$audioSessionId，设备频段=$deviceBandCount")
            // 绑定后立刻应用一次持久化下来的设置
            applyLevels(levels)
        } catch (t: Throwable) {
            Log.w(TAG, "绑定系统 EQ 失败（该设备可能不支持）", t)
            equalizer = null
        }
    }

    /** 开关 EQ；关闭时增益全 0（等效直通） */
    fun setEnabled(enabled: Boolean) {
        settings.eqEnabled = enabled
        val eq = equalizer ?: return
        runCatching { eq.enabled = enabled }
        if (enabled) applyLevels(levels)
    }

    /** 设置十段增益（毫贝尔）并落盘 */
    fun setLevels(newLevels: IntArray) {
        levels = newLevels
        settings.eqLevels = newLevels
        applyLevels(newLevels)
    }

    /** 套用预设：返回实际写入的十段增益 */
    fun applyPreset(index: Int): IntArray {
        val preset = settings.applyPreset(index, minLevel, maxLevel)
        levels = preset
        applyLevels(preset)
        return preset
    }

    private fun applyLevels(src: IntArray) {
        val eq = equalizer ?: run {
            // 还没拿到 audioSessionId，先缓存，等 attach 后再应用
            pendingLevels = src
            return
        }
        if (deviceBandCount <= 0) return
        try {
            for (band in 0 until deviceBandCount) {
                // 把 UI 的十段映射到设备真实频段
                val uiIndex = if (deviceBandCount == 1) 0 else {
                    (band * (UI_BANDS - 1).toFloat() / (deviceBandCount - 1)).roundToInt()
                }
                val level = src.getOrNull(uiIndex) ?: 0
                eq.setBandLevel(band.toShort(), level.coerceIn(minLevel, maxLevel).toShort())
            }
        } catch (t: Throwable) {
            Log.w(TAG, "写入 EQ 增益失败", t)
        }
    }

    fun release() {
        runCatching { equalizer?.release() }
        equalizer = null
        deviceBandCount = 0
    }

    companion object {
        private const val TAG = "EqualizerManager"
        const val UI_BANDS = 10
    }
}
