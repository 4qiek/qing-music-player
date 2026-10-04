package com.qing.player.ui.screen

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.PlaylistAdd
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.RepeatOne
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.media3.common.Player
import com.qing.player.R
import com.qing.player.data.AudioInfo
import com.qing.player.data.Song
import com.qing.player.player.PlayerViewModel
import com.qing.player.ui.component.AlbumArt
import com.qing.player.ui.component.formatDuration
import com.qing.player.ui.theme.HeadlineSerifStyle
import com.qing.player.ui.theme.LocalQingExtendedColors
import com.qing.player.ui.theme.QingDimen
import com.qing.player.ui.theme.SubtitleSerifStyle
import com.qing.player.util.LrcParser

/**
 * 播放页：大封面 + 歌词 + 进度 + 控制。
 *
 * 小屏适配：封面 200dp、歌词区占据剩余空间并自动滚动，
 * 主播放键是画面里唯一的深色实心块（64dp 圆形）。
 */
@Composable
fun PlayerScreen(
    viewModel: PlayerViewModel,
    onBack: () -> Unit
) {
    val song by viewModel.currentSong.collectAsState()
    val isPlaying by viewModel.isPlaying.collectAsState()
    val shuffle by viewModel.shuffle.collectAsState()
    val repeatMode by viewModel.repeatMode.collectAsState()
    val favorites by viewModel.favorites.collectAsState()
    val lyric by viewModel.lyrics.collectAsState()
    val sleepRemaining by viewModel.sleepRemaining.collectAsState()
    val playlists by viewModel.playlists.collectAsState()
    val extended = LocalQingExtendedColors.current

    var showSleepDialog by remember { mutableStateOf(false) }
    var showPlaylistDialog by remember { mutableStateOf(false) }
    var showAudioInfo by remember { mutableStateOf(false) }

    val current = song

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = QingDimen.SpaceM)
    ) {
        // ---- 顶部返回 + 音频参数 ----
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.Filled.ArrowBack, contentDescription = stringResource(R.string.back))
            }
            Text(
                text = stringResource(R.string.now_playing),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier.weight(1f)
            )
            IconButton(onClick = { showAudioInfo = true }) {
                Icon(Icons.Filled.Info, contentDescription = stringResource(R.string.audio_info))
            }
        }

        if (current == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(
                    text = stringResource(R.string.no_song_selected),
                    style = SubtitleSerifStyle,
                    color = extended.textSecondary
                )
            }
        } else {
            PlayerBody(
                viewModel = viewModel,
                song = current,
                isPlaying = isPlaying,
                shuffle = shuffle,
                repeatMode = repeatMode,
                isFavorite = favorites.contains(current.id),
                lyric = lyric,
                sleepRemaining = sleepRemaining,
                onShowSleepDialog = { showSleepDialog = true },
                onShowPlaylistDialog = { showPlaylistDialog = true }
            )
        }
    }

    if (current != null && showSleepDialog) {
        AlertDialog(
            onDismissRequest = { showSleepDialog = false },
            title = { Text(stringResource(R.string.sleep_timer), style = MaterialTheme.typography.titleSmall) },
            text = {
                Column {
                    listOf(15, 30, 60).forEach { minutes ->
                        TextButton(
                            onClick = {
                                viewModel.setSleepTimer(minutes)
                                showSleepDialog = false
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(stringResource(R.string.sleep_after_minutes, minutes))
                        }
                    }
                    TextButton(
                        onClick = {
                            viewModel.setSleepTimer(0)
                            showSleepDialog = false
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(stringResource(R.string.cancel_timer))
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showSleepDialog = false }) { Text(stringResource(R.string.close)) }
            }
        )
    }

    if (current != null && showPlaylistDialog) {
        AlertDialog(
            onDismissRequest = { showPlaylistDialog = false },
            title = { Text(stringResource(R.string.add_to_playlist), style = MaterialTheme.typography.titleSmall) },
            text = {
                Column {
                    // 下一首播放：不打断当前曲目，插队到它后面
                    TextButton(
                        onClick = {
                            viewModel.playNext(current)
                            showPlaylistDialog = false
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(stringResource(R.string.play_next))
                    }
                    if (playlists.isEmpty()) {
                        Text(stringResource(R.string.no_playlist_hint))
                    } else {
                        LazyColumn {
                            itemsIndexed(playlists) { _, playlist ->
                                TextButton(
                                    onClick = {
                                        viewModel.addSongsToPlaylist(playlist.id, listOf(current))
                                        showPlaylistDialog = false
                                    },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(playlist.name)
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showPlaylistDialog = false }) { Text(stringResource(R.string.close)) }
            }
        )
    }

    if (current != null && showAudioInfo) {
        AudioInfoDialog(viewModel = viewModel, onDismiss = { showAudioInfo = false })
    }
}

/** 音频参数详情：比特率 / 采样率 / 编码 / 声道 / 时长 / 文件大小 / 路径 */
@Composable
private fun AudioInfoDialog(viewModel: PlayerViewModel, onDismiss: () -> Unit) {
    val info by viewModel.audioInfo.collectAsState()
    val extended = LocalQingExtendedColors.current
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.audio_info), style = MaterialTheme.typography.titleSmall) },
        text = {
            val a = info
            if (a == null) {
                Text(
                    text = stringResource(R.string.audio_info_loading),
                    style = MaterialTheme.typography.bodySmall,
                    color = extended.textSecondary
                )
            } else {
                Column {
                    InfoRow(stringResource(R.string.audio_codec), a.codec ?: stringResource(R.string.audio_unknown))
                    InfoRow(stringResource(R.string.audio_bitrate), a.bitrateKbps?.let { "$it kbps" } ?: stringResource(R.string.audio_unknown))
                    InfoRow(stringResource(R.string.audio_sample_rate), a.sampleRateKhz ?: stringResource(R.string.audio_unknown))
                    InfoRow(stringResource(R.string.audio_channels), a.channelText ?: stringResource(R.string.audio_unknown))
                    InfoRow(stringResource(R.string.audio_duration), formatDuration(a.durationMs))
                    InfoRow(stringResource(R.string.audio_file_size), a.sizeText)
                    InfoRow(stringResource(R.string.audio_file_path), a.path)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.close)) }
        }
    )
}

