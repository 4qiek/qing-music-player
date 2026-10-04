package com.qing.player

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache

/**
 * 应用入口：配置 Coil 的封面三级缓存（内存 → 磁盘 → 网络）。
 *
 * - 内存缓存：24MB，缓存已解码的 Bitmap，命中即可直接绘制，无需二次解码。
 * - 磁盘缓存：50MB，缓存原始图片字节，App 重启后仍可命中，避免重复网络/ContentResolver 读取。
 * - 网络/ContentResolver：未命中两级缓存时才回源。
 *
 * 实现 ImageLoaderFactory 后，Coil 自动通过 Context.imageLoader 取到此实例，
 * AsyncImage / rememberAsyncImagePainter 无需额外配置即可使用。
 */
class QingApplication : Application(), ImageLoaderFactory {
    override fun newImageLoader(): ImageLoader =
        ImageLoader.Builder(this)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizeBytes(24 * 1024 * 1024)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("image_cache"))
                    .maxSizeBytes(50L * 1024 * 1024)
                    .build()
            }
            .crossfade(true)
            .build()
}
