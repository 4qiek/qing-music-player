/**
 * favorites.js — 我的收藏视图
 * 职责：渲染收藏列表（localStorage 持久化），支持点击播放。
 */
import { store } from './store.js';
import { renderSongList } from './search.js';
import { switchView } from './view.js';
import { playOnline } from './player.js';
import { isFavorite, favoriteKey, toggleFavorite } from './player.js';

const $ = (id) => document.getElementById(id);

function renderFavorites() {
  const list = $('favoritesList');
  const favs = store.get('favorites') || [];
  $('favoritesSub').textContent = favs.length ? `共 ${favs.length} 首收藏歌曲` : '收藏的歌曲会显示在这里';
  if (!favs.length) {
    list.innerHTML = '<div class="empty-state"><div class="big-icon"><svg style="width:48px;height:48px"><use href="#i-heart"/></svg></div><p>还没有收藏任何歌曲</p><p class="sub-hint">播放时点击歌曲名旁的 ♥ 即可收藏</p></div>';
    return;
  }
  store.set('searchResults', favs);
  store.set('currentQueue', favs);
  renderSongList(list, favs);
  // 每行加取消收藏按钮
  list.querySelectorAll('.song-row').forEach((row, i) => {
    const btn = document.createElement('button');
    btn.className = 'row-fav active';
    btn.title = '取消收藏';
    btn.innerHTML = '<svg style="width:14px;height:14px"><use href="#i-heart"/></svg>';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(favs[i]);
    });
    row.appendChild(btn);
  });
}

export function initFavorites() {
  document.addEventListener('view:favorites', renderFavorites);
  // 收藏变化时若当前在收藏视图则刷新
  store.subscribe('favorites', () => {
    if (store.get('view') === 'favorites') renderFavorites();
  });
}

export default { initFavorites, renderFavorites };
