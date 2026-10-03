package com.qing.player.player

import android.app.Application
import android.content.ComponentName
import android.content.ContentUris
import android.provider.MediaStore
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.qing.player.data.AlbumGroup
import com.qing.player.data.ArtistGroup
import com.qing.player.data.FolderGroup
import com.qing.player.data.MusicRepository
import com.qing.player.data.SettingsStore
import com.qing.player.data.Song
import com.qing.player.data.db.AppDatabase
import com.qing.player.data.db.FavoriteEntity
import com.qing.player.data.db.PlaylistEntity
import com.qing.player.data.db.PlaylistSongEntity
import com.qing.player.util.LrcParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * UI 与播放服务之间的桥梁。
 *
 * 通过 MediaController 连接 PlaybackService 的 MediaSession，
 * 所有播放命令都走 MediaController（这样通知栏、实体按键、UI 三处状态天然一致）。
 */
class PlayerViewModel(app: Application) : AndroidViewModel(app) {

    private val repo = MusicRepository.getInstance(app)
    private val db = AppDatabase.getInstance(app)
    private val settings = SettingsStore.getInstance(app)

    // ---------------- 曲库 ----------------
    private val _songs = MutableStateFlow<List<Song>>(emptyList())
    val songs: StateFlow<List<Song>> = _songs.asStateFlow()

    val songsById: StateFlow<Map<Long, Song>> = _songs
        .map { it.associateBy { s -> s.id } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyMap())

