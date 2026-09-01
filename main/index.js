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
  neteaseCookie: '',
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
  if (process.platform !== 'darwin') app.quit();
});

module.exports = { state, createWindow };
