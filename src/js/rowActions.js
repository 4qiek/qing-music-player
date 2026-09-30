/**
 * rowActions.js — 列表行悬停操作
 * 通过 MutationObserver 自动给各歌曲列表的 .song-row 行尾注入
 * 「收藏 / 更多」两个悬停按钮（纯 DOM 注入，不改各模块渲染逻辑）；
 * 事件委托挂在捕获阶段：收藏复用 player.toggleFavorite；
 * 「更多」向行派发合成 contextmenu，复用 playlists.js 的右键上下文菜单。
 */
import { store } from './store.js';
import { toggleFavorite, isFavorite } from './player.js';
import { trackFromRow } from './playlists.js';

// 仅注入音乐类列表（在线搜索列表已随在线音乐功能移除）
const LIST_SELECTOR = '#localList,#playlistList,#favoritesList,#historyList';

const OPS_HTML = `
  <button class="row-act-fav" title="收藏" aria-label="收藏"><svg><use href="#i-heart"/></svg></button>
  <button class="row-act-more" title="更多" aria-label="更多操作"><svg><use href="#i-more"/></svg></button>`;

/** 刷新单行收藏心形状态 */
function syncFav(row) {
  const btn = row.querySelector('.row-act-fav');
  if (!btn) return;
  const t = trackFromRow(row);
  const on = !!(t && isFavorite(t));
  btn.classList.toggle('active', on);
  btn.title = on ? '取消收藏' : '收藏';
}

/** 给单行行尾注入操作区（幂等） */
function inject(row) {
  if (row.querySelector('.row-ops')) return;
  if (!row.closest(LIST_SELECTOR)) return;
  const cell = row.querySelector('.s-platform');
  if (!cell) return;
  const ops = document.createElement('span');
  ops.className = 'row-ops';
  ops.innerHTML = OPS_HTML;
  cell.appendChild(ops);
  syncFav(row);
}

/** 扫描新增节点中的歌曲行 */
function scan(node) {
  if (!(node instanceof Element)) return;
  if (node.classList.contains('song-row')) inject(node);
  node.querySelectorAll('.song-row').forEach(inject);
}

export function initRowActions() {
  // 初始注入 + 监听后续各列表的增量渲染
  document.querySelectorAll('.song-row').forEach(inject);
  new MutationObserver((muts) => {
    muts.forEach((m) => m.addedNodes.forEach(scan));
  }).observe(document.body, { childList: true, subtree: true });

  // 捕获阶段委托：拦截按钮点击，避免触发行播放或菜单被全局 click 立即关闭
  document.addEventListener('click', (e) => {
    const favBtn = e.target.closest('.row-act-fav');
    const moreBtn = e.target.closest('.row-act-more');
    if (!favBtn && !moreBtn) return;
    e.stopPropagation();
    e.preventDefault();
    const row = e.target.closest('.song-row');
    if (!row) return;
    if (favBtn) {
      const t = trackFromRow(row);
      if (t) {
        toggleFavorite(t);
        syncFav(row);
      }
      return;
    }
    // 更多：以按钮位置弹出与右键一致的上下文菜单
    const r = moreBtn.getBoundingClientRect();
    row.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: Math.min(r.left, window.innerWidth - 180),
      clientY: r.bottom + 4
    }));
  }, true);

  // 收藏集合变化时刷新所有行的心形状态
  store.subscribe('favorites', () => {
    document.querySelectorAll('.song-row').forEach(syncFav);
  });
}

export default { initRowActions };
