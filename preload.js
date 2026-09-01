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
  // 发现页
  neteaseToplist: () => ipcRenderer.invoke('netease:toplist'),
  neteaseTopDetail: (idx) => ipcRenderer.invoke('netease:topDetail', idx),
  neteasePersonalized: (limit) => ipcRenderer.invoke('netease:personalized', limit || 30),
  neteaseSimi: (id) => ipcRenderer.invoke('netease:simi', id),
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
  // 桌面歌词 / 迷你模式
  lyricShow: () => ipcRenderer.send('lyric:show'),
  lyricHide: () => ipcRenderer.send('lyric:hide'),
  lyricUpdate: (data) => ipcRenderer.send('lyric:update', data),
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
  }
});
