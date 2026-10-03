package com.qing.player.ui.component

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.qing.player.data.Song
import com.qing.player.ui.theme.LocalQingExtendedColors
import com.qing.player.ui.theme.QingDimen
import com.qing.player.ui.theme.SubtitleSerifStyle
import com.qing.player.ui.theme.TitleSerifStyle

/**
 * 底部迷你播放器。
 * 白卡片 + 顶部一条青瓷绿进度线；主播放键是画面里唯一的深色实心块。
 */
@Composable
fun MiniPlayer(
    song: Song,
    isPlaying: Boolean,
    positionMs: Long,
    durationMs: Long,
    onTogglePlayPause: () -> Unit,
    onNext: () -> Unit,
    onOpenPlayer: () -> Unit,
    modifier: Modifier = Modifier
) {
    val extended = LocalQingExtendedColors.current
    val progress = if (durationMs > 0) {
        (positionMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f)
    } else 0f

    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 2.dp
    ) {
        Column {
            LinearProgressIndicator(
                progress = progress,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(2.dp),
                color = extended.accent,
                trackColor = extended.divider
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = QingDimen.MinTouchTarget)
                    .clickable(onClick = onOpenPlayer)
                    .padding(horizontal = QingDimen.SpaceM, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(QingDimen.SpaceS)
            ) {
                AlbumArt(uri = song.albumArtUri, size = 40.dp)

                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = song.title,
                        style = TitleSerifStyle,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = song.artist,
                        style = SubtitleSerifStyle,
                        color = extended.textSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // 主播放键：深色实心圆，唯一重色块
                IconButton(
                    onClick = onTogglePlayPause,
                    modifier = Modifier.size(QingDimen.MinTouchTarget)
                ) {
                    Icon(
                        imageVector = if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        contentDescription = if (isPlaying) "暂停" else "播放",
                        tint = MaterialTheme.colorScheme.onSurface
                    )
                }
                IconButton(
                    onClick = onNext,
                    modifier = Modifier.size(QingDimen.MinTouchTarget)
                ) {
                    Icon(
                        imageVector = Icons.Filled.SkipNext,
                        contentDescription = "下一曲",
                        tint = MaterialTheme.colorScheme.onSurface
                    )
                }
            }
        }
    }
}
