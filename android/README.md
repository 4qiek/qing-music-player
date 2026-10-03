# 清 · 安卓版（Walkman 适配）

「清」的安卓移植版：原生 Kotlin + Jetpack Compose + Media3，为索尼 Walkman
（NW-A300 / ZX700 / WM1AM2，Android 12/13）设计，**不依赖任何 Google Play 服务 / Firebase**。

- 包名：`com.qing.player`
- minSdk 26（Android 8.0）/ targetSdk 34 / compileSdk 34
- 版本：1.0.0

## 功能

| 模块 | 说明 |
| --- | --- |
| 曲库 | MediaStore 扫描，自动按歌曲 / 专辑 / 艺术家 / 文件夹四个维度分组；过滤短于 30 秒的音频 |
| 播放 | Media3 ExoPlayer + `MediaSessionService`，后台常驻 + 通知栏控制 |
| 实体键 | Walkman 物理播放键与耳机线控发的是标准 `KEYCODE_MEDIA_*`，由 MediaSession 统一接住 |
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
./gradlew assembleRelease   # 正式包（当前未配置签名）
```

`local.properties` 里写 `sdk.dir=<你的 Android SDK 路径>`，该文件已在 `.gitignore` 中排除。

## 与桌面版的关系

本目录是独立工程，与仓库根目录的 Electron 桌面端**共享设计语言但代码不共享**：
灰白极简、青瓷绿点缀、作品名用衬线体、圆角统一为控件 8dp / 卡片 12dp / 面板 16dp。

## 已知限制

- **没有索尼 DSEE / 黑胶处理器 / DC 相位线性器**——那些 DSP 是索尼自带播放器通过私有接口调用的，第三方应用拿不到。这里的 EQ 是安卓系统级 `audiofx.Equalizer`，部分索尼固件会旁路第三方应用的音效，实际效果请以真机为准。
- **内嵌歌词读不到**：Android 的 `MediaMetadataRetriever` 没有歌词常量（不存在 `METADATA_KEY_LYRICS`），只支持外挂 `.lrc` 文件。
- Android 13 的 `READ_MEDIA_AUDIO` 只授权音频文件，直接读 `.lrc` 可能被系统拒绝，已做静默降级。
- 第三方应用在 Walkman 上的音频输出受系统限制（可能被重采样），因此不强行指定采样率。
