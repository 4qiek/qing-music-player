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

    // ---------------- 语言 ----------------
    /**
     * 界面语言。`system` 跟随系统，其它值见 LocaleHelper.LANG_*。
     * 改完要 recreate Activity 才生效（attachBaseContext 只在创建时走一次）。
     */
    var language: String
        get() = prefs.getString(KEY_LANGUAGE, LANG_SYSTEM) ?: LANG_SYSTEM
        set(value) = prefs.edit().putString(KEY_LANGUAGE, value).apply()

    // ---------------- 字体 ----------------
    /** 字体风格：serif 衬线 / sans 黑体 */
    var fontFamily: String
        get() = prefs.getString(KEY_FONT_FAMILY, FONT_SERIF) ?: FONT_SERIF
        set(value) = prefs.edit().putString(KEY_FONT_FAMILY, value).apply()

    /** 全局字号缩放，1.0 为标准 */
    var fontScale: Float
        get() = prefs.getFloat(KEY_FONT_SCALE, 1.0f)
        set(value) = prefs.edit().putFloat(KEY_FONT_SCALE, value).apply()

    // ---------------- 浏览 ----------------
    /**
     * 底部标签栏是否显示「文件夹」。
     * 默认关：大多数人按歌曲/专辑/艺术家听就够了，按目录浏览是小众需求，
     * 放进设置里（默认不占底部那点宽度），需要的人自己打开。
     */
    var showFolderTab: Boolean
        get() = prefs.getBoolean(KEY_SHOW_FOLDER_TAB, false)
        set(value) = prefs.edit().putBoolean(KEY_SHOW_FOLDER_TAB, value).apply()

    // ---------------- 联网补全 ----------------
    /**
     * 是否联网补全封面与歌词。
     * 默认开——这是本次新增的功能，装好就能看到效果；关掉后 App 完全离线。
     * 注意它**只影响补全**，任何情况下都不会影响本地播放。
     */
    var onlineMatchEnabled: Boolean
        get() = prefs.getBoolean(KEY_ONLINE_MATCH, true)
        set(value) = prefs.edit().putBoolean(KEY_ONLINE_MATCH, value).apply()

    // ---------------- 自定义主题色 ----------------
    /**
     * 自定义点缀色（ARGB，Int）。为 [ACCENT_DEFAULT] 时表示用内置青瓷绿，不替换。
     * 选了别的颜色后，整套 ColorScheme 与扩展色都按这个色重新派生。
     */
    var accentColorArgb: Int
        get() = prefs.getInt(KEY_ACCENT_COLOR, ACCENT_DEFAULT)
        set(value) = prefs.edit().putInt(KEY_ACCENT_COLOR, value).apply()

    // ---------------- 低音增强 ----------------
    /**
     * 低音增强开关。与十段 EQ 独立，走的是 android.media.audiofx.BassBoost（低架提升），
     * 作用在同一 audio session。
     */
    var bassBoostEnabled: Boolean
        get() = prefs.getBoolean(KEY_BASS_ENABLED, false)
        set(value) = prefs.edit().putBoolean(KEY_BASS_ENABLED, value).apply()

    /** 低音增强强度，BassBoost 的 setStrength 取值 0–1000，默认 0（关闭感） */
    var bassBoostStrength: Int
        get() = prefs.getInt(KEY_BASS_STRENGTH, 0).coerceIn(0, 1000)
        set(value) = prefs.edit().putInt(KEY_BASS_STRENGTH, value.coerceIn(0, 1000)).apply()

    // ---------------- 歌词延迟校准 ----------------
    /**
     * 歌词整体时间偏移（毫秒）。正值=歌词延后显示，负值=提前。
     * LRC 文件自带的 [offset:] 标签由解析器处理，这里是用户手动微调，两者叠加。
     */
    var lyricOffsetMs: Int
        get() = prefs.getInt(KEY_LYRIC_OFFSET, 0)
        set(value) = prefs.edit().putInt(KEY_LYRIC_OFFSET, value).apply()

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
        private const val KEY_LANGUAGE = "language"
        private const val KEY_FONT_FAMILY = "font_family"
        private const val KEY_FONT_SCALE = "font_scale"
        private const val KEY_SHOW_FOLDER_TAB = "show_folder_tab"
        private const val KEY_ONLINE_MATCH = "online_match_enabled"
        private const val KEY_ACCENT_COLOR = "accent_color_argb"
        private const val KEY_BASS_ENABLED = "bass_boost_enabled"
        private const val KEY_BASS_STRENGTH = "bass_boost_strength"
        private const val KEY_LYRIC_OFFSET = "lyric_offset_ms"

        const val THEME_SYSTEM = "system"
        const val THEME_LIGHT = "light"
        const val THEME_DARK = "dark"

        // 语言（值与 LocaleHelper.LANG_* 保持一致）
        const val LANG_SYSTEM = "system"
        const val LANG_ZH = "zh"
        const val LANG_EN = "en"

        // 字体风格
        const val FONT_SERIF = "serif"
        const val FONT_SANS = "sans"

        // 字号档位
        val FONT_SCALES = floatArrayOf(0.9f, 1.0f, 1.12f, 1.25f)

        // ---- 自定义主题色 ----
        /** 占位值：表示「沿用内置青瓷绿」，不替换 */
        const val ACCENT_DEFAULT = 0
        /** 预设色板（ARGB），设置页色板按此顺序展示；首项即内置青瓷绿 */
        val ACCENT_PRESETS = intArrayOf(
            0xFF0F6E56.toInt(),   // 青瓷绿（默认）
            0xFF3B82F6.toInt(),   // 钴蓝
            0xFF8B5CF6.toInt(),   // 紫罗兰
            0xFFEC4899.toInt(),   // 玫红
            0xFFF59E0B.toInt(),   // 琥珀
            0xFFEF4444.toInt(),   // 朱砂
            0xFF10B981.toInt(),   // 翡翠
            0xFF6366F1.toInt()    // 靛青
        )

        // ---- 均衡器十段频点（Hz）----
        const val EQ_BAND_COUNT = 10
        val EQ_FREQUENCIES = intArrayOf(31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000)

        /**
         * 预设增益，单位是 dB（写入 Equalizer 时 ×100 转毫贝尔）。
         * 顺序与 EQ_FREQUENCIES 一致。
         *
         * 预设的**显示名**不在这里——那边已经挪到 `R.array.eq_preset_names`，
         * 跟着界面语言走。这里只管数字，顺序必须与那个 array 一一对应。
         */
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
