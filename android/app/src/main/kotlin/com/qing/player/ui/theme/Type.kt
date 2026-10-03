package com.qing.player.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * 字体规范。
 *
 * 作品名（歌名 / 专辑名）默认用衬线体，呼应桌面版「清」的排版气质；
 * UI 铬件（标签、按钮、辅助信息）默认用黑体。
 *
 * 但这两件事都可以在设置里改：字体风格（衬线 / 黑体）与字号缩放（小 / 标准 / 大 / 超大）。
 * 所以这里的样式**不能是写死的常量**，必须通过 CompositionLocal 按当前设置生成。
 *
 * 实现上的取巧：对外仍然暴露 `TitleSerifStyle` 这样的名字，
 * 只是把 `val` 换成带 `@Composable` 的 getter——这样已有的调用点一个字都不用改，
 * 而值会跟着 LocalQingType 变。
 */
private const val BASE_TITLE = 16
private const val BASE_HEADLINE = 22
private const val BASE_SUBTITLE = 14

/** 一套随设置变化的作品名字体 */
data class QingType(
    val title: TextStyle,
    val headline: TextStyle,
    val subtitle: TextStyle
)

val LocalQingType = staticCompositionLocalOf { buildType(1.0f, FontFamily.Serif) }

fun serifOrSans(useSerif: Boolean): FontFamily =
    if (useSerif) FontFamily.Serif else FontFamily.SansSerif

/**
 * 按字号缩放 [scale] 与字体家族 [family] 生成作品名样式。
 * 行高跟着字号一起放大，否则大字会挤在一起。
 */
fun buildType(scale: Float, family: FontFamily): QingType = QingType(
    title = TextStyle(
        fontFamily = family,
        fontWeight = FontWeight.Normal,
        fontSize = (BASE_TITLE * scale).sp,
        lineHeight = (BASE_TITLE * scale * 1.375f).sp
    ),
    headline = TextStyle(
        fontFamily = family,
        fontWeight = FontWeight.Medium,
        fontSize = (BASE_HEADLINE * scale).sp,
        lineHeight = (BASE_HEADLINE * scale * 1.28f).sp
    ),
    subtitle = TextStyle(
        fontFamily = family,
        fontWeight = FontWeight.Normal,
        fontSize = (BASE_SUBTITLE * scale).sp,
        lineHeight = (BASE_SUBTITLE * scale * 1.43f).sp
    )
)

/** 作品名：默认衬线体 */
val TitleSerifStyle: TextStyle
    @Composable @ReadOnlyComposable get() = LocalQingType.current.title

val HeadlineSerifStyle: TextStyle
    @Composable @ReadOnlyComposable get() = LocalQingType.current.headline

val SubtitleSerifStyle: TextStyle
    @Composable @ReadOnlyComposable get() = LocalQingType.current.subtitle

/**
 * Material3 的 Typography。UI 铬件跟随同一套设置一起缩放，
 * 否则会出现"歌名变大了、按钮文字还是原样"的割裂感。
 */
fun buildTypography(scale: Float, family: FontFamily, title: TextStyle): Typography = Typography(
    labelLarge = TextStyle(fontFamily = family, fontWeight = FontWeight.Medium, fontSize = (14 * scale).sp),
    labelMedium = TextStyle(fontFamily = family, fontWeight = FontWeight.Medium, fontSize = (12 * scale).sp),
    labelSmall = TextStyle(fontFamily = family, fontWeight = FontWeight.Normal, fontSize = (11 * scale).sp),
    bodyLarge = TextStyle(fontFamily = family, fontWeight = FontWeight.Normal, fontSize = (15 * scale).sp),
    bodyMedium = TextStyle(fontFamily = family, fontWeight = FontWeight.Normal, fontSize = (13 * scale).sp),
    bodySmall = TextStyle(fontFamily = family, fontWeight = FontWeight.Normal, fontSize = (12 * scale).sp),
    titleMedium = TextStyle(fontFamily = family, fontWeight = FontWeight.Medium, fontSize = (16 * scale).sp),
    titleSmall = TextStyle(fontFamily = family, fontWeight = FontWeight.Medium, fontSize = (14 * scale).sp),
    headlineSmall = title
)
