package com.qing.player.data

import android.content.Context
import android.util.Log
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONObject

/**
 * 联网补全结果的本地缓存。
 *
 * 为什么不用 Room 另开一张表：给已有数据库加表要写 Migration，
 * 一旦写错就是「歌单和收藏全没了」这种不可逆事故。而这份数据
 * 丢了最多重新匹配一次，完全不值得为它动数据库结构。所以存成
 * 内部存储里的一个 JSON 文件，进程内再挂一份内存索引。
 *
 * 读写都在调用方保证的 IO 线程上做。
 */
class MetadataCache(context: Context) {

    /** 一条曲目补全到的信息；字段都是可空的，命中哪个填哪个 */
    data class Entry(
        val coverUrl: String? = null,
        val lyrics: String? = null
    )

    private val file = File(context.applicationContext.filesDir, FILE_NAME)
    private val map = ConcurrentHashMap<Long, Entry>()
    private val dirty = AtomicBoolean(false)

    init {
        load()
    }

    fun coverUrl(songId: Long): String? = map[songId]?.coverUrl

    fun lyrics(songId: Long): String? = map[songId]?.lyrics

    /** 已经补到过封面就不再重复请求，避免反复打接口 */
    fun hasCover(songId: Long): Boolean = map[songId]?.coverUrl != null

    /** 这首歌是否值得再去联网问一次（没补过封面，或补过但没拿到） */
    fun needsCover(songId: Long): Boolean {
        val e = map[songId] ?: return true
        return e.coverUrl.isNullOrBlank()
    }

    fun put(songId: Long, entry: Entry) {
        val old = map[songId]
        val merged = Entry(
            coverUrl = entry.coverUrl ?: old?.coverUrl,
            lyrics = entry.lyrics ?: old?.lyrics
        )
        map[songId] = merged
        dirty.set(true)
    }

    fun putCover(songId: Long, url: String) = put(songId, Entry(coverUrl = url))
    fun putLyrics(songId: Long, text: String) = put(songId, Entry(lyrics = text))

    /** 落盘。批量匹配完再调，不要每首一次 */
    fun save() {
        if (!dirty.get()) return
        runCatching {
            val root = JSONObject()
            for ((id, e) in map) {
                val o = JSONObject()
                if (!e.coverUrl.isNullOrBlank()) o.put("cover", e.coverUrl)
                if (!e.lyrics.isNullOrBlank()) o.put("lyrics", e.lyrics)
                if (o.length() > 0) root.put(id.toString(), o)
            }
            file.writeText(root.toString(), Charsets.UTF_8)
            dirty.set(false)
        }.onFailure {
            Log.w(TAG, "补全缓存写入失败", it)
        }
    }

    private fun load() {
        if (!file.exists()) return
        runCatching {
            val root = JSONObject(file.readText(Charsets.UTF_8))
            val keys = root.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                val id = key.toLongOrNull() ?: continue
                val o = root.getJSONObject(key)
                map[id] = Entry(
                    coverUrl = o.optString("cover").takeIf { it.isNotBlank() },
                    lyrics = o.optString("lyrics").takeIf { it.isNotBlank() }
                )
            }
        }.onFailure {
            Log.w(TAG, "补全缓存读取失败，按空缓存继续", it)
        }
    }

    companion object {
        private const val TAG = "MetadataCache"
        private const val FILE_NAME = "online_meta.json"

        @Volatile
        private var instance: MetadataCache? = null

        fun getInstance(context: Context): MetadataCache =
            instance ?: synchronized(this) {
                instance ?: MetadataCache(context).also { instance = it }
            }
    }
}