@Composable
private fun InfoRow(label: String, value: String) {
    val extended = LocalQingExtendedColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        verticalAlignment = Alignment.Top
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = extended.textSecondary,
            modifier = Modifier.padding(end = 12.dp)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

@Composable
private fun PlayerBody(
    viewModel: PlayerViewModel,
    song: Song,
    isPlaying: Boolean,
    shuffle: Boolean,
    repeatMode: Int,
    isFavorite: Boolean,
    lyric: LrcParser.Lyric,
    sleepRemaining: Long,
    onShowSleepDialog: () -> Unit,
    onShowPlaylistDialog: () -> Unit
) {
    val extended = LocalQingExtendedColors.current

    Column(modifier = Modifier.fillMaxSize()) {
        // ---- 封面 ----
        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Card(
                shape = RoundedCornerShape(QingDimen.RadiusPanel),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                AlbumArt(
                    // 优先用联网补全的封面，没有再回到 MediaStore 的内嵌封面
                    model = song.artworkModel,
                    size = 200.dp,
                    cornerRadius = QingDimen.RadiusPanel,
                    modifier = Modifier.padding(QingDimen.SpaceS)
                )
            }
        }

        Spacer(Modifier.height(QingDimen.SpaceM))

        // ---- 歌名 / 艺术家：作品名用衬线体 ----
        Text(
            text = song.title,
            style = HeadlineSerifStyle,
            color = MaterialTheme.colorScheme.onBackground,
            maxLines = 1,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
            overflow = TextOverflow.Ellipsis
        )
        Text(
            text = "${song.artist} · ${song.album}",
            style = SubtitleSerifStyle,
            color = extended.textSecondary,
            maxLines = 1,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
            overflow = TextOverflow.Ellipsis
        )

        Spacer(Modifier.height(QingDimen.SpaceS))

        // ---- 歌词 ----
        // 位置、进度同样由子组件各自订阅，父级 PlayerBody 不会因为 0.5 秒一次的
        // 进度刷新而整体重组（否则 200dp 封面会被反复重新装载）。
        LyricsPanel(
            lyric = lyric,
            viewModel = viewModel,
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        )

        // ---- 进度 ----
        PlayerSeekBar(viewModel = viewModel)

        // ---- 控制区 ----
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            IconButton(
                onClick = viewModel::toggleShuffle,
                modifier = Modifier.size(QingDimen.MinTouchTarget)
            ) {
                Icon(
                    Icons.Filled.Shuffle,
                    contentDescription = stringResource(R.string.shuffle),
                    tint = if (shuffle) extended.accent else MaterialTheme.colorScheme.onBackground
                )
            }
            IconButton(
                onClick = viewModel::previous,
                modifier = Modifier.size(QingDimen.MinTouchTarget)
            ) {
                Icon(Icons.Filled.SkipPrevious, contentDescription = stringResource(R.string.previous))
            }

            // 主播放键：深色实心圆，画面唯一重色块
            FilledIconButton(
                onClick = viewModel::togglePlayPause,
                modifier = Modifier.size(64.dp),
                shape = CircleShape,
                colors = IconButtonDefaults.filledIconButtonColors(
                    containerColor = extended.playButtonBackground,
                    contentColor = extended.playButtonContent
                )
            ) {
                Icon(
                    imageVector = if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                    contentDescription = if (isPlaying) {
                        stringResource(R.string.pause)
                    } else stringResource(R.string.play),
                    modifier = Modifier.size(32.dp)
                )
            }

            IconButton(
                onClick = viewModel::next,
                modifier = Modifier.size(QingDimen.MinTouchTarget)
            ) {
                Icon(Icons.Filled.SkipNext, contentDescription = stringResource(R.string.next))
            }
            IconButton(
                onClick = viewModel::cycleRepeatMode,
                modifier = Modifier.size(QingDimen.MinTouchTarget)
            ) {
                Icon(
                    imageVector = if (repeatMode == Player.REPEAT_MODE_ONE) {
                        Icons.Filled.RepeatOne
                    } else Icons.Filled.Repeat,
                    contentDescription = when (repeatMode) {
                        Player.REPEAT_MODE_ONE -> stringResource(R.string.repeat_one)
                        Player.REPEAT_MODE_ALL -> stringResource(R.string.repeat_all)
                        else -> stringResource(R.string.repeat_off)
                    },
                    tint = if (repeatMode == Player.REPEAT_MODE_OFF) {
                        MaterialTheme.colorScheme.onBackground
                    } else extended.accent
                )
            }
        }

        // ---- 收藏 / 加入歌单 / 睡眠定时 ----
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = QingDimen.SpaceS),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = { viewModel.toggleFavorite(song) }) {
                Icon(
                    imageVector = if (isFavorite) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                    contentDescription = stringResource(R.string.favorite),
                    tint = if (isFavorite) {
                        extended.accent
                    } else MaterialTheme.colorScheme.onBackground
                )
            }
            IconButton(onClick = onShowPlaylistDialog) {
                Icon(Icons.Filled.PlaylistAdd, contentDescription = stringResource(R.string.add_to_playlist))
            }
            IconButton(onClick = onShowSleepDialog) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Filled.Timer,
                        contentDescription = stringResource(R.string.sleep_timer),
                        tint = if (sleepRemaining > 0) {
                            extended.accent
                        } else MaterialTheme.colorScheme.onBackground
                    )
                    if (sleepRemaining > 0) {
                        Text(
                            text = stringResource(R.string.sleep_remaining_minutes, sleepRemaining / 60_000),
                            style = MaterialTheme.typography.labelSmall,
                            color = extended.accent
                        )
                    }
                }
            }
        }
    }
}

