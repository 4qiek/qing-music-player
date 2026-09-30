const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qingAPI', {
  // 网易云：在线音乐功能已移除，仅保留本地歌曲增强所需的两个接口
  //  neteaseSearch —— 本地曲目按歌名匹配歌手 / 专辑 / 封面
  //  neteaseLyric  —— 本地曲目匹配到 id 后拉取在线歌词
  neteaseSearch: (keyword) => ipcRenderer.invoke('netease:search', keyword),
  neteaseLyric: (id) => ipcRenderer.invoke('netease:lyric', id),
  // 通用元数据匹配（豆瓣：书籍 / 影视封面与信息）
  metaSuggest: (keyword, kind) => ipcRenderer.invoke('meta:suggest', keyword, kind),
  metaCover: (url) => ipcRenderer.invoke('meta:cover', url),
  // 天气
  getWeather: (city) => ipcRenderer.invoke('weather:get', city),
  // 在线诗词
  getPoem: (category) => ipcRenderer.invoke('poem:get', category),
  // 系统控制
  detectPlayers: () => ipcRenderer.invoke('system:detectPlayers'),
  mediaKey: (key) => ipcRenderer.invoke('system:mediaKey', key),
  detectUsbAudio: () => ipcRenderer.invoke('system:detectUsbAudio'),
  // SMTC 系统媒体控制
  getSmtcSessions: () => ipcRenderer.invoke('smtc:getSessions'),
  smtcControl: (action, appId) => ipcRenderer.invoke('smtc:control', { action, appId }),
  // 系统级EQ（通过Equalizer APO）
  applySystemEq: (values) => ipcRenderer.invoke('system:applyEq', values),
  checkEqAvailable: () => ipcRenderer.invoke('system:checkEq'),
  installSystemEq: () => ipcRenderer.invoke('system:installEq'),
  // 桌面歌词 / 迷你模式
  lyricShow: () => ipcRenderer.send('lyric:show'),
  lyricHide: () => ipcRenderer.send('lyric:hide'),
  lyricUpdate: (data) => ipcRenderer.send('lyric:update', data),
  lyricSetIgnore: (ignore) => ipcRenderer.send('lyric:setIgnore', ignore),
  setMiniMode: (on) => ipcRenderer.send('window:mini', on),
  // 托盘动作监听（播放/暂停/切歌/歌词开关）
  onTrayAction: (cb) => {
    const listener = (_e, action) => cb(action);
    ipcRenderer.on('tray:action', listener);
    return () => ipcRenderer.removeListener('tray:action', listener);
  },
  // 桌面歌词窗口数据监听
  onLyricData: (cb) => {
    const listener = (_e, data) => cb(data);
    ipcRenderer.on('lyric:data', listener);
    return () => ipcRenderer.removeListener('lyric:data', listener);
  },
  // 浏览器模式（内嵌浏览器）
  browserOpen: (opts) => ipcRenderer.send('browser:open', opts),
  browserNavigate: (url) => ipcRenderer.send('browser:navigate', url),
  browserGo: (action) => ipcRenderer.send('browser:go', action),
  browserSetIncognito: (on) => ipcRenderer.send('browser:setIncognito', on),
  browserClose: () => ipcRenderer.send('browser:close'),
  onBrowserEvent: (cb) => {
    const listener = (_e, data) => cb(data);
    ipcRenderer.on('browser:event', listener);
    return () => ipcRenderer.removeListener('browser:event', listener);
  },
  // ===== 本地媒体库（文件夹扫描 / 本地文件读取 / ID3） =====
  pickMediaFolder: () => ipcRenderer.invoke('dialog:pickMediaFolder'),
  fsReadText: (fp) => ipcRenderer.invoke('fs:readText', fp),
  fsReadBuffer: (fp) => ipcRenderer.invoke('fs:readBuffer', fp),
  metaId3: (fp) => ipcRenderer.invoke('meta:id3', fp),
  metaId3Buf: (buf, ext) => ipcRenderer.invoke('meta:id3buf', buf, ext),
  mediaUrlForPath: (fp) => ipcRenderer.invoke('media:urlForPath', fp),
  // 启动时把已入库的本地路径批量补登记到主进程白名单（重启后仍可播放）
  registerMediaPaths: (paths) => ipcRenderer.invoke('media:registerPaths', paths),
  onMediaFolderNew: (cb) => {
    const listener = (_e, data) => cb(data);
    ipcRenderer.on('media:folder-new', listener);
    return () => ipcRenderer.removeListener('media:folder-new', listener);
  }
});