    val albums: StateFlow<List<AlbumGroup>> = _songs
        .map { repo.groupAlbums(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val artists: StateFlow<List<ArtistGroup>> = _songs
        .map { repo.groupArtists(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val folders: StateFlow<List<FolderGroup>> = _songs
        .map { repo.groupFolders(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val favorites: StateFlow<Set<Long>> = db.favoriteDao().observeAll()
        .map { it.toSet() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptySet())

    val playlists: StateFlow<List<PlaylistEntity>> = db.playlistDao().observePlaylists()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    // ---------------- 播放状态 ----------------
    private val _currentSong = MutableStateFlow<Song?>(null)
    val currentSong: StateFlow<Song?> = _currentSong.asStateFlow()

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _positionMs = MutableStateFlow(0L)
    val positionMs: StateFlow<Long> = _positionMs.asStateFlow()

    private val _durationMs = MutableStateFlow(0L)
    val durationMs: StateFlow<Long> = _durationMs.asStateFlow()

    private val _shuffle = MutableStateFlow(false)
    val shuffle: StateFlow<Boolean> = _shuffle.asStateFlow()

    /** Player.REPEAT_MODE_OFF / ALL / ONE */
    private val _repeatMode = MutableStateFlow(Player.REPEAT_MODE_ALL)
    val repeatMode: StateFlow<Int> = _repeatMode.asStateFlow()

    private val _lyrics = MutableStateFlow(LrcParser.Lyric(emptyList()))
    val lyrics: StateFlow<LrcParser.Lyric> = _lyrics.asStateFlow()

    private val _libraryReady = MutableStateFlow(false)
    val libraryReady: StateFlow<Boolean> = _libraryReady.asStateFlow()

    /** 睡眠定时剩余毫秒，0 表示未设置 */
    private val _sleepRemaining = MutableStateFlow(0L)
    val sleepRemaining: StateFlow<Long> = _sleepRemaining.asStateFlow()

    // ---------------- 设置（主题 / EQ）----------------
    private val _themeMode = MutableStateFlow(settings.themeMode)
    val themeMode: StateFlow<String> = _themeMode.asStateFlow()

    private val _eqEnabled = MutableStateFlow(settings.eqEnabled)
    val eqEnabled: StateFlow<Boolean> = _eqEnabled.asStateFlow()

    private val _eqPresetIndex = MutableStateFlow(settings.eqPresetIndex)
    val eqPresetIndex: StateFlow<Int> = _eqPresetIndex.asStateFlow()

    private val _eqLevels = MutableStateFlow(settings.eqLevels)
    val eqLevels: StateFlow<IntArray> = _eqLevels.asStateFlow()

    // ---------------- MediaController ----------------
    private var controller: MediaController? = null
    private val sessionToken =
        SessionToken(app, ComponentName(app, PlaybackService::class.java))
    private val controllerFuture =
        MediaController.Builder(app, sessionToken).buildAsync()

    private var lyricsJob: Job? = null

    private val controllerListener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            _isPlaying.value = isPlaying
        }

        override fun onMediaItemTransition(item: MediaItem?, reason: Int) {
            syncCurrentSong(item?.mediaId?.toLongOrNull())
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
            _durationMs.value = controller?.duration?.coerceAtLeast(0) ?: 0L
        }

        override fun onShuffleModeEnabledChanged(shuffleModeEnabled: Boolean) {
            _shuffle.value = shuffleModeEnabled
        }

        override fun onRepeatModeChanged(repeatMode: Int) {
            _repeatMode.value = repeatMode
        }
    }

    init {
        controllerFuture.addListener(
            {
                runCatching {
                    val c = controllerFuture.get()
                    controller = c
                    c.addListener(controllerListener)
                    _shuffle.value = c.shuffleModeEnabled
                    _repeatMode.value = c.repeatMode
                    _isPlaying.value = c.isPlaying
                    syncCurrentSong(c.currentMediaItem?.mediaId?.toLongOrNull())
                }
            },
            ContextCompat.getMainExecutor(app)
        )

        // 播放进度轮询：MediaSession 不推送连续进度，UI 需要 0.5s 级刷新（歌词与进度条）
        viewModelScope.launch {
            while (true) {
                delay(500)
                controller?.let { c ->
                    _positionMs.value = c.currentPosition.coerceAtLeast(0)
                    _durationMs.value = c.duration.coerceAtLeast(0)
                }
                val svc = PlaybackService.instance
                _sleepRemaining.value = svc?.sleepRemainingMs() ?: 0L
            }
        }

        // 切歌时异步加载歌词
        viewModelScope.launch {
            _currentSong.collect { song ->
                lyricsJob?.cancel()
                _lyrics.value = LrcParser.Lyric(emptyList())
                if (song == null) return@collect
                lyricsJob = launch {
                    val lyric = withContext(Dispatchers.IO) { repo.loadLyrics(song) }
                    _lyrics.value = lyric
                }
            }
        }
    }

    // ---------------- 曲库扫描 ----------------

    fun scanLibrary() {
        viewModelScope.launch(Dispatchers.IO) {
            val list = repo.querySongs()
            withContext(Dispatchers.Main) {
                _songs.value = list
                _libraryReady.value = true
            }
        }
    }

    /** 断点续播：恢复上次的队列与位置，但不自动播放 */
    fun restoreLastPlayback() {
        val lastId = settings.lastSongId
        if (lastId < 0) return
        // 不能读 songsById.value：它是 WhileSubscribed 的 stateIn，
        // 此刻无订阅者，值仍为空 map，会让断点续播静默失效。
        val map = _songs.value.associateBy { it.id }
        if (map.isEmpty()) return
        val queue = settings.lastQueue.mapNotNull { map[it] }
        val target = if (queue.isNotEmpty()) queue else listOfNotNull(map[lastId])
        if (target.isEmpty()) return
        val index = target.indexOfFirst { it.id == lastId }.coerceAtLeast(0)
        playQueue(target, index, settings.lastPositionMs, play = false)
        _positionMs.value = settings.lastPositionMs
    }

    // ---------------- 播放控制 ----------------

    fun playQueue(list: List<Song>, index: Int, startPositionMs: Long = 0L, play: Boolean = true) {
        if (list.isEmpty()) return
        val c = controller ?: return
        val startIndex = index.coerceIn(0, list.lastIndex)
        c.setMediaItems(list.map { it.toMediaItem() }, startIndex, startPositionMs)
        c.prepare()
        if (play) c.play()
        syncCurrentSong(list[startIndex].id)
    }

    fun playSong(song: Song) = playQueue(_songs.value.ifEmpty { listOf(song) }, _songs.value.indexOf(song), 0L)

    fun togglePlayPause() {
        val c = controller ?: return
        if (c.isPlaying) c.pause() else c.play()
    }

    fun next() = controller?.seekToNextMediaItem()
    fun previous() = controller?.seekToPreviousMediaItem()

    fun seekTo(positionMs: Long) {
        controller?.seekTo(positionMs)
        _positionMs.value = positionMs
    }

    fun toggleShuffle() {
        val c = controller ?: return
        c.shuffleModeEnabled = !c.shuffleModeEnabled
        _shuffle.value = c.shuffleModeEnabled
    }

    /** 顺序 → 列表循环 → 单曲循环 */
    fun cycleRepeatMode() {
        val c = controller ?: return
        val next = when (c.repeatMode) {
            Player.REPEAT_MODE_OFF -> Player.REPEAT_MODE_ALL
            Player.REPEAT_MODE_ALL -> Player.REPEAT_MODE_ONE
            else -> Player.REPEAT_MODE_OFF
        }
        c.repeatMode = next
        _repeatMode.value = next
    }

    // ---------------- 收藏 / 歌单 ----------------

    fun toggleFavorite(song: Song) {
        viewModelScope.launch(Dispatchers.IO) {
            if (favorites.value.contains(song.id)) {
                db.favoriteDao().delete(song.id)
            } else {
                db.favoriteDao().insert(FavoriteEntity(song.id, System.currentTimeMillis()))
            }
        }
    }

    fun createPlaylist(name: String, songs: List<Song> = emptyList(), onDone: (Long) -> Unit = {}) {
        viewModelScope.launch(Dispatchers.IO) {
            val id = db.playlistDao().insertPlaylist(
                PlaylistEntity(name = name, createdAt = System.currentTimeMillis())
            )
            if (songs.isNotEmpty()) addSongsToPlaylist(id, songs)
            withContext(Dispatchers.Main) { onDone(id) }
        }
    }

    fun addSongsToPlaylist(playlistId: Long, songs: List<Song>) {
        viewModelScope.launch(Dispatchers.IO) {
            var order = db.playlistDao().maxOrderIndex(playlistId)
            // 去重：已存在的曲目跳过，避免主键冲突
            val existing = db.playlistDao().getSongIdsOnce(playlistId).toSet()
            val entities = songs.distinctBy { it.id }
                .filter { it.id !in existing }
                .map { PlaylistSongEntity(playlistId, it.id, ++order) }
            if (entities.isNotEmpty()) db.playlistDao().insertSongs(entities)
        }
    }

    fun deletePlaylist(playlistId: Long) {
        viewModelScope.launch(Dispatchers.IO) {
            db.playlistDao().deletePlaylistWithSongs(playlistId)
        }
    }

    fun removeSongFromPlaylist(playlistId: Long, songId: Long) {
        viewModelScope.launch(Dispatchers.IO) {
            db.playlistDao().deleteSong(playlistId, songId)
        }
    }

    /** 歌单内的曲目 id（有序），供 UI 关联曲库还原 Song */
    fun observePlaylistSongIds(playlistId: Long): Flow<List<Long>> =
        db.playlistDao().observeSongIds(playlistId)

    // ---------------- 睡眠定时 / EQ / 主题 ----------------

    fun setSleepTimer(minutes: Int) {
        PlaybackService.instance?.setSleepTimer(minutes)
        _sleepRemaining.value = if (minutes <= 0) 0L else minutes * 60_000L
    }

    fun setEqEnabled(enabled: Boolean) {
        settings.eqEnabled = enabled
        _eqEnabled.value = enabled
        PlaybackService.instance?.setEqualizerEnabled(enabled)
    }

    fun setEqBand(index: Int, millibel: Int) {
        val levels = _eqLevels.value.copyOf()
        if (index !in levels.indices) return
        levels[index] = millibel
        _eqLevels.value = levels
        // -1 表示「自定义」：预设 chip 全部取消选中
        _eqPresetIndex.value = -1
        settings.eqPresetIndex = -1
        settings.eqLevels = levels
        PlaybackService.instance?.applyEqualizerLevels(levels)
    }

    fun applyEqPreset(index: Int) {
        val levels = settings.applyPreset(index)
        _eqPresetIndex.value = index
        _eqLevels.value = levels
        PlaybackService.instance?.applyEqualizerPreset(index)
    }

    fun setThemeMode(mode: String) {
        settings.themeMode = mode
        _themeMode.value = mode
    }

    // ---------------- 内部 ----------------

    private fun syncCurrentSong(id: Long?) {
        if (id == null) {
            _currentSong.value = null
            return
        }
        _currentSong.value = _songs.value.firstOrNull { it.id == id }
        _durationMs.value = controller?.duration?.coerceAtLeast(0) ?: 0L
    }

    private fun Song.toMediaItem(): MediaItem {
        // 用 content://media/external/audio/media/<id> 作为播放源，
        // 这样即便文件在 SD 卡上也能通过 ContentResolver 正常读取。
        val uri = ContentUris.withAppendedId(
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
            id
        )
        return MediaItem.Builder()
            .setMediaId(id.toString())
            .setUri(uri)
            .setMediaMetadata(
                MediaMetadata.Builder()
                    .setTitle(title)
                    .setArtist(artist)
                    .setAlbumTitle(album)
                    .setArtworkUri(albumArtUri)
                    .build()
            )
            .build()
    }

    override fun onCleared() {
        controller?.removeListener(controllerListener)
        MediaController.releaseFuture(controllerFuture)
        controller = null
        super.onCleared()
    }
}
