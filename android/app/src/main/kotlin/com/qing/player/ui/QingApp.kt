package com.qing.player.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Album
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.QueueMusic
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.qing.player.R
import com.qing.player.player.PlayerViewModel
import com.qing.player.ui.component.MiniPlayer
import com.qing.player.ui.screen.AlbumsScreen
import com.qing.player.ui.screen.ArtistsScreen
import com.qing.player.ui.screen.EqualizerScreen
import com.qing.player.ui.screen.FoldersScreen
import com.qing.player.ui.screen.PlayerScreen
import com.qing.player.ui.screen.PlaylistScreen
import com.qing.player.ui.screen.SettingsScreen
import com.qing.player.ui.screen.SongsScreen
import com.qing.player.ui.theme.LocalQingExtendedColors
import com.qing.player.ui.theme.QingDimen

/** 顶层路由 */
object Route {
    const val SONGS = "songs"
    const val ALBUMS = "albums"
    const val ARTISTS = "artists"
    const val FOLDERS = "folders"
    const val PLAYLISTS = "playlists"
    const val EQUALIZER = "equalizer"
    const val SETTINGS = "settings"
    const val PLAYER = "player"
}

private data class BottomTab(
    val route: String,
    val labelRes: Int,
    val icon: ImageVector
)

/**
 * 「清」的主界面骨架。
 *
 * 底部四个浏览维度 + 歌单；右上角只有均衡器与设置两个入口（不设标题栏，
 * 页面本身就是最好的标识，顶上一条大标题反而占地方）；
 * 有正在播放的曲目时，底部常驻迷你播放器。
 */
@Composable
fun QingApp(viewModel: PlayerViewModel) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    val currentSong by viewModel.currentSong.collectAsState()
    val isPlaying by viewModel.isPlaying.collectAsState()
    val extended = LocalQingExtendedColors.current

    // 播放器 / 均衡器 / 设置是全屏页，不显示底部导航与迷你播放器
    val browRoutes = remember {
        setOf(Route.SONGS, Route.ALBUMS, Route.ARTISTS, Route.FOLDERS, Route.PLAYLISTS)
    }
    val showBottomBar = currentRoute in browRoutes

    // 「文件夹」默认不出现在底部标签栏——按目录听歌是小众需求，
    // 入口收在设置里（设置 → 浏览 → 按文件夹浏览），想要的人可以在设置里把它放回底部。
    val showFolderTab by viewModel.showFolderTab.collectAsState()
    val tabs = remember(showFolderTab) {
        buildList {
            add(BottomTab(Route.SONGS, R.string.nav_songs, Icons.Default.MusicNote))
            add(BottomTab(Route.ALBUMS, R.string.nav_albums, Icons.Default.Album))
            add(BottomTab(Route.ARTISTS, R.string.nav_artists, Icons.Default.Person))
            if (showFolderTab) {
                add(BottomTab(Route.FOLDERS, R.string.nav_folders, Icons.Default.Folder))
            }
            add(BottomTab(Route.PLAYLISTS, R.string.nav_playlists, Icons.Default.QueueMusic))
        }
    }

    Scaffold(
        topBar = {
            // 轻量入口行：不要标题栏，只保留均衡器与设置两个图标，贴右上角
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .height(QingDimen.MinTouchTarget)
                    .padding(horizontal = QingDimen.SpaceS),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { navController.navigate(Route.EQUALIZER) }) {
                    Icon(Icons.Default.GraphicEq, contentDescription = stringResource(R.string.nav_equalizer))
                }
                IconButton(onClick = { navController.navigate(Route.SETTINGS) }) {
                    Icon(Icons.Default.Settings, contentDescription = stringResource(R.string.nav_settings))
                }
            }
        },
        bottomBar = {
            if (showBottomBar) {
                Column {
                    // 注意：不要把 positionMs / durationMs 提到这一层来 collect。
                    // 那会让每 0.5 秒一次的进度刷新把 Scaffold 连同 NavHost 里的列表页
                    // 全部重组一遍——小屏设备上最直观的表现就是"滑动掉帧"。
                    // 进度由 MiniPlayer 内部自己订阅，重组范围限制在它自身。
                    currentSong?.let { song ->
                        MiniPlayer(
                            song = song,
                            isPlaying = isPlaying,
                            viewModel = viewModel,
                            onOpenPlayer = { navController.navigate(Route.PLAYER) }
                        )
                    }
                    NavigationBar(
                        containerColor = MaterialTheme.colorScheme.surface,
                        tonalElevation = 0.dp
                    ) {
                        tabs.forEach { tab ->
                            val selected = backStackEntry?.destination?.hierarchy
                                ?.any { it.route == tab.route } == true
                            NavigationBarItem(
                                selected = selected,
                                onClick = {
                                    navController.navigate(tab.route) {
                                        popUpTo(navController.graph.findStartDestination().id) {
                                            saveState = true
                                        }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                },
                                icon = { Icon(tab.icon, contentDescription = stringResource(tab.labelRes)) },
                                label = { Text(stringResource(tab.labelRes), style = MaterialTheme.typography.labelSmall) },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = extended.accent,
                                    selectedTextColor = extended.accent,
                                    indicatorColor = MaterialTheme.colorScheme.surfaceVariant
                                )
                            )
                        }
                    }
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Route.SONGS,
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            composable(Route.SONGS) {
                SongsScreen(
                    viewModel = viewModel,
                    onOpenPlayer = { navController.navigate(Route.PLAYER) }
                )
            }
            composable(Route.ALBUMS) {
                AlbumsScreen(
                    viewModel = viewModel,
                    onOpenPlayer = { navController.navigate(Route.PLAYER) }
                )
            }
            composable(Route.ARTISTS) {
                ArtistsScreen(
                    viewModel = viewModel,
                    onOpenPlayer = { navController.navigate(Route.PLAYER) }
                )
            }
            composable(Route.FOLDERS) {
                FoldersScreen(
                    viewModel = viewModel,
                    onOpenPlayer = { navController.navigate(Route.PLAYER) }
                )
            }
            composable(Route.PLAYLISTS) {
                PlaylistScreen(
                    viewModel = viewModel,
                    onOpenPlayer = { navController.navigate(Route.PLAYER) }
                )
            }
            composable(Route.EQUALIZER) {
                EqualizerScreen(
                    viewModel = viewModel,
                    onBack = { navController.popBackStack() }
                )
            }
            composable(Route.SETTINGS) {
                SettingsScreen(
                    viewModel = viewModel,
                    onBack = { navController.popBackStack() },
                    // 文件夹页的入口：默认不占底部标签栏，但设置里始终能进
                    onOpenFolders = { navController.navigate(Route.FOLDERS) }
                )
            }
            composable(Route.PLAYER) {
                PlayerScreen(
                    viewModel = viewModel,
                    onBack = { navController.popBackStack() }
                )
            }
        }
    }
}

/** 统一的卡片外边距（小屏上左右收紧） */
val QingScreenPadding = QingDimen.SpaceM
