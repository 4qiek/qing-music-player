/**
 * main/index.js — 应用入口
 * 仅负责：app 生命周期、窗口创建、各功能模块装配。
 * 具体 IPC / 托盘 / 浏览器等逻辑拆到同目录下的子模块。
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const mainMedia = require('../main-media');

const initMusicIpc = require('./ipc-music');
const initSystemIpc = require('./ipc-system');
const initBrowserIpc = require('./ipc-browser');
const initExtras = require('./extras');

/** 跨模块共享状态 */
const state = {
  mainWindow: null,
  lyricWindow: null,
  tray: null,
  browserView: null,
  browserIncognito: true,
  isQuitting: false,
  trayMinimizedNotified: false,
};

function createWindow() {
  state.mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#f5f5f7',
    title: '清',
    icon: path.join(__dirname, '..', 'assets', 'qing-icon.ico'),
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });
  state.mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  state.mainWindow.setMenuBarVisibility(false);

  // 关闭窗口时最小化到托盘而非退出（托盘“退出”会置 isQuitting 后真正退出）
  state.mainWindow.on('close', (e) => {
    if (state.isQuitting) return;
    e.preventDefault();
    state.mainWindow.hide();
    if (!state.trayMinimizedNotified) {
      state.trayMinimizedNotified = true;
      // 首次最小化：用托盘气泡提示一次
      try {
        if (state.tray && typeof state.tray.displayBalloon === 'function') {
          state.tray.displayBalloon({
            title: '清',
            content: '已最小化到系统托盘，点击托盘图标可再次显示窗口'
          });
        }
      } catch (err) { /* 某些平台无托盘气泡，忽略 */ }
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  try { mainMedia.init(() => state.mainWindow); } catch (e) { console.error('mainMedia init', e); }

  // 装配各功能模块
  initMusicIpc(state);
  initSystemIpc(state);
  initBrowserIpc(state);
  initExtras(state);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // 默认最小化到托盘，不退出（macOS 保留原行为：关闭即退出）
  if (process.platform === 'darwin') app.quit();
});

module.exports = { state, createWindow };
