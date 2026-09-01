# 清 · 音乐播放器

一款灰白风桌面音乐播放器，参考 Apple Music 设计，支持本地音乐播放、网易云在线音乐、十段 EQ、天气显示、跨平台控制和磁带模拟效果。

## 功能特性

- **本地音乐播放**：支持 MP3 / FLAC / WAV / OGG 等多种格式
- **网易云在线音乐**：搜索、播放、登录、歌单同步、歌词显示、音质选择（标准/较高/极高/无损）
- **十段均衡器**：Web Audio 实时 EQ，8 种预设（流行/摇滚/爵士/古典/人声/重低音/高音增强）
- **系统级 EQ**：内嵌 Equalizer APO 自动安装，支持系统级音效调节
- **天气显示**：右上角实时天气，点击进入全屏天气动画页（简笔画风格，6 种天气场景）
- **省份地标背景**：中国各省份极简线条地标建筑动画背景
- **跨平台控制**：通过 Windows SMTC 检测并控制其他音乐播放器（Apple Music、Spotify 等），显示封面和歌词
- **磁带模式**：检测 USB 小尾巴（DAC/耳放）连接后自动启用磁带模拟效果（饱和/高频衰减/低频提升/Wow&Flutter/底噪）
- **黑胶唱片占位**：无封面时显示旋转黑胶唱片动画
- **毛玻璃 UI**：整体灰白风，backdrop-filter 毛玻璃效果

## 技术栈

- **Electron 28**：桌面应用框架
- **NeteaseCloudMusicApi**：网易云音乐 API
- **Web Audio API**：实时 EQ 和磁带效果
- **Windows SMTC**：跨平台媒体控制
- **Equalizer APO**：系统级音效

## 安装和运行

### 开发模式

```bash
# 安装依赖
npm install

# 启动开发模式
npm start
```

### 打包

```bash
# 打包为 portable exe
npm run build
```

打包产物在 `dist/` 目录下。

## 项目结构

```
qing-player/
├── main.js              # 主进程（网易云API、天气、SMTC、EQ安装、USB检测）
├── preload.js           # 预加载脚本（contextBridge 暴露 API）
├── src/
│   └── index.html       # 前端界面（单文件，含 CSS 和 JS）
├── assets/
│   ├── qing-logo.png    # 「清」字书法图标
│   └── qing-icon.ico    # 应用图标（多尺寸）
├── package.json
└── README.md
```

## 注意事项

- QQ 音乐和酷狗音乐接口因反爬限制已不可用，已隐藏入口
- 网易云音乐部分高音质歌曲可能需要 VIP 权限
- Equalizer APO 安装需要管理员权限
- 磁带模式需要连接 USB 音频设备才能自动启用

## License

MIT
