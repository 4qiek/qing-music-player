package com.qing.player.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * 灰白极简配色（自桌面版「清」移植）。
 *
 * 基调：浅灰底 + 白卡片 + 近黑文字；唯一点缀色是青瓷绿。
 * 深色模式下底色近黑，点缀色改为浅青，保证对比度。
 */
object QingColor {
    // ---- 浅色 ----
    val BackgroundLight = Color(0xFFF5F5F7)   // 页面底色：浅灰
    val SurfaceLight = Color(0xFFFFFFFF)      // 卡片：纯白
    val TextPrimaryLight = Color(0xFF1C1C1E)
    val TextSecondaryLight = Color(0xFF8E8E93)
    val AccentLight = Color(0xFF0F6E56)       // 点缀色：青瓷绿
    val OutlineLight = Color(0xFFD8D8DC)
    val DividerLight = Color(0xFFE5E5EA)

    // ---- 深色 ----
    val BackgroundDark = Color(0xFF1C1C1C)
    val SurfaceDark = Color(0xFF2C2C2E)
    val TextPrimaryDark = Color(0xFFF2F2F7)
    val TextSecondaryDark = Color(0xFF8E8E93)
    val AccentDark = Color(0xFF5DCAA5)        // 深色下用浅青
    val OutlineDark = Color(0xFF3A3A3C)
    val DividerDark = Color(0xFF38383A)

    // ---- 与模式无关 ----
    val PlayButtonDark = Color(0xFF1C1C1E)    // 主播放键：深色实心底，画面唯一重色块
    val PlayButtonDarkOnDark = Color(0xFFF2F2F7)
}
