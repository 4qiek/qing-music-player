package com.qing.player.util

import android.content.Context
import android.content.res.Configuration
import android.os.Build
import java.util.Locale

/**
 * 应用内语言切换。
 *
 * 做法是在 `attachBaseContext` 里包一层带指定 Locale 的 Context——
 * 这是 Android 7.0（API 24）之后官方推荐的路子，本项目 minSdk 26，可以放心用。
 * 不用 `AppCompatDelegate.setApplicationLocales()`：那个要 appcompat 1.6+ 且依赖
 * 系统的 per-app language 支持（Android 13 才完整），在 8.0/9.0 的设备上不生效。
 *
 * 切换语言后需要 recreate Activity 才能立刻生效（由调用方负责）。
 */
object LocaleHelper {

    /** 跟随系统：不做任何处理，直接用系统给的配置 */
    const val LANG_SYSTEM = "system"
    const val LANG_ZH = "zh"
    const val LANG_EN = "en"

    /**
     * 把 [tag] 对应的 Locale 应用到 [context]。
     * 传 [LANG_SYSTEM] 时原样返回。
     */
    fun apply(context: Context, tag: String): Context {
        if (tag == LANG_SYSTEM) return context

        val locale = when (tag) {
            LANG_ZH -> Locale.SIMPLIFIED_CHINESE
            LANG_EN -> Locale.ENGLISH
            else -> Locale.forLanguageTag(tag)
        }
        if (locale.language.isBlank()) return context

        Locale.setDefault(locale)
        val config = Configuration(context.resources.configuration)
        config.setLocale(locale)
        // Android 8.0 上光 setLocale 不够，个别 ROM 会读 layoutDirection，
        // 这里顺手带上，避免阿拉伯语系之外的意外 RTL。
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
            config.setLayoutDirection(locale)
        }
        return context.createConfigurationContext(config)
    }
}
