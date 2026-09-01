/**
 * view.js — 视图切换
 * 本地音乐 / 在线搜索 / 歌单 三个视图的切换与导航高亮。
 */
import { store } from './store.js';

const $ = (id) => document.getElementById(id);

export function switchView(view) {
  store.set('view', view);
  $('view-local').style.display = view === 'local' ? 'block' : 'none';
  $('view-search').style.display = view === 'search' ? 'block' : 'none';
  $('view-playlist').style.display = view === 'playlist' ? 'block' : 'none';
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
