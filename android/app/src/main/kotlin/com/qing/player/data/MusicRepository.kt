package com.qing.player.data

import android.content.Context
import android.provider.MediaStore
import android.util.Log
import com.qing.player.util.LrcParser
import java.io.File

/**
 * 曲库仓库：MediaStore 扫描 + 四个浏览维度分组（歌曲 / 专辑 / 艺术家 / 文件夹）。
 *
 * 实现说明：
 * - 内置存储与 SD 卡都在 MediaStore 的 EXTERNAL_CONTENT_URI 之下，一次查询即可覆盖，
 *   不需要额外处理 SD 卡路径。
 * - 不做任何云端匹配，全部信息来自本地文件元数据，完全离线可用。
 */
class MusicRepository(private val context: Context) {

    /** 扫描本地音乐：IS_MUSIC != 0 且时长 > 30 秒（过滤提示音、录音碎片） */
    fun querySongs(): List<Song> {
        val songs = ArrayList<Song>()
        val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0 AND ${MediaStore.Audio.Media.DURATION} > ?"
        val selectionArgs = arrayOf(MIN_DURATION_MS.toString())
        val sortOrder = "${MediaStore.Audio.Media.TITLE} COLLATE NOCASE ASC"

        runCatching {
            context.contentResolver.query(
                MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                Song.PROJECTION,
                selection,
                selectionArgs,
                sortOrder
            )?.use { cursor ->
                val idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
                val titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
                val artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
                val albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
                val albumIdCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID)
                val durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
                val dataCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA)
                val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE)
                val dateCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_ADDED)

                while (cursor.moveToNext()) {
                    val path = cursor.getString(dataCol) ?: continue
                    if (path.isBlank()) continue
                    songs += Song(
                        id = cursor.getLong(idCol),
                        title = normalize(cursor.getString(titleCol), UNKNOWN_TITLE),
                        artist = normalize(cursor.getString(artistCol), UNKNOWN_ARTIST),
                        album = normalize(cursor.getString(albumCol), UNKNOWN_ALBUM),
                        albumId = cursor.getLong(albumIdCol),
                        duration = cursor.getLong(durationCol),
                        path = path,
                        size = cursor.getLong(sizeCol),
                        dateAdded = cursor.getLong(dateCol)
                    )
                }
            }
        }.onFailure { e ->
            Log.w(TAG, "扫描曲库失败", e)
        }
        return songs
    }

    /** 专辑维度：按 albumId 聚合，艺术家取该专辑中出现最多的 */
    fun groupAlbums(songs: List<Song>): List<AlbumGroup> =
        songs.groupBy { it.albumId }
            .map { (albumId, list) ->
                val sorted = list.sortedBy { it.title }
                AlbumGroup(
                    albumId = albumId,
                    name = sorted.first().album,
                    artist = sorted.groupingBy { it.artist }.eachCount()
                        .maxByOrNull { it.value }?.key ?: UNKNOWN_ARTIST,
                    songs = sorted
                )
            }
            .sortedBy { it.name.lowercase() }

    /** 艺术家维度 */
    fun groupArtists(songs: List<Song>): List<ArtistGroup> =
        songs.groupBy { it.artist }
            .map { (artist, list) ->
                ArtistGroup(
                    name = artist,
                    songs = list.sortedBy { it.album },
                    albumCount = list.map { it.albumId }.distinct().size
                )
            }
            .sortedBy { it.name.lowercase() }

    /** 文件夹维度：按文件所在目录聚合（很多人习惯按目录整理音乐） */
    fun groupFolders(songs: List<Song>): List<FolderGroup> =
        songs.groupBy { it.folderPath }
            .map { (path, list) ->
                FolderGroup(
                    path = path,
                    name = list.first().folderName,
                    songs = list.sortedBy { it.title }
                )
            }
            .sortedBy { it.path.lowercase() }

    /**
     * 歌词加载：只在文件层面找外挂 .lrc，按候选路径依次尝试，全都没命中就返回空（UI 显示占位）。
     *
     * 两点必须说明：
     * 1. Android 的 MediaMetadataRetriever **没有**歌词常量（不存在 METADATA_KEY_LYRICS），
     *    内嵌在 ID3v2 USLT 帧里的歌词没有公开 API 可读，所以这里不做内嵌歌词。
     * 2. Android 13 的 READ_MEDIA_AUDIO 只授权音频文件，直接读 .lrc 可能被系统拒绝，
     *    因此每个候选路径都做静默降级，读不到就换下一个。
     */
    fun loadLyrics(song: Song): LrcParser.Lyric {
        for (path in lrcCandidates(song)) {
            val lyric = runCatching {
                val file = File(path)
                if (file.exists() && file.canRead()) {
                    LrcParser.parse(file.readText(Charsets.UTF_8))
                        .takeIf { it.lines.isNotEmpty() }
                } else {
                    null
                }
            }.onFailure { e ->
                Log.d(TAG, "读取 .lrc 失败（可能是 Android 13 权限限制）：$path", e)
            }.getOrNull()

            if (lyric != null) return lyric
        }
        return LrcParser.Lyric(emptyList())
    }

    /** 候选 .lrc 路径，按命中优先级排列 */
    private fun lrcCandidates(song: Song): List<String> {
        val file = File(song.path)
        val dir = file.parent ?: return listOf(song.lrcPath)
        val base = file.nameWithoutExtension
        val sep = File.separator
        return listOf(
            // ① 同目录同名：xxx.mp3 -> xxx.lrc
            "$dir$sep$base.lrc",
            // ② 同目录「艺术家 - 歌名.lrc」（很多播放器的导出格式）
            "$dir$sep${song.artist} - ${song.title}.lrc",
            // ③ 同目录「歌名.lrc」
            "$dir$sep${song.title}.lrc",
            // ④ 同目录下的 Lyrics 子目录
            "$dir${sep}Lyrics$sep$base.lrc"
        ).distinct()
    }

    private fun normalize(value: String?, fallback: String): String {
        val v = value?.trim().orEmpty()
        if (v.isEmpty() || v.equals(MediaStore.UNKNOWN_STRING, ignoreCase = true)) {
            return fallback
        }
        return v
    }

    companion object {
        private const val TAG = "MusicRepository"
        private const val MIN_DURATION_MS = 30_000L

        const val UNKNOWN_TITLE = "未知曲目"
        const val UNKNOWN_ARTIST = "未知艺术家"
        const val UNKNOWN_ALBUM = "未知专辑"

        @Volatile
        private var instance: MusicRepository? = null

        fun getInstance(context: Context): MusicRepository =
            instance ?: synchronized(this) {
                instance ?: MusicRepository(context.applicationContext).also { instance = it }
            }
    }
}
