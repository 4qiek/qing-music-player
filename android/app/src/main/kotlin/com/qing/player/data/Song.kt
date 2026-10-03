package com.qing.player.data

import android.net.Uri
import android.provider.MediaStore

/**
 * 曲目模型，字段来自 MediaStore.Audio.Media。
 *
 * @param id        MediaStore _ID，作为曲库内的唯一主键（也用于收藏 / 歌单存储）
 * @param albumId   专辑 id，用于拼接封面 Uri
 * @param path      文件绝对路径，用于文件夹分组与同名 .lrc 查找
 */
data class Song(
    val id: Long,
    val title: String,
    val artist: String,
    val album: String,
    val albumId: Long,
    val duration: Long,
    val path: String,
    val size: Long,
    val dateAdded: Long
) {
    /** 专辑封面 Uri；无封面时 Coil 会加载失败，UI 回退到占位音符 */
    val albumArtUri: Uri
        get() = Uri.parse("content://media/external/audio/albumart").buildUpon()
            .appendPath(albumId.toString())
            .build()

    /** 所属文件夹路径（Walkman 用户常按文件夹听歌） */
    val folderPath: String
        get() = path.substringBeforeLast('/', "").ifEmpty { "/" }

    /** 文件夹显示名 */
    val folderName: String
        get() = folderPath.substringAfterLast('/').ifEmpty { "/" }

    /** 同名歌词文件路径：把扩展名替换为 .lrc */
    val lrcPath: String
        get() {
            val dot = path.lastIndexOf('.')
            return if (dot > 0) path.substring(0, dot) + ".lrc" else "$path.lrc"
        }

    /** 转成 Media3 的 MediaItem；mediaId 存 MediaStore id，便于跨进程还原曲库 */
    val mediaId: String get() = id.toString()

    companion object {
        /** MediaStore 查询列 */
        val PROJECTION = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.ALBUM_ID,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.DATA,
            MediaStore.Audio.Media.SIZE,
            MediaStore.Audio.Media.DATE_ADDED
        )
    }
}

/** 专辑分组：以 albumId 聚合，保证同一专辑不同艺术家条目不串 */
data class AlbumGroup(
    val albumId: Long,
    val name: String,
    val artist: String,
    val songs: List<Song>
)

/** 艺术家分组 */
data class ArtistGroup(
    val name: String,
    val songs: List<Song>,
    val albumCount: Int
)

/** 文件夹分组：按文件所在目录聚合 */
data class FolderGroup(
    val path: String,
    val name: String,
    val songs: List<Song>
)
