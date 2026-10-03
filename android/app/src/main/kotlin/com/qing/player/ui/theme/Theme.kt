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
 */
@Composable
fun QingTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    fontScale: Float = 1.0f,
    useSerif: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkScheme else LightScheme
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
            accent = QingColor.AccentDark,
            playButtonBackground = QingColor.PlayButtonDarkOnDark,
            playButtonContent = Color(0xFF1C1C1E)
        )
    } else {
        QingExtendedColors(
            textSecondary = QingColor.TextSecondaryLight,
            divider = QingColor.DividerLight,
            outline = QingColor.OutlineLight,
            accent = QingColor.AccentLight,
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
