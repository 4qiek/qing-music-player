package com.qing.player.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

/**
 * 本地持久化：收藏、播放历史、歌单。
 *
 * 注意：Room 2.6.1 使用 KSP 生成实现代码（见 app/build.gradle.kts）。
 */
@Database(
    entities = [
        FavoriteEntity::class,
        HistoryEntity::class,
        PlaylistEntity::class,
        PlaylistSongEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun favoriteDao(): FavoriteDao
    abstract fun historyDao(): HistoryDao
    abstract fun playlistDao(): PlaylistDao

    companion object {
        private const val DB_NAME = "qing.db"

        @Volatile
        private var instance: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    DB_NAME
                )
                    // 曲库刷新不应因数据库迁移失败而崩溃，简单重建
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { instance = it }
            }
    }
}
