/**
 * discover.js — 发现页
 * 职责：排行榜（网易云官方榜）、每日推荐（热门推荐歌单）两个视图。
 */
import { store } from './store.js';
import { apiClient } from './apiClient.js';
import { renderSongList } from './search.js';
import { switchView } from './view.js';
import { showSkeleton } from './ui.js';
import { escapeHtml, formatNum } from './utils.js';

const $ = (id) => document.getElementById(id);

let toplistLoaded = false;
let recommendLoaded = false;

function renderGrid(container, items, opts = {}) {
  if (!items || !items.length) {
    container.innerHTML = '<div class="empty-state"><p>暂无数据，请检查网络后刷新</p></div>';
    return;
  }
  container.innerHTML = items.map((it) => `
    <div class="disc-card" role="button" tabindex="0" data-id="${escapeHtml(it.id)}" data-idx="${it.idx !== undefined ? it.idx : ''}">
      <div class="disc-cover">
        ${it.cover
          ? `<img src="${it.cover}" alt="" loading="lazy" referrerpolicy="no-referrer">`
          : `<div class="disc-cover-fallback"><svg style="width:26px;height:26px;color:var(--text-3)"><use href="#i-music"/></svg></div>`}
        <div class="disc-play"><svg style="width:16px;height:16px"><use href="#i-play"/></svg></div>
      </div>
      <div class="disc-name">${escapeHtml(it.name)}</div>
      ${opts.sub && it[opts.sub] ? `<div class="disc-sub">${escapeHtml(String(it[opts.sub]))}</div>` : ''}
    </div>`).join('');
}

function bindGridClicks(container, handler) {
  container.querySelectorAll('.disc-card').forEach((card) => {
    const open = () => handler(card.dataset.id, card.dataset.idx, card);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });
}

// ===== 排行榜 =====
async function loadToplist() {
  if (toplistLoaded) return;
  toplistLoaded = true;
  const grid = $('toplistGrid');
  showSkeleton(grid, 6);
  const res = await apiClient.neteaseToplist({ force: true });
  if (!res || res.error) {
    grid.innerHTML = `<div class="empty-state"><p>排行榜加载失败：${escapeHtml((res && res.error) || '网络异常')}</p></div>`;
    return;
  }
  const items = res.map((t, i) => ({ ...t, idx: i, subText: t.updateFrequency || `${formatNum(t.playCount)} 播放` }));
  renderGrid(grid, items.map((it) => ({
    id: it.id, idx: it.idx, name: it.name, cover: it.cover, updateFrequency: it.subText
  })), { sub: 'updateFrequency' });
  bindGridClicks(grid, async (id, idx, card) => {
    const name = card.querySelector('.disc-name').textContent;
    $('playlistTitle').textContent = name;
    $('playlistSub').textContent = '正在加载榜单歌曲…';
    $('playlistList').innerHTML = '<div class="loading">加载中</div>';
    // 榜单 id 即官方歌单 id，复用歌单详情接口
    const tracks = await apiClient.neteaseTopDetail(id, { force: true });
    if (!tracks || tracks.error) {
      $('playlistList').innerHTML = `<div class="empty-state"><p>加载失败：${escapeHtml((tracks && tracks.error) || '网络异常')}</p></div>`;
      return;
    }
    store.set('searchResults', tracks);
    store.set('currentQueue', tracks);
    renderSongList($('playlistList'), tracks);
    $('playlistSub').textContent = `${name} · ${tracks.length} 首`;
    switchView('playlist');
  });
}

// ===== 每日推荐（推荐歌单） =====
async function loadRecommend() {
  if (recommendLoaded) return;
  recommendLoaded = true;
  const grid = $('recommendGrid');
  showSkeleton(grid, 6);
  const res = await apiClient.neteasePersonalized(30, { force: true });
  if (!res || res.error) {
    grid.innerHTML = `<div class="empty-state"><p>推荐加载失败：${escapeHtml((res && res.error) || '网络异常')}</p></div>`;
    return;
  }
  const items = res.map((p) => ({ ...p, subText: `${formatNum(p.playCount)} 播放` }));
  renderGrid(grid, items.map((p) => ({ id: p.id, name: p.name, cover: p.cover, playCountText: p.subText })), { sub: 'playCountText' });
  bindGridClicks(grid, async (id, idx, card) => {
    const name = card.querySelector('.disc-name').textContent;
    $('playlistTitle').textContent = name;
    $('playlistSub').textContent = '正在加载歌单歌曲…';
    $('playlistList').innerHTML = '<div class="loading">加载中</div>';
    const res2 = await apiClient.neteasePlaylistDetail(id, { force: true });
    if (!res2 || res2.error) {
      $('playlistList').innerHTML = `<div class="empty-state"><p>加载失败：${escapeHtml((res2 && res2.error) || '网络异常')}</p></div>`;
      return;
    }
    const tracks = Array.isArray(res2) ? res2 : (res2.tracks || []);
    store.set('searchResults', tracks);
    store.set('currentQueue', tracks);
    renderSongList($('playlistList'), tracks);
    $('playlistSub').textContent = `${name} · ${tracks.length} 首`;
    switchView('playlist');
  });
}

export function initDiscover() {
  document.addEventListener('view:toplist', loadToplist);
  document.addEventListener('view:recommend', loadRecommend);
  const tRefresh = $('toplistRefresh');
  if (tRefresh) tRefresh.addEventListener('click', () => { toplistLoaded = false; loadToplist(); });
  const rRefresh = $('recommendRefresh');
  if (rRefresh) rRefresh.addEventListener('click', () => { recommendLoaded = false; loadRecommend(); });
}

export default { initDiscover };
