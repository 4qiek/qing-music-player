/**
 * main/extras.js — 托盘 / 全局快捷键 / 桌面歌词窗口 / 迷你模式
 */
const { Tray, Menu, globalShortcut, BrowserWindow, app } = require('electron');
const path = require('path');

module.exports = function initExtras(state) {
  // ---------- 桌面歌词窗口 ----------
  function ensureLyricWindow() {
    if (state.lyricWindow && !state.lyricWindow.isDestroyed()) return state.lyricWindow;
    state.lyricWindow = new BrowserWindow({
      width: 780, height: 96, frame: false, transparent: true, resizable: false,
      alwaysOnTop: true, skipTaskbar: true, hasShadow: false, fullscreenable: false, show: false,
      webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true, nodeIntegration: false }
    });
    state.lyricWindow.loadFile(path.join(__dirname, '..', 'src', 'lyric.html'));
    state.lyricWindow.setAlwaysOnTop(true, 'screen-saver');
    state.lyricWindow.setIgnoreMouseEvents(true, { forward: true });
    state.lyricWindow.on('closed', () => { state.lyricWindow = null; });
    return state.lyricWindow;
  }

  const { ipcMain } = require('electron');
  ipcMain.on('lyric:show', () => {
    const w = ensureLyricWindow();
    try {
      const { screen } = require('electron');
      const disp = screen.getPrimaryDisplay().workArea;
      w.setPosition(Math.round(disp.x + (disp.width - 780) / 2), disp.y + 24);
    } catch (e) { /* ignore */ }
    w.show();
  });
  ipcMain.on('lyric:hide', () => { if (state.lyricWindow && !state.lyricWindow.isDestroyed()) state.lyricWindow.hide(); });
  ipcMain.on('lyric:update', (e, data) => {
    if (state.lyricWindow && !state.lyricWindow.isDestroyed()) state.lyricWindow.webContents.send('lyric:data', data);
  });

  // ---------- 迷你模式（带过渡动画） ----------
  ipcMain.on('window:mini', (e, on) => {
    if (!state.mainWindow || state.mainWindow.isDestroyed()) return;
    const win = state.mainWindow;
    const targetW = on ? 360 : 1200;
    const targetH = on ? 130 : 800;
    win.setMinimumSize(on ? 320 : 900, on ? 120 : 600);
    const [cw, ch] = win.getSize();
    if (cw === targetW && ch === targetH) return;
    const steps = 14;
    let step = 0;
    const tick = () => {
      step++;
      const t = step / steps;
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      win.setSize(Math.round(cw + (targetW - cw) * ease), Math.round(ch + (targetH - ch) * ease));
      if (step < steps) setTimeout(tick, 16);
    };
    tick();
  });

  // ---------- 托盘 ----------
  function toggleMainWindow() {
    if (!state.mainWindow || state.mainWindow.isDestroyed()) {
      const { createWindow } = require('./index');
      createWindow();
      return;
    }
    if (state.mainWindow.isVisible()) state.mainWindow.hide();
    else { state.mainWindow.show(); state.mainWindow.focus(); }
  }

  function sendTrayAction(action) {
    if (state.mainWindow && !state.mainWindow.isDestroyed()) state.mainWindow.webContents.send('tray:action', action);
  }

  function createTray() {
    try {
      const iconPath = path.join(__dirname, '..', 'assets', 'qing-icon.ico');
      let trayIcon;
      try {
        const { nativeImage } = require('electron');
        trayIcon = nativeImage.createFromPath(iconPath);
        if (trayIcon.isEmpty()) trayIcon = nativeImage.createEmpty();
      } catch (e) { trayIcon = undefined; }
      state.tray = new Tray(trayIcon || iconPath);
      state.tray.setToolTip('清');
      const menu = Menu.buildFromTemplate([
        { label: '显示 / 隐藏窗口', click: () => toggleMainWindow() },
        { label: '播放 / 暂停', click: () => sendTrayAction('playpause') },
        { label: '上一曲', click: () => sendTrayAction('prev') },
        { label: '下一曲', click: () => sendTrayAction('next') },
        { label: '桌面歌词', click: () => sendTrayAction('lyric') },
        { type: 'separator' },
        { label: '开机自启', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (item) => { app.setLoginItemSettings({ openAtLogin: item.checked }); } },
        { type: 'separator' },
        { label: '退出', click: () => { app.quit(); } }
      ]);
      state.tray.setContextMenu(menu);
      state.tray.on('click', () => toggleMainWindow());
    } catch (e) { console.error('[tray] 创建失败:', e.message); }
  }

  // ---------- 注册托盘 + 全局快捷键 ----------
  try { createTray(); } catch (e) { console.error(e); }

  const hotkeys = [
    ['CommandOrControl+Alt+Space', 'playpause'],
    ['CommandOrControl+Alt+Right', 'next'],
    ['CommandOrControl+Alt+Left', 'prev']
  ];
  hotkeys.forEach(([acc, act]) => {
    try { globalShortcut.register(acc, () => sendTrayAction(act)); } catch (e) { /* ignore */ }
  });
  try {
    globalShortcut.register('CommandOrControl+Alt+L', () => {
      if (state.lyricWindow && !state.lyricWindow.isDestroyed()) state.lyricWindow.hide();
      else { const w = ensureLyricWindow(); w.show(); }
    });
  } catch (e) { /* ignore */ }

  app.on('will-quit', () => {
    try { globalShortcut.unregisterAll(); } catch (e) { /* ignore */ }
  });
};
