/**
 * appSwitch.js — 五个平级应用切换（音乐 / 视频 / 图片 / 书籍 / 浏览器）
 * 职责：侧边栏顶部应用切换、音乐子导航显隐、视图与应用状态同步。
 */
import { store } from './store.js';
import { switchView } from './view.js';
import { openBrowser } from './browser.js';

// 视图 → 所属应用
const APP_OF_VIEW = {
  local: 'music', search: 'music', playlist: 'music',
  toplist: 'music', recommend: 'music', favorites: 'music', history: 'music',
  video: 'video', image: 'image', book: 'book'
};

const APP_DEFAULT_VIEW = { music: 'local', video: 'video', image: 'image', book: 'book' };

const $ = (id) => document.getElementById(id);

export function initAppSwitch() {
  // 五个平级应用按钮
  document.querySelectorAll('.app-item[data-app]').forEach((item) => {
    item.addEventListener('click', () => {
      const app = item.dataset.app;
      activateApp(app, APP_DEFAULT_VIEW[app]);
    });
  });

  // 浏览器入口（特殊：非视图）
  $('appBrowser').addEventListener('click', () => {
    activateApp('browser');
    openBrowser();
  });

  // 音乐子导航点击 / 视图切换 → 同步高亮
  document.addEventListener('view:switched', (e) => {
    const view = e.detail && e.detail.view;
    if (view && APP_OF_VIEW[view]) activateApp(APP_OF_VIEW[view]);
  });

  // 浏览器关闭 → 回到音乐
  document.addEventListener('browser:closed', () => {
    activateApp('music', 'local');
  });
}

function activateApp(app, view) {
  // 高亮
  document.querySelectorAll('.app-item').forEach((i) => {
    i.classList.remove('active');
    i.setAttribute('aria-selected', 'false');
  });
  const target = app === 'browser' ? $('appBrowser') : document.querySelector(`.app-item[data-app="${app}"]`);
  if (target) {
    target.classList.add('active');
    target.setAttribute('aria-selected', 'true');
  }
  // 音乐子导航显隐
  $('musicNav').style.display = app === 'music' ? '' : 'none';

  // 音乐专属 UI 只在音乐应用显示：
  // 顶部搜索框 / 平台标签 / 左侧播放面板 / 底部播放条
  // （天气与城市诗句是全局氛围，所有功能都保留）
  const musicOnly = app === 'music';
  document.querySelectorAll('.search-box, .platform-tabs, .player-bar').forEach((el) => {
    el.style.display = musicOnly ? '' : 'none';
  });
  const panelLeft = document.querySelector('.panel-left');
  if (panelLeft) panelLeft.style.display = musicOnly ? '' : 'none';
  // 非音乐界面工作区变单列，避免左侧空档
  const ws = document.querySelector('.workspace');
  if (ws) ws.style.gridTemplateColumns = musicOnly ? '' : '1fr';

  // 切换到目标视图
  if (app !== 'browser' && view) {
    const current = store.get('view');
    if (APP_OF_VIEW[current] !== app) {
      switchView(view);
    } else if (view && current !== view) {
      switchView(view);
    }
  }
}

export default { initAppSwitch };
