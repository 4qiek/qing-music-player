package com.qing.player.ui.screen

import android.app.Activity
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.qing.player.R
import com.qing.player.data.SettingsStore
import com.qing.player.player.PlayerViewModel
import com.qing.player.ui.theme.LocalQingExtendedColors
import com.qing.player.ui.theme.QingDimen
import com.qing.player.ui.theme.TitleSerifStyle

/**
 * 设置页。
 *
 * 分区：外观（主题 / 语言 / 字体）/ 曲库 / 浏览 / 在线匹配 / 关于。
 *
 * 注意「按文件夹浏览」这一项：文件夹页默认**不占**底部标签栏，入口收在这里，
 * 想要的人可以用下面的开关把它放回底部。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: PlayerViewModel,
    onBack: () -> Unit,
    onOpenFolders: () -> Unit
) {
    val themeMode by viewModel.themeMode.collectAsState()
    val language by viewModel.language.collectAsState()
    val fontFamily by viewModel.fontFamily.collectAsState()
    val fontScale by viewModel.fontScale.collectAsState()
    val showFolderTab by viewModel.showFolderTab.collectAsState()
    val onlineEnabled by viewModel.onlineMatchEnabled.collectAsState()
    val matchProgress by viewModel.matchProgress.collectAsState()
    val songs by viewModel.songs.collectAsState()
    val extended = LocalQingExtendedColors.current
    val context = LocalContext.current

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
                Icon(
                    Icons.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.back)
                )
            }
            Text(
                text = stringResource(R.string.settings_title),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onBackground
            )
        }

        // ---------------- 外观 ----------------
        SectionTitle(stringResource(R.string.section_appearance))

        SettingLabel(stringResource(R.string.theme))
        ChipRow(
            items = listOf(
                SettingsStore.THEME_LIGHT to R.string.theme_light,
                SettingsStore.THEME_DARK to R.string.theme_dark,
                SettingsStore.THEME_SYSTEM to R.string.theme_system
            ),
            selected = themeMode,
            onSelect = viewModel::setThemeMode
        )

        SettingLabel(stringResource(R.string.language))
        ChipRow(
            items = listOf(
                SettingsStore.LANG_SYSTEM to R.string.lang_system,
                SettingsStore.LANG_ZH to R.string.lang_zh,
                SettingsStore.LANG_EN to R.string.lang_en
            ),
            selected = language,
            onSelect = { tag ->
                if (tag != language) {
                    viewModel.setLanguage(tag)
                    // 语言只走 attachBaseContext，改完必须重建 Activity 才生效
                    (context as? Activity)?.recreate()
                }
            }
        )

        SettingLabel(stringResource(R.string.font_style))
        ChipRow(
            items = listOf(
                SettingsStore.FONT_SERIF to R.string.font_serif,
                SettingsStore.FONT_SANS to R.string.font_sans
            ),
            selected = fontFamily,
            onSelect = viewModel::setFontFamily
        )

        SettingLabel(stringResource(R.string.font_size))
        ChipRow(
            items = listOf(
                SettingsStore.FONT_SCALES[0] to R.string.font_small,
                SettingsStore.FONT_SCALES[1] to R.string.font_normal,
                SettingsStore.FONT_SCALES[2] to R.string.font_large,
                SettingsStore.FONT_SCALES[3] to R.string.font_xlarge
            ),
            selected = fontScale,
            onSelect = viewModel::setFontScale
        )

        Divider(
            color = extended.divider,
            modifier = Modifier.padding(vertical = QingDimen.SpaceM)
        )

        // ---------------- 曲库 ----------------
        SectionTitle(stringResource(R.string.section_library))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = QingDimen.SpaceM),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = stringResource(R.string.library_count, songs.size),
                style = MaterialTheme.typography.bodyMedium,
                color = extended.textSecondary,
                modifier = Modifier.weight(1f)
            )
            TextButton(onClick = { viewModel.scanLibrary() }) {
                Text(stringResource(R.string.rescan), color = extended.accent)
            }
        }

        Divider(
            color = extended.divider,
            modifier = Modifier.padding(vertical = QingDimen.SpaceM)
        )

        // ---------------- 浏览 ----------------
        SectionTitle(stringResource(R.string.section_browse))
        ActionRow(
            title = stringResource(R.string.browse_folders),
            desc = stringResource(R.string.browse_folders_desc),
            onClick = onOpenFolders
        )
        SwitchRow(
            title = stringResource(R.string.show_folder_tab),
            checked = showFolderTab,
            onCheckedChange = viewModel::setShowFolderTab
        )

        Divider(
            color = extended.divider,
            modifier = Modifier.padding(vertical = QingDimen.SpaceM)
        )

        // ---------------- 在线匹配 ----------------
        SectionTitle(stringResource(R.string.section_online))
        SwitchRow(
            title = stringResource(R.string.online_match_title),
            desc = stringResource(R.string.online_match_desc),
            checked = onlineEnabled,
            onCheckedChange = viewModel::setOnlineMatchEnabled
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = QingDimen.SpaceM, vertical = QingDimen.SpaceXS),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = matchStatusText(onlineEnabled, matchProgress),
                style = MaterialTheme.typography.bodySmall,
                color = extended.textSecondary,
                modifier = Modifier.weight(1f)
            )
            if (onlineEnabled) {
                val running = matchProgress != null &&
                    matchProgress!!.done < matchProgress!!.total
                TextButton(
                    onClick = { viewModel.matchMissingMetadata() },
                    enabled = !running
                ) {
                    Text(
                        stringResource(R.string.online_match_now),
                        color = if (running) extended.textSecondary else extended.accent
                    )
                }
            }
        }

        Divider(
            color = extended.divider,
            modifier = Modifier.padding(vertical = QingDimen.SpaceM)
        )

        // ---------------- 关于 ----------------
        SectionTitle(stringResource(R.string.section_about))
        Surface(
            color = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(QingDimen.RadiusCard),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = QingDimen.SpaceM)
        ) {
            Column(modifier = Modifier.padding(QingDimen.SpaceM)) {
                Text(
                    text = stringResource(R.string.app_name),
                    style = TitleSerifStyle,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = stringResource(R.string.about_text),
                    style = MaterialTheme.typography.bodySmall,
                    color = extended.textSecondary,
                    modifier = Modifier.padding(top = QingDimen.SpaceXS)
                )
            }
        }

        SpacerBottom()
    }
}

@Composable
private fun matchStatusText(
    enabled: Boolean,
    progress: com.qing.player.player.MatchProgress?
): String = when {
    !enabled -> stringResource(R.string.online_match_off)
    // 没开工：说明文案已经在上面开关那行显示过了，这里不再重复一遍
    progress == null -> ""
    progress.offline -> stringResource(R.string.online_match_fail)
    progress.total == 0 -> stringResource(R.string.online_match_none)
    progress.done < progress.total ->
        stringResource(R.string.online_match_matching, progress.done, progress.total)
    else -> stringResource(R.string.online_match_done, progress.matched)
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

@Composable
private fun SettingLabel(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodySmall,
        color = LocalQingExtendedColors.current.textSecondary,
        modifier = Modifier.padding(
            horizontal = QingDimen.SpaceM,
            vertical = QingDimen.SpaceXS
        )
    )
}

/** 一排单选 chip，泛型化后主题/语言/字体/字号四组都能复用 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun <T> ChipRow(
    items: List<Pair<T, Int>>,
    selected: T,
    onSelect: (T) -> Unit
) {
    val extended = LocalQingExtendedColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = QingDimen.SpaceM),
        horizontalArrangement = Arrangement.spacedBy(QingDimen.SpaceXS)
    ) {
        items.forEach { (value, labelRes) ->
            FilterChip(
                selected = selected == value,
                onClick = { onSelect(value) },
                label = {
                    Text(stringResource(labelRes), style = MaterialTheme.typography.labelSmall)
                },
                shape = RoundedCornerShape(QingDimen.RadiusControl),
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = extended.accent.copy(alpha = 0.15f),
                    selectedLabelColor = extended.accent
                )
            )
        }
    }
}

/** 带说明的开关行 */
@Composable
private fun SwitchRow(
    title: String,
    desc: String? = null,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    val extended = LocalQingExtendedColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onCheckedChange(!checked) }
            .padding(horizontal = QingDimen.SpaceM, vertical = QingDimen.SpaceS),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground
            )
            if (!desc.isNullOrBlank()) {
                Text(
                    text = desc,
                    style = MaterialTheme.typography.labelSmall,
                    color = extended.textSecondary,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = extended.accent,
                checkedTrackColor = extended.accent.copy(alpha = 0.4f)
            )
        )
    }
}

/** 可点进去的入口行 */
@Composable
private fun ActionRow(
    title: String,
    desc: String? = null,
    onClick: () -> Unit
) {
    val extended = LocalQingExtendedColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = QingDimen.SpaceM, vertical = QingDimen.SpaceS),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground
            )
            if (!desc.isNullOrBlank()) {
                Text(
                    text = desc,
                    style = MaterialTheme.typography.labelSmall,
                    color = extended.textSecondary,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
        }
        Icon(
            Icons.Filled.ChevronRight,
            contentDescription = null,
            tint = extended.textSecondary
        )
    }
}

@Composable
private fun SpacerBottom() {
    androidx.compose.foundation.layout.Spacer(
        modifier = Modifier
            .fillMaxWidth()
            .height(QingDimen.SpaceL)
    )
}
