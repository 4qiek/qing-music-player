package com.qing.player.ui.screen

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material3.Divider
import androidx.compose.material3.Icon
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
import com.qing.player.data.FolderGroup
import com.qing.player.player.PlayerViewModel
import com.qing.player.ui.component.EmptyState
import com.qing.player.ui.theme.LocalQingExtendedColors
import com.qing.player.ui.theme.QingDimen
import com.qing.player.ui.theme.SubtitleSerifStyle
import com.qing.player.ui.theme.TitleSerifStyle

/**
 * 文件夹浏览。
 *
 * 很多人习惯按文件夹听（尤其是自己整理的无标签专辑），
 * 所以这里把目录路径作为一级入口，并显示完整路径方便辨认内置存储与 SD 卡。
 */
@Composable
fun FoldersScreen(
    viewModel: PlayerViewModel,
    onOpenPlayer: () -> Unit
) {
    val folders by viewModel.folders.collectAsState()

    if (folders.isEmpty()) {
        EmptyState(
            title = stringResource(R.string.empty_folders_title),
            message = stringResource(R.string.empty_folders_msg)
        )
        return
    }

    LazyColumn {
        items(folders, key = { it.path }) { folder ->
            FolderRow(
                folder = folder,
                onClick = { playAll(viewModel, folder.songs, onOpenPlayer) }
            )
            Divider(
                color = LocalQingExtendedColors.current.divider,
                thickness = 0.5.dp
            )
        }
    }
}

@Composable
private fun FolderRow(folder: FolderGroup, onClick: () -> Unit) {
    val extended = LocalQingExtendedColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = QingDimen.RowHeight)
            .clickable(onClick = onClick)
            .padding(horizontal = QingDimen.SpaceM, vertical = QingDimen.SpaceS),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(QingDimen.SpaceM)
    ) {
        Icon(
            imageVector = Icons.Filled.Folder,
            contentDescription = null,
            tint = extended.accent
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = folder.name,
                style = TitleSerifStyle,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = stringResource(R.string.folder_meta, folder.path, folder.songs.size),
                style = SubtitleSerifStyle,
                color = extended.textSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
