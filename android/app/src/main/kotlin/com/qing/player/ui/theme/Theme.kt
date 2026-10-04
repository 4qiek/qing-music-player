package com.qing.player.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * 圆角规范（全局统一）：
 * 控件 8dp、卡片 12dp、面板 16dp。
 */
object QingDimen {
    val RadiusControl: Dp = 8.dp
    val RadiusCard: Dp = 12.dp
    val RadiusPanel: Dp = 16.dp

    // 小屏紧凑间距
    val SpaceXS: Dp = 4.dp
    val SpaceS: Dp = 8.dp
    val SpaceM: Dp = 12.dp
    val SpaceL: Dp = 16.dp

    // 触控目标不小于 48dp（小屏设备上的下限）
    val MinTouchTarget: Dp = 48.dp
    val RowHeight: Dp = 56.dp
    val ArtSize: Dp = 48.dp

    // 播放页：封面封顶高度与歌词区保底高度。
    // 歌词区必须有个硬下限——Column 的 weight 在矮屏上可能被压成 0 高度，
    // 一被压成 0，整块歌词（连"暂无歌词"提示）都会被裁掉，看起来就是"没歌词"。
    val CoverMaxHeight: Dp = 200.dp
    val LyricMinHeight: Dp = 120.dp
}

/**
 * 扩展色：Material3 ColorScheme 之外的自定义项（辅助文字、分割线、作品名衬线色等）。
 */
data class QingExtendedColors(
    val textSecondary: Color,
    val divider: Color,
    val outline: Color,
    val accent: Color,
    val playButtonBackground: Color,
    val playButtonContent: Color
)

val LocalQingExtendedColors = staticCompositionLocalOf {
    QingExtendedColors(
        textSecondary = QingColor.TextSecondaryLight,
        divider = QingColor.DividerLight,
        outline = QingColor.OutlineLight,
        accent = QingColor.AccentLight,
        playButtonBackground = QingColor.PlayButtonDark,
        playButtonContent = Color.White
    )
}

private val LightScheme = lightColorScheme(
    primary = QingColor.AccentLight,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE3F0EB),
    onPrimaryContainer = QingColor.AccentLight,
    secondary = QingColor.AccentLight,
    onSecondary = Color.White,
    background = QingColor.BackgroundLight,
    onBackground = QingColor.TextPrimaryLight,
    surface = QingColor.SurfaceLight,
    onSurface = QingColor.TextPrimaryLight,
    surfaceVariant = Color(0xFFF0F0F2),
    onSurfaceVariant = QingColor.TextSecondaryLight,
    outline = QingColor.OutlineLight
)

private val DarkScheme = darkColorScheme(
    primary = QingColor.AccentDark,
    onPrimary = Color(0xFF10241D),
    primaryContainer = Color(0xFF17332A),
    onPrimaryContainer = QingColor.AccentDark,
    secondary = QingColor.AccentDark,
    onSecondary = Color(0xFF10241D),
    background = QingColor.BackgroundDark,
    onBackground = QingColor.TextPrimaryDark,
    surface = QingColor.SurfaceDark,
    onSurface = QingColor.TextPrimaryDark,
    surfaceVariant = Color(0xFF3A3A3C),
    onSurfaceVariant = QingColor.TextSecondaryDark,
    outline = QingColor.OutlineDark
)

/**
 * 「清」的主题入口。
 * 不使用 Material You 动态取色——动态色会破坏青瓷绿点缀的统一性。
 *
 * @param accentArgb 自定义点缀色（ARGB Int）。为 null 或 [com.qing.player.data.SettingsStore.ACCENT_DEFAULT]
 *                   时沿用内置青瓷绿；否则整套 ColorScheme 与扩展色按此色重新派生。
 */
