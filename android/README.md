# 清 · 安卓版

「清」的安卓版：原生 Kotlin + Jetpack Compose + Media3，面向 Android 8.0 及以上设备，
**不依赖任何 Google Play 服务 / Firebase**。

定位是**本地优先**：本地曲库、本地播放、本地 `.lrc` 永远是第一选择；
联网只用来「补全」缺失的封面与歌词，可以在设置里一键关掉，关掉后完全离线。

- 包名：`com.qing.player`
- minSdk 26（Android 8.0）/ targetSdk 34 / compileSdk 34
- 版本：1.2.0

## 下载安装包

预编译的 APK 在 [Releases](https://github.com/4qiek/qing-music-player/releases) 页面：

```
https://github.com/4qiek/qing-music-player/releases/download/v1.2.0-android/qing-android-v1.2.0.apk
```

支持 Android 8.0 及以上。安装包使用**调试签名**，可覆盖安装同签名的旧版本，歌单与收藏不会丢失。

## 功能

| 模块 | 说明 |
| --- | --- |
| 曲库 | MediaStore 扫描，自动按歌曲 / 专辑 / 艺术家 / 文件夹四个维度分组；过滤短于 30 秒的音频 |
| 播放 | Media3 ExoPlayer + `MediaSessionService`，后台常驻 + 通知栏控制 |
| 实体键 | 设备物理播放键与耳机线控发的是标准 `KEYCODE_MEDIA_*`，由 MediaSession 统一接住 |
| 歌词 | 三级来源：同目录外挂 `.lrc`（四路候选路径）→ 本地补全缓存 → 联网匹配 |
| 封面 | 优先 MediaStore 内嵌封面，缺失时用联网匹配的地址补上，结果存本地 |
| 歌单 | Room 持久化：歌单、收藏、播放历史 |
| 均衡器 | 安卓系统级 `android.media.audiofx.Equalizer`，8 组预设 + 十段自定义 |
| 睡眠定时 | 15 / 30 / 60 分钟后暂停 |
| 断点续播 | 保存最后一首、进度与整份队列，下次打开恢复到原位（不自动播放） |
| 主题 | 浅色 / 深色 / 跟随系统，不使用 Material You 动态取色 |
| 语言 | 中文 / English / 跟随系统，应用内切换（重进界面生效） |
| 字体 | 字体风格（衬线 / 黑体）+ 字号缩放（小 / 标准 / 大 / 超大），全局生效 |
| 浏览入口 | 「文件夹」默认不占底部标签栏，入口收在设置 → 浏览；需要可放回底部 |

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

## 联网补全（可关闭）

设置 → 在线匹配，默认开启。开启后：

- **扫描完曲库**会顺手补一轮缺失的封面，一轮最多 200 首，每首间隔 250ms。
- **切歌时**如果本地没有 `.lrc`，会去联网找一次歌词，找到后存进本地缓存。
- 结果缓存在内部存储的 `online_meta.json`，下次启动直接读，不会重复请求。

用的是两个**免注册、免 API Key** 的公开接口：

| 用途 | 接口 |
| --- | --- |
| 封面 + 元数据 | iTunes Search API（`itunes.apple.com/search`） |
| 歌词 | LRCLIB（`lrclib.net`，返回带时间轴的歌词） |

几条硬规矩，改代码时别破坏：

1. **只补全，不覆盖**。本地已有的信息优先级永远更高。
2. **失败必须静默**。断网、超时、接口改版都只当作"这次没匹配到"，
   绝不能弹出报错或影响播放。
3. 批量补全前先查网络状态——没网就直接放弃。否则每首都要等满 6 秒超时，
   一轮 200 首就是二十几分钟。
4. 关掉开关后 App **完全离线**，一个字节都不往外发。

## 与桌面版的关系

本目录是独立工程，与仓库根目录的 Electron 桌面端**共享设计语言但代码不共享**：
灰白极简、青瓷绿点缀、作品名用衬线体、圆角统一为控件 8dp / 卡片 12dp / 面板 16dp。

## 已知限制

- **没有厂商私有音效引擎**（如各类音质增强 DSP）——那些只有厂商自带播放器能通过私有接口调用，第三方应用拿不到。这里的 EQ 是安卓系统级 `audiofx.Equalizer`，少数固件会旁路第三方应用的音效，实际效果请以真机为准。
- **内嵌在 ID3 里的歌词读不到**：Android 的 `MediaMetadataRetriever` 没有歌词常量（不存在 `METADATA_KEY_LYRICS`）。这类曲目可以靠联网匹配补歌词（LRCLIB 通常有），关掉联网就只剩外挂 `.lrc` 这一条路。
- **联网匹配只是"尽力而为"**：公开接口的曲库以流媒体平台的版本为准，冷门曲目、现场版、remix 可能匹配不到或匹配错。发现补错了，关掉开关即可，已经存下来的缓存可以在设置里关掉后不再使用。
- Android 13 的 `READ_MEDIA_AUDIO` 只授权音频文件，直接读 `.lrc` 可能被系统拒绝，已做静默降级。
- 第三方应用的音频输出受系统音频通路限制（可能被重采样），因此不强行指定采样率。
