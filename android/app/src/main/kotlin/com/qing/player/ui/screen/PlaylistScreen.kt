package com.qing.player.ui.screen

import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt
import com.qing.player.R
import com.qing.player.data.Song
import com.qing.player.player.PlayerViewModel
import com.qing.player.ui.component.EmptyState
import com.qing.player.ui.component.SongRow
import com.qing.player.ui.theme.LocalQingExtendedColors
import com.qing.player.ui.theme.QingDimen
import com.qing.player.ui.theme.TitleSerifStyle

/**
 * 歌单页：新建 / 打开 / 删除歌单，歌单内曲目可播放与移除。
 * 歌单里只存 MediaStore 的歌曲 id，展示时再与曲库关联。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlaylistScreen(
    viewModel: PlayerViewModel,
    onOpenPlayer: () -> Unit
) {
    val playlists by viewModel.playlists.collectAsState()
    val songsById by viewModel.songsById.collectAsState()
    var selectedId by remember { mutableStateOf<Long?>(null) }
    var showCreateDialog by remember { mutableStateOf(false) }
    val extended = LocalQingExtendedColors.current

    Column(Modifier.fillMaxSize()) {
        // 新建歌单
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(QingDimen.MinTouchTarget)
                .clickable { showCreateDialog = true }
                .padding(horizontal = QingDimen.SpaceM),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Filled.Add, contentDescription = null, tint = extended.accent)
            Text(
                text = stringResource(R.string.new_playlist),
                style = MaterialTheme.typography.labelLarge,
                color = extended.accent,
                modifier = Modifier.padding(start = QingDimen.SpaceS)
            )
        }
        Divider(color = extended.divider, thickness = 0.5.dp)

        if (selectedId == null) {
            if (playlists.isEmpty()) {
                EmptyState(
                    title = stringResource(R.string.empty_playlist),
                    message = stringResource(R.string.empty_playlist_msg)
                )
            } else {
                LazyColumn(Modifier.fillMaxSize()) {
                    items(playlists, key = { it.id }) { playlist ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(QingDimen.RowHeight)
                                .clickable { selectedId = playlist.id }
                                .padding(horizontal = QingDimen.SpaceM),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = playlist.name,
                                style = TitleSerifStyle,
                                color = MaterialTheme.colorScheme.onSurface,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            IconButton(onClick = { viewModel.deletePlaylist(playlist.id) }) {
                                Icon(Icons.Filled.Delete, contentDescription = stringResource(R.string.delete_playlist))
                            }
                        }
                        Divider(color = extended.divider, thickness = 0.5.dp)
                    }
                }
            }
        } else {
            PlaylistDetail(
                viewModel = viewModel,
                playlistId = selectedId!!,
                songsById = songsById,
                onBack = { selectedId = null },
                onOpenPlayer = onOpenPlayer
            )
        }
    }

    if (showCreateDialog) {
        var name by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showCreateDialog = false },
            title = { Text(stringResource(R.string.new_playlist), style = MaterialTheme.typography.titleSmall) },
            text = {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    singleLine = true,
                    placeholder = { Text(stringResource(R.string.playlist_name_hint)) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = extended.accent,
                        unfocusedBorderColor = extended.outline
                    )
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    val trimmed = name.trim()
                    if (trimmed.isNotEmpty()) viewModel.createPlaylist(trimmed)
                    showCreateDialog = false
                }) { Text(stringResource(R.string.create)) }
            },
            dismissButton = {
                TextButton(onClick = { showCreateDialog = false }) { Text(stringResource(R.string.cancel)) }
            }
        )
    }
}

@Composable
private fun PlaylistDetail(
    viewModel: PlayerViewModel,
    playlistId: Long,
    songsById: Map<Long, Song>,
    onBack: () -> Unit,
    onOpenPlayer: () -> Unit
) {
    val ids by viewModel.observePlaylistSongIds(playlistId).collectAsState(initial = emptyList())
    val currentSong by viewModel.currentSong.collectAsState()
    val favorites by viewModel.favorites.collectAsState()
    val extended = LocalQingExtendedColors.current
    val density = LocalDensity.current

    // 拖拽工作副本：ids 变化（落盘后回流）时重建，拖拽中本地即时重排。
    val ordered = remember(ids) {
        mutableStateListOf<Song>().apply { addAll(ids.mapNotNull { songsById[it] }) }
    }
    var dragFromIndex by remember { mutableStateOf<Int?>(null) }
    var dragIndex by remember { mutableStateOf<Int?>(null) }
    var dragOffsetY by remember { mutableStateOf(0f) }
    val rowHeightPx = with(density) { QingDimen.RowHeight.toPx() }

    Column(Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(QingDimen.MinTouchTarget)
                .padding(horizontal = QingDimen.SpaceS),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.Filled.ArrowBack, contentDescription = stringResource(R.string.back))
            }
            Text(
                text = stringResource(R.string.playlist_count, ordered.size),
                style = MaterialTheme.typography.bodySmall,
                color = extended.textSecondary,
                modifier = Modifier.weight(1f)
            )
            IconButton(
                onClick = {
                    if (ordered.isNotEmpty()) {
                        viewModel.playQueue(ordered, 0)
                        onOpenPlayer()
                    }
                }
            ) {
                Icon(Icons.Filled.PlayArrow, contentDescription = stringResource(R.string.play_all))
            }
        }

        if (ordered.isEmpty()) {
            EmptyState(
                title = stringResource(R.string.empty_playlist_detail_title),
                message = stringResource(R.string.empty_playlist_detail_msg)
            )
        } else {
            LazyColumn(Modifier.fillMaxSize()) {
                itemsIndexed(
                    items = ordered,
                    key = { _, s -> s.id },
                    contentType = { _, _ -> SongRowContentType }
                ) { index, song ->
                    val isDragging = index == dragIndex
                    SongRow(
                        song = song,
                        isPlaying = currentSong?.id == song.id,
                        isFavorite = favorites.contains(song.id),
                        onClick = {
                            viewModel.playQueue(ordered, index)
                            onOpenPlayer()
                        },
                        modifier = Modifier
                            .then(
                                if (isDragging) {
                                    Modifier
                                        .offset { IntOffset(0, dragOffsetY.roundToInt()) }
                                        .graphicsLayer { alpha = 0.85f }
                                } else Modifier
                            )
                            .pointerInput(ordered) {
                                detectDragGesturesAfterLongPress(
                                    onDragStart = {
                                        dragFromIndex = index
                                        dragIndex = index
                                        dragOffsetY = 0f
                                    },
                                    onDrag = { _, dragAmount ->
                                        val di = dragIndex
                                            ?: return@detectDragGesturesAfterLongPress
                                        dragOffsetY += dragAmount.y
                                        val target = (di + (dragOffsetY / rowHeightPx).roundToInt())
                                            .coerceIn(0, ordered.lastIndex)
                                        if (target != di && target in ordered.indices) {
                                            val moved = ordered.removeAt(di)
                                            ordered.add(target, moved)
                                            dragOffsetY -= (target - di) * rowHeightPx
                                            dragIndex = target
                                        }
                                    },
                                    onDragEnd = {
                                        val from = dragFromIndex
                                        val to = dragIndex
                                        if (from != null && to != null && from != to) {
                                            viewModel.movePlaylistSong(playlistId, from, to)
                                        }
                                        dragFromIndex = null
                                        dragIndex = null
                                        dragOffsetY = 0f
                                    },
                                    onDragCancel = {
                                        dragFromIndex = null
                                        dragIndex = null
                                        dragOffsetY = 0f
                                    }
                                )
                            }
                    ) {
                        IconButton(onClick = { viewModel.removeSongFromPlaylist(playlistId, song.id) }) {
                            Icon(
                                Icons.Filled.Delete,
                                contentDescription = stringResource(R.string.remove_from_playlist),
                                tint = extended.textSecondary
                            )
                        }
                    }
                    Divider(color = extended.divider, thickness = 0.5.dp)
                }
            }
        }
    }
}
