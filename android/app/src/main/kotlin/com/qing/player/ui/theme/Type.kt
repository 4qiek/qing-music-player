package com.qing.player.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * 字体规范：
 * - 作品名（歌名 / 专辑名）用衬线体，呼应桌面版「清」的排版气质
 * - UI 铬件（标签、按钮、辅助信息）用黑体（系统 sans）
 *
 * Walkman 屏幕只有 3.6~5 英寸，字号整体偏小且行距紧凑。
 */
val SerifFamily = FontFamily.Serif
val SansFamily = FontFamily.Default

// 作品名：衬线体
val TitleSerifStyle = TextStyle(
    fontFamily = SerifFamily,
    fontWeight = FontWeight.Normal,
    fontSize = 16.sp,
    lineHeight = 22.sp
)

val HeadlineSerifStyle = TextStyle(
    fontFamily = SerifFamily,
    fontWeight = FontWeight.Medium,
    fontSize = 22.sp,
    lineHeight = 28.sp
)

val SubtitleSerifStyle = TextStyle(
    fontFamily = SerifFamily,
    fontWeight = FontWeight.Normal,
    fontSize = 14.sp,
    lineHeight = 20.sp
)

val QingTypography = Typography(
    // UI 铬件统一黑体
    labelLarge = TextStyle(fontFamily = SansFamily, fontWeight = FontWeight.Medium, fontSize = 14.sp),
    labelMedium = TextStyle(fontFamily = SansFamily, fontWeight = FontWeight.Medium, fontSize = 12.sp),
    labelSmall = TextStyle(fontFamily = SansFamily, fontWeight = FontWeight.Normal, fontSize = 11.sp),
    bodyLarge = TextStyle(fontFamily = SansFamily, fontWeight = FontWeight.Normal, fontSize = 15.sp),
    bodyMedium = TextStyle(fontFamily = SansFamily, fontWeight = FontWeight.Normal, fontSize = 13.sp),
    bodySmall = TextStyle(fontFamily = SansFamily, fontWeight = FontWeight.Normal, fontSize = 12.sp),
    titleMedium = TextStyle(fontFamily = SansFamily, fontWeight = FontWeight.Medium, fontSize = 16.sp),
    titleSmall = TextStyle(fontFamily = SansFamily, fontWeight = FontWeight.Medium, fontSize = 14.sp),
    headlineSmall = HeadlineSerifStyle
)
