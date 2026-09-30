/**
 * favorites.js — 我的收藏视图
 * 职责：渲染收藏列表（localStorage 持久化），支持点击播放。
 * 行尾收藏/更多操作由 rowActions.js 统一注入（悬停浮出）。
 */
import { store } from './store.js';
import { renderSongList } from './trackRow.js';
import { emptyIll } from './ui.js';

const $ = (id) => document.getElementById(id);

function renderFavorites() {
  const list = $('favoritesList');
  const favs = store.get('favorites') || [];
  $('favoritesSub').textContent = favs.length ? `共 ${favs.length} 首收藏歌曲` : '收藏的歌曲会显示在这里';
  if (!favs.length) {
    list.innerHTML = `<div class="empty-state">${emptyIll('heart')}<p class="es-title">还没有收藏任何歌曲</p><p class="es-sub">悬停歌曲行点击心形，或播放时点击 ♥ 即可收藏</p></div>`;
    return;
  }
  store.set('searchResults', favs);
  store.set('currentQueue', favs);
  renderSongList(list, favs);
}

export function initFavorites() {
  document.addEventListener('view:favorites', renderFavorites);
  // 收藏变化时若当前在收藏视图则刷新
  store.subscribe('favorites', () => {
    if (store.get('view') === 'favorites') renderFavorites();
  });
}

export default { initFavorites, renderFavorites };