/**
 * 播放进度条。
 *
 * 两个性能要点：
 * 1. positionMs 在这里订阅，不在父级订阅，避免 0.5 秒一次把整页重组。
 * 2. 拖动过程中只改**本地状态** `scrubValue`，松手（onValueChangeFinished）
 *    才真正 seekTo。之前的写法是 onValueChange 直接 seekTo，手指每移动一帧
 *    就向 ExoPlayer 发一次 seek 请求——在嵌入式设备上这是最典型的卡顿来源，
 *    因为它要反复冲刷缓冲区、重新定位解码器。
 */
@Composable
private fun PlayerSeekBar(
    viewModel: PlayerViewModel,
    modifier: Modifier = Modifier
) {
    val extended = LocalQingExtendedColors.current
    val positionMs by viewModel.positionMs.collectAsState()
    val durationMs by viewModel.durationMs.collectAsState()

    var scrubValue by remember { mutableStateOf<Float?>(null) }

    val maxValue = if (durationMs > 0) durationMs.toFloat() else 1f
    val shownValue = scrubValue ?: positionMs.toFloat().coerceIn(0f, maxValue)

    Column(modifier = modifier.fillMaxWidth()) {
        Slider(
            value = shownValue,
            onValueChange = { scrubValue = it.coerceIn(0f, maxValue) },
            onValueChangeFinished = {
                scrubValue?.let { viewModel.seekTo(it.toLong()) }
                scrubValue = null
            },
            valueRange = 0f..maxValue,
            modifier = Modifier.fillMaxWidth(),
            colors = SliderDefaults.colors(
                thumbColor = extended.accent,
                activeTrackColor = extended.accent,
                inactiveTrackColor = extended.divider
            )
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = formatDuration(shownValue.toLong()),
                style = MaterialTheme.typography.labelSmall,
                color = extended.textSecondary
            )
            Text(
                text = formatDuration(durationMs),
                style = MaterialTheme.typography.labelSmall,
                color = extended.textSecondary
            )
        }
    }
}

