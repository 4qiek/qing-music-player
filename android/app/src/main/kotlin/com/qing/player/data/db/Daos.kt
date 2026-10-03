package com.qing.player.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

@Dao
interface FavoriteDao {

    @Query("SELECT songId FROM favorites ORDER BY addedAt DESC")
    fun observeAll(): Flow<List<Long>>

    @Query("SELECT EXISTS(SELECT 1 FROM favorites WHERE songId = :songId)")
    fun observeIsFavorite(songId: Long): Flow<Boolean>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: FavoriteEntity)

    @Query("DELETE FROM favorites WHERE songId = :songId")
    suspend fun delete(songId: Long)
}

@Dao
interface HistoryDao {

    /** 最近播放，最多 200 条，去重（同一首只保留最近一次） */
    @Query("SELECT * FROM history ORDER BY playedAt DESC LIMIT 200")
    fun observeRecent(): Flow<List<HistoryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: HistoryEntity)

    @Query("DELETE FROM history WHERE songId = :songId")
    suspend fun deleteBySongId(songId: Long)

    @Query("DELETE FROM history")
    suspend fun clear()
}

@Dao
interface PlaylistDao {

    @Query("SELECT * FROM playlists ORDER BY createdAt DESC")
    fun observePlaylists(): Flow<List<PlaylistEntity>>

    @Query("SELECT * FROM playlist_songs WHERE playlistId = :playlistId ORDER BY orderIndex ASC")
    fun observeSongs(playlistId: Long): Flow<List<PlaylistSongEntity>>

    /** 歌单内的歌曲 id 列表（有序），供 UI 关联曲库还原 Song */
    @Query("SELECT songId FROM playlist_songs WHERE playlistId = :playlistId ORDER BY orderIndex ASC")
    fun observeSongIds(playlistId: Long): Flow<List<Long>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlaylist(entity: PlaylistEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSongs(entities: List<PlaylistSongEntity>)

    @Query("DELETE FROM playlists WHERE id = :playlistId")
    suspend fun deletePlaylist(playlistId: Long)

    @Query("DELETE FROM playlist_songs WHERE playlistId = :playlistId")
    suspend fun deleteSongs(playlistId: Long)

    @Query("DELETE FROM playlist_songs WHERE playlistId = :playlistId AND songId = :songId")
    suspend fun deleteSong(playlistId: Long, songId: Long)

    @Query("SELECT COALESCE(MAX(orderIndex), -1) FROM playlist_songs WHERE playlistId = :playlistId")
    suspend fun maxOrderIndex(playlistId: Long): Int

    /** 一次性读取歌单已有曲目（用于去重，避免主键冲突） */
    @Query("SELECT songId FROM playlist_songs WHERE playlistId = :playlistId")
    suspend fun getSongIdsOnce(playlistId: Long): List<Long>

    /** 删除歌单及其所有曲目（事务） */
    @Transaction
    suspend fun deletePlaylistWithSongs(playlistId: Long) {
        deleteSongs(playlistId)
        deletePlaylist(playlistId)
    }
}
