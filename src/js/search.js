/**
 * search.js — 在线搜索
 * 职责：搜索框 300ms 防抖、平台切换、歌曲列表渲染。
 */
import { store } from './store.js';
import { eventBus } from './eventBus.js';
import { apiClient } from './apiClient.js';
import { playOnline } from './player.js';
import { switchView } from './view.js';
import { debounce, escapeHtml } from './utils.js';

const $ = (id) => document.getElementById(id);

const PLATFORM_NAME = { netease: '网易云音乐', qq: 'QQ音乐', kugou: '酷狗音乐' };
const PLATFORM_LABEL = { netease: '网易', qq: 'QQ', kugou: '酷狗', local: '本地' };

let searchSeq = 0; // 防止过期响应覆盖新结果

/** 渲染歌曲列表到指定容器 */
export function renderSongList(el, tracks) {
  if (!tracks || tracks.length === 0) {
    el.innerHTML = '<div class="empty-state"><p>没有找到相关歌曲</p></div>';
    return;
  }
  let html = '<div class="song-list-header"><span>#</span><span></span><span>标题</span><span>歌手</span><span style="text-align:right">时长</span><span>平台</span></div>';
  tracks.forEach((t, i) => {
    const coverHtml = t.cover
      ? `<img class="s-cover" src="${t.cover}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : `<div class="s-cover" style="display:flex;align-items:center;justify-content:center;"><svg style="width:16px;height:16px;color:var(--text2)"><use href="#i-music"/></svg></div>`;
    html += `<div class="song-row" data-idx="${i}">
      <span class="idx">${i + 1}</span>
      <span>${coverHtml}</span>
      <span class="s-name">${escapeHtml(t.name)}</span>
      <span class="s-artist">${escapeHtml(t.artist)}</span>
      <span class="s-dur">${formatDur(t.duration)}</span>
      <span class="s-platform">${PLATFORM_LABEL[t.platform] || ''}</span>
    </div>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('.song-row').forEach((row) =>
    row.addEventListener('click', () => playOnline(+row.dataset.idx))
  );
}

function formatDur(d) {
  if (!d || isNaN(d)) return '--:--';
  const m = Math.floor(d / 60);
  const s = Math.floor(d % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

/** 执行搜索 */
export async function doSearch() {
  const kw = $('searchInput').value.trim();
  if (!kw) return;

  // 切换到搜索视图
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
  const searchNav = document.querySelector('.nav-item[data-view="search"]');
  if (searchNav) searchNav.classList.add('active');
  store.set('view', 'search');
  switchView('search');

  const seq = ++searchSeq;
  const platform = store.get('platform');
  $('searchSub').textContent = `正在搜索「${kw}」 - ${PLATFORM_NAME[platform]}`;
  $('searchList').innerHTML = '<div class="loading">搜索中</div>';

  let results;
  try {
    if (platform === 'netease') results = await apiClient.neteaseSearch(kw);
    else if (platform === 'qq') results = await apiClient.qqSearch(kw);
    else results = await apiClient.kugouSearch(kw);
  } catch (err) {
    if (seq === searchSeq) {
      $('searchList').innerHTML = `<div class="empty-state"><p>搜索失败，请检查网络后重试</p></div>`;
      eventBus.emit('toast', { type: 'error', message: '搜索失败，请检查网络' });
    }
    return;
  }

  if (seq !== searchSeq) return; // 已有更新的搜索，丢弃过期结果
  if (results.error) {
    $('searchList').innerHTML = `<div class="empty-state"><p>搜索失败：${escapeHtml(results.error)}</p></div>`;
    return;
  }
  store.set('searchResults', results);
  store.set('currentQueue', results);
  renderSongList($('searchList'), results);
  $('searchSub').textContent = `「${kw}」的搜索结果`;
}

/** 视图切换辅助（与 app.js 联动，避免循环依赖） */

/** 初始化搜索事件绑定 */
export function initSearch() {
  const searchInput = $('searchInput');
  // 回车立即搜索；输入 300ms 防抖
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });
  searchInput.addEventListener('input', debounce(doSearch, 300));

  // 平台切换
  document.querySelectorAll('.platform-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.platform-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      store.set('platform', tab.dataset.platform);
      // 若当前处于搜索视图且有关键词，立即重搜
      if (store.get('view') === 'search' && searchInput.value.trim()) doSearch();
    });
  });
}

export default { initSearch, doSearch, renderSongList };
