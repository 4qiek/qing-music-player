/**
 * video.js — 本地视频播放模块
 * 职责：视频导入、列表渲染、全屏播放（<video>）。
 */
import { store } from './store.js';

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
      file: f,
      url: URL.createObjectURL(f)
    }));
    store.set('localVideos', [...store.get('localVideos'), ...videos]);
    renderVideoList();
    e.target.value = '';
  });

  // 全屏播放器关闭（按钮 + Esc）
  $('videoPlayerClose').addEventListener('click', closeVideo);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('videoPlayerOverlay').style.display !== 'none') closeVideo();
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
  let html = '<div class="song-list-header"><span>#</span><span></span><span>标题</span><span>格式</span><span style="text-align:right">大小</span><span></span></div>';
  videos.forEach((v, i) => {
    html += `<div class="song-row" data-idx="${i}" title="点击全屏播放">
      <span class="idx">${i + 1}</span>
      <span><div class="s-cover" style="background:var(--hover);display:flex;align-items:center;justify-content:center;"><svg style="width:16px;height:16px;color:var(--text2)"><use href="#i-video"/></svg></div></span>
      <span class="s-name">${escapeName(v.name)}</span>
      <span class="s-artist">${escapeName(v.ext)}</span>
      <span class="s-dur">${formatSize(v.size)}</span>
      <span class="s-platform">本地<button class="row-del" data-del="${i}" title="从列表中移除" aria-label="移除"><svg><use href="#i-trash"/></svg></button></span>
    </div>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('.song-row').forEach((row) =>
    row.addEventListener('click', () => openVideo(+row.dataset.idx))
  );
  el.querySelectorAll('.row-del').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeVideo(+btn.dataset.del);
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
  $('videoPlayerTitle').textContent = v.name;
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

export default { initVideo, renderVideoList, openVideo, closeVideo, removeVideo };
