/**
 * trackRow.js — 通用歌曲行渲染
 *
 * 背景：原先收藏 / 历史列表复用 search.js 的 renderSongList，
 * 而行点击绑定的是在线播放入口 playOnline()。在线音乐功能移除后，
 * 这两处的本地曲目点击会彻底失效，因此把行渲染抽成独立模块，
 * 点击统一走本地队列播放入口 player.playQueueIndex()。
 *
 * 说明：本模块只渲染本地曲目列表（收藏 / 历史），
 * 在线曲目在加载阶段已被过滤，这里再兜底拦一道。
 */
import { store } from './store.js';
import { playQueueIndex } from './player.js';
import { eventBus } from './eventBus.js';
import { escapeHtml, PLATFORM_LABEL } from './utils.js';
import { isLocalTrack } from './trackUtil.js';
import { emptyIll } from './ui.js';

/**
 * 秒 → mm:ss
 * @param {number} d 秒
 * @returns {string}
 */
export function formatDur(d) {
  if (!d || isNaN(d)) return '--:--';
  const m = Math.floor(d / 60);
  const s = Math.floor(d % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

/**
 * 渲染歌曲列表到指定容器（收藏 / 历史等本地列表共用）
 * @param {HTMLElement} el 列表容器
 * @param {Array<object>} tracks 曲目数组（应为本地曲目）
 */
export function renderSongList(el, tracks) {
  if (!tracks || tracks.length === 0) {
    el.innerHTML = `<div class="empty-state">${emptyIll('search')}<p class="es-title">没有找到相关歌曲</p><p class="es-sub">换个关键词试试</p></div>`;
    return;
  }
  let html = '<div class="song-list-header"><span>#</span><span></span><span>标题</span><span>歌手</span><span style="text-align:right">时长</span><span>来源</span></div>';
  tracks.forEach((t, i) => {
    const coverHtml = t.cover
      ? `<img class="s-cover" src="${t.cover}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : `<div class="s-cover" style="display:flex;align-items:center;justify-content:center;"><svg style="width:16px;height:16px;color:var(--text2)"><use href="#i-music"/></svg></div>`;
    const label = isLocalTrack(t) ? '本地' : (PLATFORM_LABEL[t.platform] || '');
    html += `<div class="song-row" data-idx="${i}">
      <span class="idx">${i + 1}</span>
      <span>${coverHtml}</span>
      <span class="s-name">${escapeHtml(t.matchedName || t.name)}</span>
      <span class="s-artist">${escapeHtml(t.artist)}</span>
      <span class="s-dur">${formatDur(t.duration)}</span>
      <span class="s-platform">${label}</span>
    </div>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('.song-row').forEach((row) => {
    row.addEventListener('click', () => {
      const idx = +row.dataset.idx;
      const t = tracks[idx];
      if (!t) return;
      // 在线播放已移除：非本地曲目（历史残留数据）不再尝试请求接口
      if (!isLocalTrack(t)) {
        eventBus.emit('toast', { type: 'info', message: '该曲目为在线歌曲，在线音乐功能已移除' });
        return;
      }
      // 以当前列表重建队列后再按下标播放，避免 currentQueue 被其它列表覆盖导致串曲
      store.set('currentQueue', [...tracks]);
      playQueueIndex(idx);
    });
  });
}

export default { renderSongList, formatDur };