@Composable
fun QingTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    fontScale: Float = 1.0f,
    useSerif: Boolean = true,
    accentArgb: Int? = null,
    content: @Composable () -> Unit
) {
    val customAccent = accentArgb?.takeIf { it != com.qing.player.data.SettingsStore.ACCENT_DEFAULT }
        ?.let { Color(it) }
    val accentLight = customAccent ?: QingColor.AccentLight
    val accentDark = customAccent?.let { lightenForDark(it) } ?: QingColor.AccentDark

    val colorScheme = if (darkTheme) darkSchemeFrom(accentDark) else lightSchemeFrom(accentLight)
    // 字体设置来自设置页：风格（衬线/黑体）与字号缩放。
    // 计算放在这里而不是每次重组时做——同一个 scale/family 只算一次。
    val family = serifOrSans(useSerif)
    val type = remember(fontScale, useSerif) { buildType(fontScale, family) }
    val typography = remember(fontScale, useSerif) {
        buildTypography(fontScale, family, type.headline)
    }
    val extended = if (darkTheme) {
        QingExtendedColors(
            textSecondary = QingColor.TextSecondaryDark,
            divider = QingColor.DividerDark,
            outline = QingColor.OutlineDark,
            accent = accentDark,
            playButtonBackground = QingColor.PlayButtonDarkOnDark,
            playButtonContent = Color(0xFF1C1C1E)
        )
    } else {
        QingExtendedColors(
            textSecondary = QingColor.TextSecondaryLight,
            divider = QingColor.DividerLight,
            outline = QingColor.OutlineLight,
            accent = accentLight,
            playButtonBackground = QingColor.PlayButtonDark,
            playButtonContent = Color.White
        )
    }

    CompositionLocalProvider(
        LocalQingExtendedColors provides extended,
        LocalQingType provides type
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = typography,
            content = content
        )
    }
}

/**
 * 相对亮度（WCAG）。用来判断自定义 accent 上该叠白字还是黑字，
 * 以及深色模式下要不要把 accent 提亮以保证对比度。
 */
private fun luminance(c: Color): Float {
    fun comp(v: Float): Float = if (v <= 0.03928f) v / 12.92f else Math.pow(((v + 0.055) / 1.055), 2.4).toFloat()
    return 0.2126f * comp(c.red) + 0.7152f * comp(c.green) + 0.0722f * comp(c.blue)
}

/** 深色模式下把过暗的自定义色提亮，避免在近黑底上看不清 */
private fun lightenForDark(c: Color): Color =
    if (luminance(c) < 0.45f) Color(
        red = (c.red * 0.5f + 0.5f).coerceIn(0f, 1f),
        green = (c.green * 0.5f + 0.5f).coerceIn(0f, 1f),
        blue = (c.blue * 0.5f + 0.5f).coerceIn(0f, 1f),
        alpha = 1f
    ) else c

/** 自定义 accent 在浅色底上配白字还是黑字 */
private fun onAccentFor(accent: Color): Color =
    if (luminance(accent) > 0.55f) Color(0xFF1C1C1E) else Color.White

private fun lightSchemeFrom(accent: Color) = lightColorScheme(
    primary = accent,
    onPrimary = onAccentFor(accent),
    primaryContainer = accent.copy(alpha = 0.12f),
    onPrimaryContainer = accent,
    secondary = accent,
    onSecondary = onAccentFor(accent),
    background = QingColor.BackgroundLight,
    onBackground = QingColor.TextPrimaryLight,
    surface = QingColor.SurfaceLight,
    onSurface = QingColor.TextPrimaryLight,
    surfaceVariant = Color(0xFFF0F0F2),
    onSurfaceVariant = QingColor.TextSecondaryLight,
    outline = QingColor.OutlineLight
)

private fun darkSchemeFrom(accent: Color) = darkColorScheme(
    primary = accent,
    onPrimary = onAccentFor(accent),
    primaryContainer = accent.copy(alpha = 0.18f),
    onPrimaryContainer = accent,
    secondary = accent,
    onSecondary = onAccentFor(accent),
    background = QingColor.BackgroundDark,
    onBackground = QingColor.TextPrimaryDark,
    surface = QingColor.SurfaceDark,
    onSurface = QingColor.TextPrimaryDark,
    surfaceVariant = Color(0xFF3A3A3C),
    onSurfaceVariant = QingColor.TextSecondaryDark,
    outline = QingColor.OutlineDark
)
