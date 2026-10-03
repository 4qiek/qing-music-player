package com.qing.player.ui.screen

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.qing.player.data.SettingsStore
import com.qing.player.player.PlayerViewModel
import com.qing.player.ui.theme.LocalQingExtendedColors
import com.qing.player.ui.theme.QingDimen

/**
 * 均衡器页面。
 *
 * 用的是安卓系统级 EQ（android.media.audiofx.Equalizer），
 * 与厂商私有音效引擎无关——那些只有厂商自带播放器能调用。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EqualizerScreen(
    viewModel: PlayerViewModel,
    onBack: () -> Unit
) {
    val enabled by viewModel.eqEnabled.collectAsState()
    val presetIndex by viewModel.eqPresetIndex.collectAsState()
    val levels by viewModel.eqLevels.collectAsState()
    val extended = LocalQingExtendedColors.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(bottom = QingDimen.SpaceL)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.Filled.ArrowBack, contentDescription = "返回")
            }
            Text(
                text = "均衡器",
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.weight(1f),
                color = MaterialTheme.colorScheme.onBackground
            )
            Switch(
                checked = enabled,
                onCheckedChange = { viewModel.setEqEnabled(it) },
                colors = SwitchDefaults.colors(
                    checkedThumbColor = extended.accent,
                    checkedTrackColor = extended.accent.copy(alpha = 0.4f)
                )
            )
        }

        // ---- 说明：这是系统级 EQ，不是厂商私有音效引擎 ----
        Surface(
            color = MaterialTheme.colorScheme.surfaceVariant,
            shape = RoundedCornerShape(QingDimen.RadiusControl),
            modifier = Modifier
                .fillMaxWidth()
                .padding(QingDimen.SpaceM)
        ) {
            Text(
                text = "这是安卓系统级 EQ，与厂商自带的私有音效引擎无关（后者仅自带播放器可用）。",
                style = MaterialTheme.typography.labelSmall,
                color = extended.textSecondary,
                modifier = Modifier.padding(QingDimen.SpaceM)
            )
        }

        // ---- 预设 ----
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = QingDimen.SpaceM),
            horizontalArrangement = Arrangement.spacedBy(QingDimen.SpaceXS)
        ) {
            SettingsStore.PRESET_NAMES.forEachIndexed { index, name ->
                FilterChip(
                    selected = presetIndex == index,
                    onClick = { viewModel.applyEqPreset(index) },
                    label = { Text(name, style = MaterialTheme.typography.labelSmall) },
                    shape = RoundedCornerShape(QingDimen.RadiusControl),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = extended.accent.copy(alpha = 0.15f),
                        selectedLabelColor = extended.accent
                    )
                )
            }
        }

        // ---- 十段滑杆 ----
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = QingDimen.SpaceM)
        ) {
            SettingsStore.EQ_FREQUENCIES.forEachIndexed { index, freq ->
                val value = levels.getOrElse(index) { 0 }.toFloat()
                // 拖动中使用本地状态，松手才落盘。理由同播放进度条：
                // 逐帧写 SharedPreferences + 重建整段数组，是低配设备上最直观的卡顿来源。
                var dragValue by remember(index, value) { mutableStateOf<Float?>(null) }
                val shown = dragValue ?: value.coerceIn(MIN_LEVEL.toFloat(), MAX_LEVEL.toFloat())
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = QingDimen.SpaceM, vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = formatFrequency(freq),
                        style = MaterialTheme.typography.labelSmall,
                        color = extended.textSecondary,
                        modifier = Modifier.width(44.dp)
                    )
                    Slider(
                        value = shown,
                        onValueChange = {
                            dragValue = it
                            // 只作用于音效，实时可听；不写盘、不推状态
                            viewModel.previewEqBand(index, it.toInt())
                        },
                        onValueChangeFinished = {
                            dragValue?.let { viewModel.setEqBand(index, it.toInt()) }
                            dragValue = null
                        },
                        valueRange = MIN_LEVEL.toFloat()..MAX_LEVEL.toFloat(),
                        steps = 30,
                        enabled = enabled,
                        modifier = Modifier.weight(1f),
                        colors = SliderDefaults.colors(
                            thumbColor = extended.accent,
                            activeTrackColor = extended.accent,
                            inactiveTrackColor = extended.divider,
                            disabledThumbColor = extended.textSecondary,
                            disabledActiveTrackColor = extended.textSecondary,
                            disabledInactiveTrackColor = extended.divider
                        )
                    )
                    Text(
                        text = formatGain(shown.toInt()),
                        style = MaterialTheme.typography.labelSmall,
                        color = extended.textSecondary,
                        modifier = Modifier.width(48.dp)
                    )
                }
            }
        }
    }
}

private const val MIN_LEVEL = -1500
private const val MAX_LEVEL = 1500

private fun formatFrequency(hz: Int): String =
    if (hz >= 1000) "${hz / 1000}k" else "$hz"

private fun formatGain(millibel: Int): String {
    val db = millibel / 100.0
    return (if (db > 0) "+" else "") + "%.1f".format(db)
}
