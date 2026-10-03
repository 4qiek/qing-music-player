package com.qing.player.ui.screen

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.qing.player.data.Song
import com.qing.player.player.PlayerViewModel
import com.qing.player.ui.component.EmptyState
import com.qing.player.ui.component.SongRow
import com.qing.player.ui.theme.LocalQingExtendedColors
import com.qing.player.ui.theme.QingDimen

/**
 * 歌曲列表页：全部曲目 + 顶部搜索框（按歌名 / 艺术家 / 专辑过滤）。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SongsScreen(
    viewModel: PlayerViewModel,
    onOpenPlayer: () -> Unit
) {
    val songs by viewModel.songs.collectAsState()
    val currentSong by viewModel.currentSong.collectAsState()
    val favorites by viewModel.favorites.collectAsState()
    var query by remember { mutableStateOf("") }

    val filtered = remember(songs, query) {
        if (query.isBlank()) songs else {
            val q = query.trim().lowercase()
            songs.filter {
                it.title.lowercase().contains(q) ||
                    it.artist.lowercase().contains(q) ||
                    it.album.lowercase().contains(q)
            }
        }
    }

    Column(Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = QingDimen.SpaceM, vertical = QingDimen.SpaceS),
            placeholder = {
                Text("搜索歌曲 / 艺术家 / 专辑", style = MaterialTheme.typography.bodySmall)
            },
            singleLine = true,
            textStyle = MaterialTheme.typography.bodyMedium,
            shape = androidx.compose.foundation.shape.RoundedCornerShape(QingDimen.RadiusControl),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = LocalQingExtendedColors.current.accent,
                unfocusedBorderColor = LocalQingExtendedColors.current.outline
            )
        )

        if (filtered.isEmpty()) {
            EmptyState(
                title = "曲库为空",
                message = if (songs.isEmpty()) {
                    "未扫描到音乐文件，请在设置中重新扫描或检查权限。"
                } else {
                    "没有匹配「$query」的曲目。"
                }
            )
        } else {
            LazyColumn(Modifier.fillMaxSize()) {
                itemsIndexed(
                    items = filtered,
                    key = { _, s -> s.id },
                    // contentType 让 Compose 在复用时按类型挑选槽位，滚动时减少重新组合。
                    contentType = { _, _ -> SongRowContentType }
                ) { index, song ->
                    SongRow(
                        song = song,
                        isPlaying = currentSong?.id == song.id,
                        isFavorite = favorites.contains(song.id),
                        onClick = {
                            viewModel.playQueue(filtered, index)
                            onOpenPlayer()
                        }
                    )
                    Divider(
                        color = LocalQingExtendedColors.current.divider,
                        thickness = 0.5.dp
                    )
                }
            }
        }
    }
}

/** 供其它页复用：播放一组曲目 */
internal fun playAll(viewModel: PlayerViewModel, songs: List<Song>, onOpenPlayer: () -> Unit) {
    if (songs.isEmpty()) return
    viewModel.playQueue(songs, 0)
    onOpenPlayer()
}

/** LazyColumn 的 contentType 标记：歌曲行统一用这一种，便于列表复用 */
internal const val SongRowContentType = "song_row"
