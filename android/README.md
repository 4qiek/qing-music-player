# 清 · 安卓版

「清」的安卓版：原生 Kotlin + Jetpack Compose + Media3，面向 Android 8.0 及以上设备，
**不依赖任何 Google Play 服务 / Firebase**，完全离线可用。

- 包名：`com.qing.player`
- minSdk 26（Android 8.0）/ targetSdk 34 / compileSdk 34
- 版本：1.1.0

## 功能

| 模块 | 说明 |
| --- | --- |
| 曲库 | MediaStore 扫描，自动按歌曲 / 专辑 / 艺术家 / 文件夹四个维度分组；过滤短于 30 秒的音频 |
| 播放 | Media3 ExoPlayer + `MediaSessionService`，后台常驻 + 通知栏控制 |
| 实体键 | 设备物理播放键与耳机线控发的是标准 `KEYCODE_MEDIA_*`，由 MediaSession 统一接住 |
| 歌词 | 外挂 `.lrc`，按四路候选路径查找（同名 / 艺术家-歌名 / 歌名 / Lyrics 子目录） |
| 歌单 | Room 持久化：歌单、收藏、播放历史 |
| 均衡器 | 安卓系统级 `android.media.audiofx.Equalizer`，8 组预设 + 十段自定义 |
| 睡眠定时 | 15 / 30 / 60 分钟后暂停 |
| 断点续播 | 保存最后一首、进度与整份队列，下次打开恢复到原位（不自动播放） |
| 主题 | 浅色 / 深色 / 跟随系统，不使用 Material You 动态取色 |

## 构建

需要 JDK 17 + Android SDK（platform 34、build-tools 34.0.0）。

```bash
./gradlew assembleDebug     # 调试包，输出到 app/build/outputs/apk/debug/
./gradlew assembleRelease   # 正式包，输出到 app/build/outputs/apk/release/
```

`local.properties` 里写 `sdk.dir=<你的 Android SDK 路径>`，该文件已在 `.gitignore` 中排除。

release 构建当前用 debug 签名（见 `app/build.gradle.kts` 的注释）：目的不是省事，
而是为了去掉 `debuggable` 标记——debug 构建下 ART 只做 quicken 不做 AOT 编译，
Compose 运行时还会打开额外校验，低配设备上掉帧明显。这样签名一致，
也能直接覆盖安装调试包，不必先卸载（卸载会清掉歌单与收藏）。

## 性能取舍

便携播放器内存小、CPU 弱，下面这几处是有意为之，不要"顺手改回默认"：

- **进度轮询**：暂停时从 0.5 秒放宽到 2 秒；`STATE_IDLE` 直接跳过，不写状态。
- **播放进度不进顶层**：`MiniPlayer` 与 `PlayerSeekBar` 各自订阅 `positionMs`，
  否则每 0.5 秒会把整个 `Scaffold`（含 `NavHost` 里的列表页）重组一遍。
- **进度条松手才 seek**：拖动中只改本地状态，`onValueChangeFinished` 才调 `seekTo`。
  逐帧 seek 会反复冲刷缓冲区、重新定位解码器，是最典型的卡顿来源。
- **派生数据用 `flowOn(Default)` + `SharingStarted.Lazily`**：分组是 `groupBy` + 排序，
  活干在后台线程；`WhileSubscribed` 会切页即丢缓存，回来重算反而更卡。
- **ExoPlayer 缓冲**：`DefaultLoadControl` 上限从默认 50 秒收到 25 秒，起播门槛 1.5 秒。
  本地文件不需要流媒体那么大的缓冲，收窄后内存占用更低，慢速存储卡上起播更快。

## 与桌面版的关系

本目录是独立工程，与仓库根目录的 Electron 桌面端**共享设计语言但代码不共享**：
灰白极简、青瓷绿点缀、作品名用衬线体、圆角统一为控件 8dp / 卡片 12dp / 面板 16dp。

## 已知限制

- **没有厂商私有音效引擎**（如各类音质增强 DSP）——那些只有厂商自带播放器能通过私有接口调用，第三方应用拿不到。这里的 EQ 是安卓系统级 `audiofx.Equalizer`，少数固件会旁路第三方应用的音效，实际效果请以真机为准。
- **内嵌歌词读不到**：Android 的 `MediaMetadataRetriever` 没有歌词常量（不存在 `METADATA_KEY_LYRICS`），只支持外挂 `.lrc` 文件。
- Android 13 的 `READ_MEDIA_AUDIO` 只授权音频文件，直接读 `.lrc` 可能被系统拒绝，已做静默降级。
- 第三方应用的音频输出受系统音频通路限制（可能被重采样），因此不强行指定采样率。
