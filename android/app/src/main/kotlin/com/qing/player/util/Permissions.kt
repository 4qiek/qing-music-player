package com.qing.player.util

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat

/**
 * 权限工具。
 *
 * 权限分支：
 * - Android 13（API 33）及以上用 READ_MEDIA_AUDIO
 * - Android 12（API 32）及以下用 READ_EXTERNAL_STORAGE（清单中带 maxSdkVersion=32）
 *
 * 注意：本项目不依赖 Google Play 服务，权限申请只用原生 API。
 */
object Permissions {

    /** 曲库读取权限（按系统版本分支） */
    fun audioPermission(): String =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Manifest.permission.READ_MEDIA_AUDIO
        } else {
            Manifest.permission.READ_EXTERNAL_STORAGE
        }

    /** 通知权限：仅 Android 13+ 需要运行时申请 */
    fun notificationPermission(): String? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Manifest.permission.POST_NOTIFICATIONS
        } else {
            null
        }

    fun hasAudioPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, audioPermission()) ==
            PackageManager.PERMISSION_GRANTED

    fun hasNotificationPermission(context: Context): Boolean {
        val perm = notificationPermission() ?: return true
        return ContextCompat.checkSelfPermission(context, perm) ==
            PackageManager.PERMISSION_GRANTED
    }

    /** 一次性返回所有还缺少的权限 */
    fun missingPermissions(context: Context): List<String> {
        val missing = ArrayList<String>()
        if (!hasAudioPermission(context)) missing += audioPermission()
        if (!hasNotificationPermission(context)) {
            notificationPermission()?.let { missing += it }
        }
        return missing
    }
}
