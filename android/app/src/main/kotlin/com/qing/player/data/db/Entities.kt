package com.qing.player.data.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * 收藏：只存 MediaStore 的歌曲 id，避免曲库刷新后文件信息失效。
 */
@Entity(tableName = "favorites")
data class FavoriteEntity(
    @PrimaryKey val songId: Long,
    val addedAt: Long
)

/**
 * 播放历史：按播放时间倒序取最近记录。
 */
@Entity(
    tableName = "history",
    indices = [Index(value = ["playedAt"])]
)
data class HistoryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val songId: Long,
    val playedAt: Long
)

/**
 * 歌单本体。
 */
@Entity(tableName = "playlists")
data class PlaylistEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val createdAt: Long
)

/**
 * 歌单-歌曲关联表：存 MediaStore id 列表，orderIndex 控制歌单内顺序。
 */
@Entity(
    tableName = "playlist_songs",
    primaryKeys = ["playlistId", "songId"],
    indices = [Index(value = ["playlistId"])]
)
data class PlaylistSongEntity(
    val playlistId: Long,
    val songId: Long,
    val orderIndex: Int
)
