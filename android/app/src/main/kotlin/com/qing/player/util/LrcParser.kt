package com.qing.player.util

/**
 * LRC 歌词解析。
 *
 * 支持：
 * - 标准行 `[mm:ss.xx]文本`
 * - 一行多个时间标签 `[00:12.00][01:20.00]文本`
 * - 元信息行 `[ti:]` `[ar:]` `[al:]` `[by:]` `[offset:]`（offset 单位毫秒，正值表示整体延后）
 * - 无标签的纯文本行忽略
 *
 * 解析结果按时间升序排序，供 UI 做当前行高亮与自动滚动。
 */
data class LyricLine(
    val timeMs: Long,
    val text: String
)

object LrcParser {

    private val TIME_TAG = Regex("\\[(\\d{1,3}):(\\d{1,2})(?:[.:](\\d{1,3}))?\\]")
    private val META_TAG = Regex("\\[(ti|ar|al|by|offset):([^\\]]*)\\]")

    /** 解析结果：歌词行 + 整体时间偏移 */
    data class Lyric(
        val lines: List<LyricLine>,
        val offsetMs: Long = 0L
    )

    fun parse(raw: String): Lyric {
        if (raw.isBlank()) return Lyric(emptyList())

        var offsetMs = 0L
        val result = ArrayList<LyricLine>()

        raw.lineSequence().forEach { rawLine ->
            val line = rawLine.trim()
            if (line.isEmpty()) return@forEach

            // 元信息：offset 需要作用于全部行
            val meta = META_TAG.find(line)
            if (meta != null) {
                if (meta.groupValues[1] == "offset") {
                    offsetMs = meta.groupValues[2].trim().toLongOrNull() ?: 0L
                }
                return@forEach
            }

            val matches = TIME_TAG.findAll(line).toList()
            if (matches.isEmpty()) return@forEach

            // 去掉所有时间标签后剩下的就是歌词正文
            val text = TIME_TAG.replace(line, "").trim()
            if (text.isEmpty()) return@forEach

            matches.forEach { m ->
                val minute = m.groupValues[1].toLongOrNull() ?: return@forEach
                val second = m.groupValues[2].toLongOrNull() ?: return@forEach
                val fracRaw = m.groupValues[3]
                val millis = when {
                    fracRaw.isEmpty() -> 0L
                    fracRaw.length == 1 -> fracRaw.toLong() * 100
                    fracRaw.length == 2 -> fracRaw.toLong() * 10
                    else -> fracRaw.substring(0, 3).toLong()
                }
                result.add(LyricLine(minute * 60_000 + second * 1_000 + millis, text))
            }
        }

        val sorted = result.sortedBy { it.timeMs }
        return Lyric(sorted, offsetMs)
    }

    /**
     * 二分查找当前应高亮的行下标。
     * 返回最后一个 timeMs <= position 的行；若播放位置早于第一行，返回 -1。
     */
    fun indexAt(lines: List<LyricLine>, positionMs: Long): Int {
        if (lines.isEmpty()) return -1
        var lo = 0
        var hi = lines.lastIndex
        var answer = -1
        while (lo <= hi) {
            val mid = (lo + hi) ushr 1
            if (lines[mid].timeMs <= positionMs) {
                answer = mid
                lo = mid + 1
            } else {
                hi = mid - 1
            }
        }
        return answer
    }

    /** 带 offset 修正的当前行下标 */
    fun indexAt(lyric: Lyric, positionMs: Long): Int =
        indexAt(lyric.lines, positionMs + lyric.offsetMs)
}
