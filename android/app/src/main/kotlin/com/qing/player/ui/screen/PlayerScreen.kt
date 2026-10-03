package com.qing.player.ui.screen

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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.media3.common.Player
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
    val positionMs by viewModel.positionMs.collectAsState()
    val durationMs by viewModel.durationMs.collectAsState()
    val shuffle by viewModel.shuffle.collectAsState()
    val repeatMode by viewModel.repeatMode.collectAsState()
    val favorites by viewModel.favorites.collectAsState()
    val lyric by viewModel.lyrics.collectAsState()
    val sleepRemaining by viewModel.sleepRemaining.collectAsState()
    val playlists by viewModel.playlists.collectAsState()
    val extended = LocalQingExtendedColors.current

    var showSleepDialog by remember { mutableStateOf(false) }
    var showPlaylistDialog by remember { mutableStateOf(false) }

    val current = song

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = QingDimen.SpaceM)
    ) {
        // ---- 顶部返回 ----
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.Filled.ArrowBack, contentDescription = "返回")
            }
            Text(
                text = "正在播放",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onBackground
            )
        }

        if (current == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(
                    text = "还没有选择曲目",
                    style = SubtitleSerifStyle,
                    color = extended.textSecondary
                )
            }
        } else {
            PlayerBody(
                viewModel = viewModel,
                song = current,
                isPlaying = isPlaying,
                positionMs = positionMs,
                durationMs = durationMs,
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
            title = { Text("睡眠定时", style = MaterialTheme.typography.titleSmall) },
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
                            Text("$minutes 分钟后暂停")
                        }
                    }
                    TextButton(
                        onClick = {
                            viewModel.setSleepTimer(0)
                            showSleepDialog = false
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("取消定时")
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showSleepDialog = false }) { Text("关闭") }
            }
        )
    }

    if (current != null && showPlaylistDialog) {
        AlertDialog(
            onDismissRequest = { showPlaylistDialog = false },
            title = { Text("加入歌单", style = MaterialTheme.typography.titleSmall) },
            text = {
                if (playlists.isEmpty()) {
                    Text("还没有歌单，先去「歌单」页新建一个。")
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
            },
            confirmButton = {
                TextButton(onClick = { showPlaylistDialog = false }) { Text("关闭") }
            }
        )
    }
}

@Composable
private fun PlayerBody(
    viewModel: PlayerViewModel,
    song: Song,
    isPlaying: Boolean,
    positionMs: Long,
    durationMs: Long,
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
                    uri = song.albumArtUri,
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
        LyricsPanel(
            lyric = lyric,
            positionMs = positionMs,
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        )

        // ---- 进度 ----
        Slider(
            value = if (durationMs > 0) positionMs.toFloat().coerceAtMost(durationMs.toFloat()) else 0f,
            onValueChange = { viewModel.seekTo(it.toLong()) },
            valueRange = 0f..(if (durationMs > 0) durationMs.toFloat() else 1f),
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
                text = formatDuration(positionMs),
                style = MaterialTheme.typography.labelSmall,
                color = extended.textSecondary
            )
            Text(
                text = formatDuration(durationMs),
                style = MaterialTheme.typography.labelSmall,
                color = extended.textSecondary
            )
        }

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
                    contentDescription = "随机播放",
                    tint = if (shuffle) extended.accent else MaterialTheme.colorScheme.onBackground
                )
            }
            IconButton(
                onClick = viewModel::previous,
                modifier = Modifier.size(QingDimen.MinTouchTarget)
            ) {
                Icon(Icons.Filled.SkipPrevious, contentDescription = "上一曲")
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
                    contentDescription = if (isPlaying) "暂停" else "播放",
                    modifier = Modifier.size(32.dp)
                )
            }

            IconButton(
                onClick = viewModel::next,
                modifier = Modifier.size(QingDimen.MinTouchTarget)
            ) {
                Icon(Icons.Filled.SkipNext, contentDescription = "下一曲")
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
                        Player.REPEAT_MODE_ONE -> "单曲循环"
                        Player.REPEAT_MODE_ALL -> "列表循环"
                        else -> "顺序播放"
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
                    contentDescription = "收藏",
                    tint = if (isFavorite) {
                        extended.accent
                    } else MaterialTheme.colorScheme.onBackground
                )
            }
            IconButton(onClick = onShowPlaylistDialog) {
                Icon(Icons.Filled.PlaylistAdd, contentDescription = "加入歌单")
            }
            IconButton(onClick = onShowSleepDialog) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Filled.Timer,
                        contentDescription = "睡眠定时",
                        tint = if (sleepRemaining > 0) {
                            extended.accent
                        } else MaterialTheme.colorScheme.onBackground
                    )
                    if (sleepRemaining > 0) {
                        Text(
                            text = " ${sleepRemaining / 60_000}分",
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
 * 歌词面板：按播放位置高亮当前行（点缀色）并自动滚动；
 * 没有歌词时显示占位说明（支持同目录 .lrc 与内嵌歌词）。
 */
@Composable
private fun LyricsPanel(
    lyric: LrcParser.Lyric,
    positionMs: Long,
    modifier: Modifier = Modifier
) {
    val extended = LocalQingExtendedColors.current
    val lines = lyric.lines
    val listState = rememberLazyListState()
    val currentIndex = LrcParser.indexAt(lyric, positionMs)

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
                    text = "暂无歌词\n（支持同目录同名 .lrc 与内嵌歌词）",
                    style = MaterialTheme.typography.bodySmall,
                    color = extended.textSecondary,
                    textAlign = TextAlign.Center
                )
            }
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(vertical = QingDimen.SpaceM),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                itemsIndexed(lines) { index, line ->
                    val isCurrent = index == currentIndex
                    Text(
                        text = line.text,
                        style = if (isCurrent) {
                            androidx.compose.ui.text.TextStyle(
                                fontFamily = FontFamily.Serif,
                                fontSize = 17.sp,
                                lineHeight = 26.sp
                            )
                        } else SubtitleSerifStyle,
                        color = if (isCurrent) extended.accent else extended.textSecondary,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = QingDimen.SpaceL, vertical = QingDimen.SpaceXS)
                    )
                }
            }
        }
    }
}
