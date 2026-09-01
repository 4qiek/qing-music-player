/**
 * video.js — 本地视频播放模块
 * 职责：视频导入、列表渲染、全屏播放（<video>），
 *       以及按文件名到豆瓣在线匹配片名 / 年份 / 导演主演 / 海报。
 */
import { store } from './store.js';
import { apiClient } from './apiClient.js';
import { eventBus } from './eventBus.js';
import { sleep } from './utils.js';
import { cleanVideoKeyword, fetchMatch, bindCoverFallback } from './metaMatch.js';

const $ = (id) => document.getElementById(id);

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

function escapeName(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function initVideo() {
  const fileInput = $('videoFileInput');
  $('videoImportBtn').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const videos = files.map((f) => ({
      id: 'vid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      name: f.name.replace(/\.[^.]+$/, ''),
      ext: (f.name.split('.').pop() || '').toUpperCase(),
      size: f.size,
      matchedId: null,
      file: f,
      url: URL.createObjectURL(f)
    }));
    store.set('localVideos', [...store.get('localVideos'), ...videos]);
    renderVideoList();
    e.target.value = '';
  });

  const matchAllBtn = $('videoMatchAllBtn');
  if (matchAllBtn) matchAllBtn.addEventListener('click', () => matchAllVideos());

  // 全屏播放器关闭（按钮 + Esc）
  $('videoPlayerClose').addEventListener('click', closeVideo);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('videoPlayerOverlay').style.display !== 'none') closeVideo();
  });
}

/** 匹配单个视频（电影 / 剧集） */
export async function matchVideo(idx) {
  const videos = store.get('localVideos');
  const v = videos[idx];
  if (!v) return null;
  const kw = cleanVideoKeyword(v.name);
  let hit = null;
  try {
    hit = await fetchMatch(apiClient, kw, 'movie');
  } catch (e) {
    hit = null;
  }
  if (hit) {
    v.matchedId = hit.id;
    v.matchedName = hit.name;
    v.metaType = hit.type;
    v.info = hit.card;
    v.year = hit.year;
    v.cover = hit.cover;
    store.set('localVideos', videos);
    renderVideoList();
  }
  return hit;
}

/** 一键匹配全部视频 */
export async function matchAllVideos() {
  const videos = store.get('localVideos');
  if (!videos.length) {
    eventBus.emit('toast', { type: 'info', message: '请先导入视频' });
    return;
  }
  const need = videos.map((v, i) => i).filter((i) => !videos[i].matchedId);
  if (!need.length) {
    eventBus.emit('toast', { type: 'info', message: '全部视频已匹配过了' });
    return;
  }
  const btn = $('videoMatchAllBtn');
  if (btn) { btn.disabled = true; btn.textContent = `匹配中 0/${need.length}`; }
  let ok = 0, fail = 0;
  for (let n = 0; n < need.length; n++) {
    if (btn) btn.textContent = `匹配中 ${n + 1}/${need.length}`;
    try {
      const hit = await matchVideo(need[n]);
      if (hit) ok++; else fail++;
    } catch (e) { fail++; }
    await sleep(280);
  }
  if (btn) { btn.disabled = false; btn.textContent = '☁ 匹配线上信息'; }
  eventBus.emit('toast', {
    type: fail ? 'info' : 'success',
    message: `匹配完成：成功 ${ok} 部` + (fail ? `，${fail} 部未找到` : '')
  });
}

export function renderVideoList() {
  const el = $('videoList');
  const videos = store.get('localVideos');
  if (!videos.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="big-icon"><svg style="width:48px;height:48px"><use href="#i-video"/></svg></div>
        <p>还没有导入视频</p>
        <button class="btn btn-primary" onclick="document.getElementById('videoFileInput').click()">选择本地视频文件</button>
      </div>`;
    return;
  }
  let html = '<div class="song-list-header"><span>#</span><span></span><span>标题</span><span>年份 / 信息</span><span style="text-align:right">大小</span><span>操作</span></div>';
  videos.forEach((v, i) => {
    const coverHtml = v.cover
      ? `<img class="s-cover" src="${v.cover}" alt="" loading="lazy" referrerpolicy="no-referrer" style="object-fit:cover;">`
      : `<div class="s-cover" style="background:var(--hover);display:flex;align-items:center;justify-content:center;"><svg style="width:16px;height:16px;color:var(--text2)"><use href="#i-video"/></svg></div>`;
    const matched = !!v.matchedId;
    const sub = matched
      ? `${v.year ? v.year + ' · ' : ''}${escapeName(v.info || (v.metaType === 'tv' ? '剧集' : '电影'))}`
      : escapeName(v.ext);
    const matchBtn = matched
      ? `<button class="row-ok" data-match="${i}" title="已匹配：${escapeName(v.matchedName || v.name)}（点击重新匹配）" aria-label="重新匹配"><svg><use href="#i-check"/></svg></button>`
      : `<button class="row-match" data-match="${i}" title="联网匹配片名/年份/海报" aria-label="匹配线上信息"><svg><use href="#i-cloud"/></svg></button>`;
    html += `<div class="song-row ${matched ? 'matched' : ''}" data-idx="${i}" title="点击全屏播放">
      <span class="idx">${i + 1}</span>
      <span>${coverHtml}</span>
      <span class="s-name">${escapeName(v.name)}<span class="row-tag">${escapeName(v.ext)}</span></span>
      <span class="s-artist">${sub}</span>
      <span class="s-dur">${formatSize(v.size)}</span>
      <span class="s-platform">本地
        ${matchBtn}
        <button class="row-del" data-del="${i}" title="从列表中移除" aria-label="移除"><svg><use href="#i-trash"/></svg></button>
      </span>
    </div>`;
  });
  el.innerHTML = html;
  bindCoverFallback(el, '#i-video');
  el.querySelectorAll('.song-row').forEach((row) =>
    row.addEventListener('click', () => openVideo(+row.dataset.idx))
  );
  el.querySelectorAll('.row-del').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeVideo(+btn.dataset.del);
    })
  );
  el.querySelectorAll('.row-match, .row-ok').forEach((btn) =>
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const idx = +btn.dataset.match;
      btn.classList.add('loading');
      const hit = await matchVideo(idx);
      if (!hit) eventBus.emit('toast', { type: 'info', message: '未找到对应的影视信息' });
      else eventBus.emit('toast', { type: 'success', message: `已匹配：${hit.name}（${hit.year || '未知年份'}）` });
    })
  );
}

/** 从视频列表移除指定项 */
export function removeVideo(idx) {
  const videos = store.get('localVideos');
  if (idx < 0 || idx >= videos.length) return;
  const v = videos[idx];
  try { if (v.url && v.url.startsWith('blob:')) URL.revokeObjectURL(v.url); } catch (e) {}
  videos.splice(idx, 1);
  store.set('localVideos', videos);
  renderVideoList();
}

/** 打开全屏视频播放 */
export function openVideo(idx) {
  const v = store.get('localVideos')[idx];
  if (!v) return;
  const player = $('videoPlayer');
  $('videoPlayerTitle').textContent = v.matchedName
    ? v.matchedName + (v.year ? '（' + v.year + '）' : '')
    : v.name;
  $('videoPlayerOverlay').style.display = 'flex';
  player.src = v.url;
  player.play().catch(() => {});
}

/** 关闭全屏视频播放 */
export function closeVideo() {
  const player = $('videoPlayer');
  player.pause();
  player.removeAttribute('src');
  player.load();
  $('videoPlayerOverlay').style.display = 'none';
}

export default { initVideo, renderVideoList, openVideo, closeVideo, removeVideo, matchVideo, matchAllVideos };
