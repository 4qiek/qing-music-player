package com.qing.player.data

import android.content.Context
import kotlin.math.roundToInt

/**
 * 轻量偏好存储：主题、均衡器、断点续播位置。
 * 用 SharedPreferences 即可（EQ 只有 11 个数字，断点只有 3 个字段），不额外建表。
 */
class SettingsStore private constructor(context: Context) {

    private val prefs = context.applicationContext
        .getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    // ---------------- 主题 ----------------
    var themeMode: String
        get() = prefs.getString(KEY_THEME, THEME_SYSTEM) ?: THEME_SYSTEM
        set(value) = prefs.edit().putString(KEY_THEME, value).apply()

    // ---------------- 均衡器 ----------------
    var eqEnabled: Boolean
        get() = prefs.getBoolean(KEY_EQ_ENABLED, false)
        set(value) = prefs.edit().putBoolean(KEY_EQ_ENABLED, value).apply()

    var eqPresetIndex: Int
        get() = prefs.getInt(KEY_EQ_PRESET, 0)
        set(value) = prefs.edit().putInt(KEY_EQ_PRESET, value).apply()

    /**
     * 十段增益，单位是毫贝尔（millibel），直接喂给 android.media.audiofx.Equalizer。
     * 默认全 0（直通）。
     */
    var eqLevels: IntArray
        get() {
            val raw = prefs.getString(KEY_EQ_LEVELS, null)
            if (raw.isNullOrEmpty()) return IntArray(EQ_BAND_COUNT)
            val parts = raw.split(",")
            return IntArray(EQ_BAND_COUNT) { i ->
                parts.getOrNull(i)?.trim()?.toIntOrNull() ?: 0
            }
        }
        set(value) = prefs.edit()
            .putString(KEY_EQ_LEVELS, value.joinToString(",") { it.toString() })
            .apply()

    /** 取某个预设的增益（毫贝尔），并按设备支持的上下限做钳制 */
    fun presetLevels(index: Int, minMillibel: Int = -1500, maxMillibel: Int = 1500): IntArray {
        val db = PRESETS.getOrNull(index) ?: PRESETS[0]
        return IntArray(EQ_BAND_COUNT) { i ->
            (db[i] * 100).roundToInt().coerceIn(minMillibel, maxMillibel)
        }
    }

    /** 切换预设并落盘 */
    fun applyPreset(index: Int, minMillibel: Int = -1500, maxMillibel: Int = 1500): IntArray {
        val levels = presetLevels(index, minMillibel, maxMillibel)
        eqPresetIndex = index
        eqLevels = levels
        return levels
    }

    // ---------------- 断点续播 ----------------
    var lastSongId: Long
        get() = prefs.getLong(KEY_LAST_SONG_ID, -1L)
        set(value) = prefs.edit().putLong(KEY_LAST_SONG_ID, value).apply()

    var lastPositionMs: Long
        get() = prefs.getLong(KEY_LAST_POSITION, 0L)
        set(value) = prefs.edit().putLong(KEY_LAST_POSITION, value).apply()

    /** 上次播放的队列（MediaStore id 序列），用于恢复整份播放列表 */
    var lastQueue: List<Long>
        get() {
            val raw = prefs.getString(KEY_LAST_QUEUE, null)
            if (raw.isNullOrEmpty()) return emptyList()
            return raw.split(",").mapNotNull { it.trim().toLongOrNull() }
        }
        set(value) = prefs.edit().putString(KEY_LAST_QUEUE, value.joinToString(",")).apply()

    companion object {
        const val PREF_NAME = "qing_settings"

        private const val KEY_THEME = "theme_mode"
        private const val KEY_EQ_ENABLED = "eq_enabled"
        private const val KEY_EQ_PRESET = "eq_preset"
        private const val KEY_EQ_LEVELS = "eq_levels"
        private const val KEY_LAST_SONG_ID = "last_song_id"
        private const val KEY_LAST_POSITION = "last_position"
        private const val KEY_LAST_QUEUE = "last_queue"

        const val THEME_SYSTEM = "system"
        const val THEME_LIGHT = "light"
        const val THEME_DARK = "dark"

        // ---- 均衡器十段频点（Hz）----
        const val EQ_BAND_COUNT = 10
        val EQ_FREQUENCIES = intArrayOf(31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000)

        /**
         * 预设增益，单位是 dB（写入 Equalizer 时 ×100 转毫贝尔）。
         * 顺序与 EQ_FREQUENCIES 一致。
         */
        val PRESET_NAMES = arrayOf("默认", "流行", "摇滚", "爵士", "古典", "电子", "人声", "重低音")

        private val PRESETS: Array<FloatArray> = arrayOf(
            // 默认（直通）
            floatArrayOf(0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f, 0f),
            // 流行
            floatArrayOf(-1.5f, 3f, 4.5f, 4f, 2f, -1f, -1.5f, -1.5f, -1.5f, -1.5f),
            // 摇滚
            floatArrayOf(5f, 3.5f, -1.5f, -2f, -1f, 1.5f, 3.5f, 4.5f, 4.5f, 4.5f),
            // 爵士
            floatArrayOf(3.5f, 3f, 1.5f, 2f, -1.5f, -1.5f, 0f, 1.5f, 3f, 3.5f),
            // 古典
            floatArrayOf(3.5f, 3f, 2f, 1.5f, -1.5f, -1.5f, 0f, 2f, 2.5f, 3f),
            // 电子
            floatArrayOf(5f, 4.5f, 2.5f, 0f, -1.5f, 1.5f, 2f, 3f, 3.5f, 4f),
            // 人声
            floatArrayOf(-2f, -2.5f, 0f, 2.5f, 4.5f, 4.5f, 3.5f, 2f, 1f, -1f),
            // 重低音
            floatArrayOf(6f, 5.5f, 4.5f, 2.5f, 1f, -1.5f, -3f, -4f, -4.5f, -5f)
        )

        @Volatile
        private var instance: SettingsStore? = null

        fun getInstance(context: Context): SettingsStore =
            instance ?: synchronized(this) {
                instance ?: SettingsStore(context.applicationContext).also { instance = it }
            }
    }
}
