package com.qing.player

import android.Manifest
import android.content.Context
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.qing.player.data.SettingsStore
import com.qing.player.player.PlayerViewModel
import com.qing.player.ui.QingApp
import com.qing.player.ui.theme.HeadlineSerifStyle
import com.qing.player.ui.theme.QingTheme
import com.qing.player.util.LocaleHelper
import com.qing.player.util.Permissions

/**
 * 唯一入口 Activity。
 *
 * 职责：
 * - 申请读取音频与通知权限（Android 13 用 READ_MEDIA_AUDIO，12 及以下用 READ_EXTERNAL_STORAGE）
 * - 首次进入扫描曲库，并在曲库就绪后恢复上次播放位置（不自动播放）
 * - 承载 Compose 界面
 */
class MainActivity : ComponentActivity() {

    /**
     * 应用内语言在这里生效：包一层带指定 Locale 的 Context。
     * 它只在 Activity **创建**时走一次，所以设置里改完语言后必须
     * recreate 才能立刻看到（LanguageSwitch 那边负责调用）。
     */
    override fun attachBaseContext(newBase: Context?) {
        val wrapped = newBase?.let {
            LocaleHelper.apply(it, SettingsStore.getInstance(it).language)
        } ?: newBase
        super.attachBaseContext(wrapped)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 边到边绘制：状态栏/导航栏透明，由 Compose 的 Scaffold 统一处理内边距
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        setContent {
            val viewModel: PlayerViewModel = viewModel()
            val themeMode by viewModel.themeMode.collectAsState()
            val fontFamily by viewModel.fontFamily.collectAsState()
            val fontScale by viewModel.fontScale.collectAsState()
            val darkTheme = when (themeMode) {
                SettingsStore.THEME_DARK -> true
                SettingsStore.THEME_LIGHT -> false
                else -> androidx.compose.foundation.isSystemInDarkTheme()
            }

            QingTheme(
                darkTheme = darkTheme,
                fontScale = fontScale,
                useSerif = fontFamily != SettingsStore.FONT_SANS
            ) {
                var permissionGranted by remember {
                    mutableStateOf(Permissions.hasAudioPermission(this@MainActivity))
                }
                val launcher = androidx.activity.compose.rememberLauncherForActivityResult(
                    ActivityResultContracts.RequestMultiplePermissions()
                ) { _ ->
                    permissionGranted = Permissions.hasAudioPermission(this@MainActivity)
                }

                // 首次进入申请权限（含 Android 13 的通知权限）
                LaunchedEffect(Unit) {
                    val missing = Permissions.missingPermissions(this@MainActivity)
                    if (missing.isNotEmpty()) {
                        launcher.launch(missing.toTypedArray())
                    }
                }

                // 有权限就扫描曲库
                LaunchedEffect(permissionGranted) {
                    if (permissionGranted) viewModel.scanLibrary()
                }

                // 曲库就绪后恢复断点（只做一次）
                val libraryReady by viewModel.libraryReady.collectAsState()
                var restored by remember { mutableStateOf(false) }
                LaunchedEffect(libraryReady, restored) {
                    if (libraryReady && !restored && permissionGranted) {
                        restored = true
                        viewModel.restoreLastPlayback()
                    }
                }

                if (permissionGranted) {
                    QingApp(viewModel = viewModel)
                } else {
                    PermissionGate(
                        onRequest = {
                            launcher.launch(Permissions.missingPermissions(this@MainActivity).toTypedArray())
                        }
                    )
                }
            }
        }
    }
}

/** 未授权时的引导页：说明用途 + 一个授予按钮 */
@Composable
private fun PermissionGate(onRequest: () -> Unit) {
    val isAndroid13 = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = stringResource(R.string.permission_audio_title),
            style = HeadlineSerifStyle,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center
        )
        Text(
            text = if (isAndroid13) {
                stringResource(R.string.permission_audio_message_13)
            } else {
                stringResource(R.string.permission_audio_message_legacy)
            },
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 12.dp)
        )
        Button(
            onClick = onRequest,
            modifier = Modifier.padding(top = 24.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary
            )
        ) {
            Text(stringResource(R.string.grant))
        }
    }
}
