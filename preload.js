const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qingAPI', {
  // 网易云
  neteaseSearch: (keyword) => ipcRenderer.invoke('netease:search', keyword),
  neteaseUrl: (data) => ipcRenderer.invoke('netease:url', data),
  neteaseDetail: (ids) => ipcRenderer.invoke('netease:detail', ids),
  neteaseLyric: (id) => ipcRenderer.invoke('netease:lyric', id),
  neteaseLogin: (data) => ipcRenderer.invoke('netease:login', data),
  neteasePlaylist: (uid) => ipcRenderer.invoke('netease:playlist', uid),
  neteasePlaylistDetail: (id) => ipcRenderer.invoke('netease:playlistDetail', id),
  // QQ音乐
  qqSearch: (keyword) => ipcRenderer.invoke('qq:search', keyword),
  qqUrl: (songmid) => ipcRenderer.invoke('qq:url', songmid),
  // 酷狗
  kugouSearch: (keyword) => ipcRenderer.invoke('kugou:search', keyword),
  kugouUrl: (hash, albumId) => ipcRenderer.invoke('kugou:url', hash, albumId),
  // 天气
  getWeather: (city) => ipcRenderer.invoke('weather:get', city),
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
  // 网易云搜索歌词（用于其他播放器的歌词匹配）
  neteaseSearch: (keyword) => ipcRenderer.invoke('netease:search', keyword),
  neteaseLyric: (id) => ipcRenderer.invoke('netease:lyric', id)
});
