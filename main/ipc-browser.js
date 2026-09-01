/**
 * main/ipc-browser.js — 内嵌浏览器模式（BrowserView + 无痕 + 下载）
 */
const { ipcMain, BrowserView, session, dialog } = require('electron');
const path = require('path');
const { app } = require('electron');

module.exports = function initBrowserIpc(state) {
  function sendBrowserEvent(data) {
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send('browser:event', data);
    }
  }

  async function handleBrowserDownload(e, item) {
    e.preventDefault();
    const { canceled, filePath } = await dialog.showSaveDialog(state.mainWindow, {
      title: '保存文件',
      defaultPath: path.join(app.getPath('downloads'), item.getFilename())
    });
    if (canceled || !filePath) return;
    item.setSavePath(filePath);
    sendBrowserEvent({ type: 'download:start', filename: item.getFilename() });
    item.once('done', (ev, st) => {
      sendBrowserEvent({ type: 'download:done', state: st, filename: item.getFilename(), savePath: item.getSavePath() });
    });
  }

  function makeBrowserSession(incognito) {
    if (!incognito) {
      if (!session.defaultSession.listenerCount('will-download')) {
        session.defaultSession.on('will-download', handleBrowserDownload);
      }
      return session.defaultSession;
    }
    const part = 'qing-incog-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    const s = session.fromPartition(part);
    s.on('will-download', handleBrowserDownload);
    return s;
  }

  function ensureBrowserView() {
    if (state.browserView && !state.browserView.webContents.isDestroyed()) return state.browserView;
    const ses = makeBrowserSession(state.browserIncognito);
    state.browserView = new BrowserView({
      webPreferences: { session: ses, nodeIntegration: false, contextIsolation: true, webSecurity: true }
    });
    const wc = state.browserView.webContents;
    wc.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) { wc.loadURL(url); }
      return { action: 'deny' };
    });
    wc.on('did-navigate', (_e, url) => sendBrowserEvent({ type: 'nav', url }));
    wc.on('did-navigate-in-page', (_e, url) => sendBrowserEvent({ type: 'nav', url }));
    wc.on('page-title-updated', (_e, title) => sendBrowserEvent({ type: 'title', title }));
    return state.browserView;
  }

  function layoutBrowserView() {
    if (!state.mainWindow || state.mainWindow.isDestroyed()) return;
    if (!state.browserView || state.browserView.webContents.isDestroyed()) return;
    const [w, h] = state.mainWindow.getContentSize();
    state.browserView.setBounds({ x: 204, y: 104, width: Math.max(240, w - 204), height: Math.max(200, h - 104) });
  }

  ipcMain.on('browser:open', (e, opts = {}) => {
    if (opts.incognito != null) state.browserIncognito = !!opts.incognito;
    const bv = ensureBrowserView();
    state.mainWindow.setBrowserView(bv);
    layoutBrowserView();
    state.mainWindow.removeListener('resize', layoutBrowserView);
    state.mainWindow.on('resize', layoutBrowserView);
    const raw = (opts.url && String(opts.url).trim()) || 'https://www.baidu.com';
    const url = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
    bv.webContents.loadURL(url);
    sendBrowserEvent({ type: 'ready' });
  });

  ipcMain.on('browser:navigate', (e, url) => {
    if (!state.browserView || state.browserView.webContents.isDestroyed()) return;
    let u = String(url || '').trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    state.browserView.webContents.loadURL(u);
  });

  ipcMain.on('browser:go', (e, action) => {
    if (!state.browserView || state.browserView.webContents.isDestroyed()) return;
    const wc = state.browserView.webContents;
    if (action === 'back' && wc.canGoBack()) wc.goBack();
    else if (action === 'forward' && wc.canGoForward()) wc.goForward();
    else if (action === 'reload') wc.reload();
    else if (action === 'home') wc.loadURL('https://www.baidu.com');
  });

  ipcMain.on('browser:setIncognito', (e, on) => {
    const changed = state.browserIncognito !== !!on;
    state.browserIncognito = !!on;
    if (!changed) return;
    const cur = state.browserView && !state.browserView.webContents.isDestroyed()
      ? state.browserView.webContents.getURL() : '';
    if (state.browserView) {
      try { state.mainWindow.removeBrowserView(state.browserView); } catch {}
      try { state.browserView.webContents.destroy(); } catch {}
    }
    state.browserView = null;
    const bv = ensureBrowserView();
    state.mainWindow.setBrowserView(bv);
    layoutBrowserView();
    if (cur) bv.webContents.loadURL(cur);
    sendBrowserEvent({ type: 'incognito', on: state.browserIncognito });
  });

  ipcMain.on('browser:close', () => {
    if (state.mainWindow && state.browserView) {
      try { state.mainWindow.removeBrowserView(state.browserView); } catch {}
    }
    if (state.browserView) {
      try { state.browserView.webContents.destroy(); } catch {}
    }
    state.browserView = null;
    state.mainWindow.removeListener('resize', layoutBrowserView);
    sendBrowserEvent({ type: 'closed' });
  });
};
