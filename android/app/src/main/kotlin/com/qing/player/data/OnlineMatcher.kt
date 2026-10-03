package com.qing.player.data

import android.util.Log
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import org.json.JSONArray
import org.json.JSONObject

/**
 * 联网补全曲目信息：封面 + 歌词。
 *
 * 只用两个**无需注册、无需 API Key** 的公开接口：
 * - 封面与元数据：iTunes Search API（`itunes.apple.com/search`）
 * - 歌词：LRCLIB（`lrclib.net`）
 *
 * 设计原则：
 * 1. **只做补全，不做替换**。本地已经有的信息（MediaStore 读到的标题/艺术家、
 *    同目录的 .lrc）优先级更高，联网结果只用来填空。
 * 2. **失败必须静默**。断网、超时、接口变更都不允许影响本地播放——
 *    所有异常都在这里吞掉并返回 null，调用方只看到"这次没匹配到"。
 * 3. 全部走 HttpURLConnection，不引入 OkHttp/Gson，避免为一个小功能
 *    把 APK 再撑大一圈。
 *
 * 注意：这个类的方法会阻塞，**必须在 IO 线程调用**。
 */
object OnlineMatcher {

    private const val TAG = "OnlineMatcher"

    /**
     * LRCLIB 明确要求带 User-Agent，否则返回 403。
     * 格式约定：应用名/版本 (联系地址)
     */
    private const val USER_AGENT = "QingPlayer/1.2 (https://github.com/4qiek/qing-music-player)"

    private const val CONNECT_TIMEOUT_MS = 6_000
    private const val READ_TIMEOUT_MS = 8_000

    /** 匹配结果：命中哪个填哪个，没命中的是 null */
    data class MatchResult(
        val coverUrl: String? = null,
        val lyrics: String? = null,
        val title: String? = null,
        val artist: String? = null,
        val album: String? = null
    )

    /**
     * 一次把封面与歌词都查了。
     * 两个接口独立失败，互不影响。
     */
    fun match(song: Song, wantLyrics: Boolean = true): MatchResult? {
        val artwork = searchArtwork(song.title, song.artist, song.album)
        val lyrics = if (wantLyrics) {
            fetchLyrics(song.title, song.artist, song.album)
        } else null
        if (artwork == null && lyrics == null) return null
        return MatchResult(
            coverUrl = artwork?.first,
            lyrics = lyrics,
            title = artwork?.second,
            artist = artwork?.third,
            album = artwork?.fourth
        )
    }

    /** 只查封面与元数据 */
    fun searchArtwork(title: String, artist: String, album: String): Quad? {
        if (title.isBlank()) return null
        val term = listOf(artist, title).filter { it.isNotBlank() }.joinToString(" ")
        val url = "https://itunes.apple.com/search?term=${encode(term)}" +
            "&entity=song&limit=1&country=CN"
        return runCatching {
            val body = get(url) ?: return null
            val results = JSONObject(body).optJSONArray("results")
            if (results == null || results.length() == 0) return null
            val first = results.getJSONObject(0)
            val art = first.optString("artworkUrl100").takeIf { it.isNotBlank() }
            // artworkUrl100 里的 100x100bb 可以换成任意尺寸，取 600 足够高清
            val big = art?.replace("100x100bb", "600x600bb")
            Quad(
                big,
                first.optString("trackName").takeIf { it.isNotBlank() },
                first.optString("artistName").takeIf { it.isNotBlank() },
                first.optString("collectionName").takeIf { it.isNotBlank() }
            )
        }.onFailure {
            Log.d(TAG, "封面匹配失败：${it.message}")
        }.getOrNull()
    }

    /** 只查歌词。优先带时间轴的 syncedLyrics，没有就退回纯文本 */
    fun fetchLyrics(title: String, artist: String, album: String): String? {
        if (title.isBlank()) return null
        return runCatching {
            val url = "https://lrclib.net/api/get?track_name=${encode(title)}" +
                "&artist_name=${encode(artist)}&album_name=${encode(album)}"
            val body = get(url)
            if (body != null) {
                val o = JSONObject(body)
                val synced = o.optString("syncedLyrics").takeIf { it.isNotBlank() }
                if (synced != null) return@runCatching synced
                val plain = o.optString("plainLyrics").takeIf { it.isNotBlank() }
                if (plain != null) return@runCatching plain
            }
            // 精确查询没命中，退回模糊搜索
            val q = listOf(artist, title).filter { it.isNotBlank() }.joinToString(" ")
            val searchBody = get("https://lrclib.net/api/search?q=${encode(q)}")
                ?: return@runCatching null
            val arr = JSONArray(searchBody)
            for (i in 0 until minOf(arr.length(), 3)) {
                val o = arr.getJSONObject(i)
                val synced = o.optString("syncedLyrics").takeIf { it.isNotBlank() }
                if (synced != null) return@runCatching synced
                val plain = o.optString("plainLyrics").takeIf { it.isNotBlank() }
                if (plain != null) return@runCatching plain
            }
            null
        }.onFailure {
            Log.d(TAG, "歌词匹配失败：${it.message}")
        }.getOrNull()
    }

    /**
     * 封面查询的返回：封面 URL + 校正过的标题/艺术家/专辑。
     * 字段名就叫 first/second/... 是为了让 data class 自动生成的
     * componentN 与属性名对得上，读起来不至于 a/b/c/d 分不清。
     */
    data class Quad(
        val first: String?,
        val second: String?,
        val third: String?,
        val fourth: String?
    )

    private fun encode(s: String): String = URLEncoder.encode(s, "UTF-8")

    /** GET 一个 URL，返回响应体；非 200 或出错返回 null */
    private fun get(url: String): String? {
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                setRequestProperty("User-Agent", USER_AGENT)
                setRequestProperty("Accept", "application/json")
                connectTimeout = CONNECT_TIMEOUT_MS
                readTimeout = READ_TIMEOUT_MS
                instanceFollowRedirects = true
            }
            val code = conn.responseCode
            if (code !in 200..299) {
                Log.d(TAG, "HTTP $code <- $url")
                return null
            }
            conn.inputStream.bufferedReader().use(BufferedReader::readText)
        } finally {
            conn?.disconnect()
        }
    }
}