/**
 * 歌词面板：播放页中部的独立卡片区域（封面与标题之下、进度条之上）。
 * - 有歌词：当前行用点缀色放大高亮并自动滚动；**点击任意行跳转到该句**；
 *   面板顶部有「延迟校准」行，±0.5s 微调歌词整体偏移（对齐不准时用）。
 * - 没有歌词：显示占位说明（支持同目录 .lrc 与联网匹配）。
 */
@Composable
private fun LyricsPanel(
    lyric: LrcParser.Lyric,
    viewModel: PlayerViewModel,
    modifier: Modifier = Modifier
) {
    val extended = LocalQingExtendedColors.current
    val lines = lyric.lines
    val listState = rememberLazyListState()
    val positionMs by viewModel.positionMs.collectAsState()
    val userOffsetMs by viewModel.lyricOffsetMs.collectAsState()
    // 文件自带 [offset:] 标签与用户手动微调叠加生效
    val totalOffset = lyric.offsetMs + userOffsetMs
    val currentIndex = remember(lines, positionMs / 200L, totalOffset) {
        LrcParser.indexAt(lines, positionMs + totalOffset)
    }

    LaunchedEffect(currentIndex) {
        if (currentIndex >= 0) {
            listState.animateScrollToItem(currentIndex)
        }
    }

    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(QingDimen.RadiusPanel)
    ) {
        if (lines.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(
                    text = stringResource(R.string.no_lyrics_hint),
                    style = MaterialTheme.typography.bodySmall,
                    color = extended.textSecondary,
                    textAlign = TextAlign.Center
                )
            }
        } else {
            Column(Modifier.fillMaxSize()) {
                // ---- 延迟校准行：歌词快了/慢了在这里对齐 ----
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = QingDimen.SpaceS),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = stringResource(R.string.lyrics),
                        style = MaterialTheme.typography.labelMedium,
                        color = extended.textSecondary
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        TextButton(onClick = { viewModel.adjustLyricOffset(-500) }) {
                            Text(stringResource(R.string.lyric_offset_back), style = MaterialTheme.typography.labelSmall)
                        }
                        Text(
                            text = formatOffset(userOffsetMs),
                            style = MaterialTheme.typography.labelSmall,
                            color = if (userOffsetMs != 0) extended.accent else extended.textSecondary
                        )
                        TextButton(onClick = { viewModel.adjustLyricOffset(500) }) {
                            Text(stringResource(R.string.lyric_offset_forward), style = MaterialTheme.typography.labelSmall)
                        }
                        if (userOffsetMs != 0) {
                            TextButton(onClick = viewModel::resetLyricOffset) {
                                Text(stringResource(R.string.lyric_offset_reset), style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(
                        start = QingDimen.SpaceL,
                        end = QingDimen.SpaceL,
                        top = QingDimen.SpaceXS,
                        bottom = QingDimen.SpaceM
                    ),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    itemsIndexed(lines) { index, line ->
                        val isCurrent = index == currentIndex
                        Text(
                            text = line.text,
                            style = if (isCurrent) {
                                androidx.compose.ui.text.TextStyle(
                                    fontFamily = FontFamily.Serif,
                                    fontSize = 18.sp,
                                    lineHeight = 27.sp
                                )
                            } else SubtitleSerifStyle,
                            color = if (isCurrent) extended.accent else extended.textSecondary,
                            textAlign = TextAlign.Center,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    // 跳到「这一句刚好成为当前行」的进度位置（把偏移算回去）
                                    viewModel.seekTo((line.timeMs - totalOffset).coerceAtLeast(0L))
                                }
                                .padding(vertical = QingDimen.SpaceXS)
                        )
                    }
                }
            }
        }
    }
}

/** 偏移展示：正数 = 歌词延后 */
private fun formatOffset(ms: Int): String {
    if (ms == 0) return "±0.0s"
    val s = ms / 1000.0
    return (if (s > 0) "+" else "") + "%.1fs".format(s)
}
