package com.qing.player.ui.screen

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.qing.player.R
import com.qing.player.data.AlbumGroup
import com.qing.player.player.PlayerViewModel
import com.qing.player.ui.component.AlbumArt
import com.qing.player.ui.component.EmptyState
import com.qing.player.ui.theme.LocalQingExtendedColors
import com.qing.player.ui.theme.QingDimen
import com.qing.player.ui.theme.SubtitleSerifStyle
import com.qing.player.ui.theme.TitleSerifStyle

/** 专辑浏览：两列卡片网格，专辑名用衬线体 */
@Composable
fun AlbumsScreen(
    viewModel: PlayerViewModel,
    onOpenPlayer: () -> Unit
) {
    val albums by viewModel.albums.collectAsState()

    if (albums.isEmpty()) {
        EmptyState(
            title = stringResource(R.string.empty_albums_title),
            message = stringResource(R.string.empty_albums_msg)
        )
        return
    }

    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        contentPadding = PaddingValues(QingDimen.SpaceM),
        verticalArrangement = Arrangement.spacedBy(QingDimen.SpaceM),
        horizontalArrangement = Arrangement.spacedBy(QingDimen.SpaceM)
    ) {
        items(albums, key = { it.albumId }) { album ->
            AlbumCard(
                album = album,
                onClick = { playAll(viewModel, album.songs, onOpenPlayer) }
            )
        }
    }
}

@Composable
private fun AlbumCard(album: AlbumGroup, onClick: () -> Unit) {
    val extended = LocalQingExtendedColors.current
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(QingDimen.RadiusCard),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(QingDimen.SpaceS),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // 专辑封面：用第一首歌的封面（补全过的优先）
            AlbumArt(
                model = album.songs.firstOrNull()?.artworkModel,
                size = 108.dp,
                cornerRadius = QingDimen.RadiusControl
            )
            Text(
                text = album.name,
                style = TitleSerifStyle,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = QingDimen.SpaceS)
            )
            Text(
                text = stringResource(R.string.album_meta, album.artist, album.songs.size),
                style = SubtitleSerifStyle,
                color = extended.textSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
