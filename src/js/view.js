/**
 * view.js — 视图切换
 * 本地音乐 / 歌单 / 收藏 / 历史 / 视频 / 图片 / 书籍
 * （在线搜索 / 排行榜 / 每日推荐三个在线视图已随在线音乐功能移除）
 */
import { store } from './store.js';

const $ = (id) => document.getElementById(id);

const VIEW_IDS = ['local', 'playlist', 'favorites', 'history', 'video', 'image', 'book'];

// 进入某视图时派发懒加载事件（由对应模块监听）
const LOAD_EVENT = {
  favorites: 'view:favorites',
  history: 'view:history'
};

export function switchView(view) {
  store.set('view', view);
  VIEW_IDS.forEach((v) => {
    const el = $('view-' + v);
    if (el) el.style.display = v === view ? 'block' : 'none';
  });
  // 各视图（视频/图片/书籍/排行榜等）模块监听自身的 view:<name> 事件以懒加载
  document.dispatchEvent(new CustomEvent('view:' + view));
  if (LOAD_EVENT[view]) {
    document.dispatchEvent(new CustomEvent(LOAD_EVENT[view]));
  }
  // 通知其他模块（如浏览器模式需关闭）
  document.dispatchEvent(new CustomEvent('view:switched', { detail: { view } }));
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
