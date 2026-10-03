package com.qing.player.ui.screen

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.qing.player.data.SettingsStore
import com.qing.player.player.PlayerViewModel
import com.qing.player.ui.theme.LocalQingExtendedColors
import com.qing.player.ui.theme.QingDimen
import com.qing.player.ui.theme.TitleSerifStyle

/** 设置页：主题、重新扫描、关于 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: PlayerViewModel,
    onBack: () -> Unit
) {
    val themeMode by viewModel.themeMode.collectAsState()
    val songs by viewModel.songs.collectAsState()
    val extended = LocalQingExtendedColors.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.Filled.ArrowBack, contentDescription = "返回")
            }
            Text(
                text = "设置",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onBackground
            )
        }

        // ---- 主题 ----
        SectionTitle("主题")
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = QingDimen.SpaceM),
            horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(QingDimen.SpaceXS)
        ) {
            listOf(
                SettingsStore.THEME_LIGHT to "浅色",
                SettingsStore.THEME_DARK to "深色",
                SettingsStore.THEME_SYSTEM to "跟随系统"
            ).forEach { (mode, label) ->
                FilterChip(
                    selected = themeMode == mode,
                    onClick = { viewModel.setThemeMode(mode) },
                    label = { Text(label, style = MaterialTheme.typography.labelSmall) },
                    shape = RoundedCornerShape(QingDimen.RadiusControl),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = extended.accent.copy(alpha = 0.15f),
                        selectedLabelColor = extended.accent
                    )
                )
            }
        }

        Divider(
            color = extended.divider,
            modifier = Modifier.padding(vertical = QingDimen.SpaceM)
        )

        // ---- 曲库 ----
        SectionTitle("曲库")
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = QingDimen.SpaceM),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "共 ${songs.size} 首",
                style = MaterialTheme.typography.bodyMedium,
                color = extended.textSecondary,
                modifier = Modifier.weight(1f)
            )
            TextButton(onClick = { viewModel.scanLibrary() }) {
                Text("重新扫描", color = extended.accent)
            }
        }

        Divider(
            color = extended.divider,
            modifier = Modifier.padding(vertical = QingDimen.SpaceM)
        )

        // ---- 关于 ----
        SectionTitle("关于")
        Surface(
            color = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(QingDimen.RadiusCard),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = QingDimen.SpaceM)
        ) {
            Column(modifier = Modifier.padding(QingDimen.SpaceM)) {
                Text(
                    text = "清",
                    style = TitleSerifStyle,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "灰白极简播放器\n为索尼 Walkman（NW-A300 / ZX700 / WM1AM2）设计\nAndroid 12/13 · 无 Google Play 服务依赖",
                    style = MaterialTheme.typography.bodySmall,
                    color = extended.textSecondary,
                    modifier = Modifier.padding(top = QingDimen.SpaceXS)
                )
            }
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelMedium,
        color = LocalQingExtendedColors.current.accent,
        modifier = Modifier
            .fillMaxWidth()
            .height(QingDimen.MinTouchTarget)
            .padding(horizontal = QingDimen.SpaceM, vertical = 14.dp)
    )
}
