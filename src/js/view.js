/**
 * view.js — 视图切换
 * 本地音乐 / 在线搜索 / 歌单 / 排行榜 / 每日推荐 / 收藏 / 历史
 */
import { store } from './store.js';

const $ = (id) => document.getElementById(id);

const VIEW_IDS = ['local', 'search', 'playlist', 'toplist', 'recommend', 'favorites', 'history'];

// 进入某视图时派发懒加载事件（由对应模块监听）
const LOAD_EVENT = {
  toplist: 'view:toplist',
  recommend: 'view:recommend',
  favorites: 'view:favorites',
  history: 'view:history'
};

export function switchView(view) {
  store.set('view', view);
  VIEW_IDS.forEach((v) => {
    const el = $('view-' + v);
    if (el) el.style.display = v === view ? 'block' : 'none';
  });
  if (LOAD_EVENT[view]) {
    document.dispatchEvent(new CustomEvent(LOAD_EVENT[view]));
  }
}

export function initNavigation() {
  document.querySelectorAll('.nav-item[data-view]').forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
      item.classList.add('active');
      switchView(item.dataset.view);
    });
  });
}

export default { switchView, initNavigation };
