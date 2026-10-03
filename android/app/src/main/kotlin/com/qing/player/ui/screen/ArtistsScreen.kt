package com.qing.player.ui.screen

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
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
import com.qing.player.data.ArtistGroup
import com.qing.player.player.PlayerViewModel
import com.qing.player.ui.component.AlbumArt
import com.qing.player.ui.component.EmptyState
import com.qing.player.ui.theme.LocalQingExtendedColors
import com.qing.player.ui.theme.QingDimen
import com.qing.player.ui.theme.SubtitleSerifStyle
import com.qing.player.ui.theme.TitleSerifStyle

/** 艺术家浏览：紧凑列表行，点击直接播放该艺术家全部曲目 */
@Composable
fun ArtistsScreen(
    viewModel: PlayerViewModel,
    onOpenPlayer: () -> Unit
) {
    val artists by viewModel.artists.collectAsState()

    if (artists.isEmpty()) {
        EmptyState(
            title = stringResource(R.string.empty_artists_title),
            message = stringResource(R.string.empty_artists_msg)
        )
        return
    }

    LazyColumn {
        items(artists, key = { it.name }) { artist ->
            ArtistRow(
                artist = artist,
                onClick = { playAll(viewModel, artist.songs, onOpenPlayer) }
            )
            Divider(
                color = LocalQingExtendedColors.current.divider,
                thickness = 0.5.dp
            )
        }
    }
}

@Composable
private fun ArtistRow(artist: ArtistGroup, onClick: () -> Unit) {
    val extended = LocalQingExtendedColors.current
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(0.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.background)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(QingDimen.RowHeight)
                .padding(horizontal = QingDimen.SpaceM),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(QingDimen.SpaceM)
        ) {
            AlbumArt(
                model = artist.songs.firstOrNull()?.artworkModel,
                size = QingDimen.ArtSize
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = artist.name,
                    style = TitleSerifStyle,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = stringResource(R.string.artist_meta, artist.albumCount, artist.songs.size),
                    style = SubtitleSerifStyle,
                    color = extended.textSecondary
                )
            }
        }
    }
}
