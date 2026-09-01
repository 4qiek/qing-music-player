/**
 * localLibrary.js — 本地音乐管理
 * 负责本地文件导入、列表渲染、播放入口；
 *  - 导入时读取内嵌 ID3 标签（标题/歌手/专辑/封面/歌词）
 *  - 可按歌名到网易云在线匹配（matchedId，用于在线歌词补全）
 *  - 同时支持手动选入(File)与文件夹/下载的路径项(path)
 */
import { store } from './store.js';
import { playLocal } from './player.js';
import { apiClient } from './apiClient.js';
import { eventBus } from './eventBus.js';
import { sleep, PLATFORM_LABEL } from './utils.js';
import { bindCoverFallback } from './metaMatch.js';
import { enrichAudio } from './mediaLib.js';

const $ = (id) => document.getElementById(id);

/** 由文件名构造搜索关键词：去扩展名、音质标签、多余符号 */
function buildKeyword(name) {
  return String(name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/\b(320kbps|192kbps|128kbps|320|192|128|flac|mp3|无损|高品质|hq|sq)\b/gi, ' ')
    .replace(/[【\[\(][^】\]\)]*(?:kbps|kb|比特率|音质)[】\]\)]/gi, ' ')
    .replace(/[._]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeName(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function trackTitle(t) {
  return t.matchedName || (t.name || '').replace(/\.[^.]+$/, '');
}

/** 绑定导入控件事件 */
export function initLocalLibrary() {
  const fileInput = $('fileInput');
  $('importBtn').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    const list = store.get('localTracks');
    const exist = new Set(list.map((x) => (x.path || x.name) + '|' + (x.size || 0)));
    const added = [];
    files.forEach((f, k) => {
      const key = f.name + '|' + f.size;
      if (exist.has(key)) return;
      exist.add(key);
      const t = {
        id: 'local_' + Date.now() + '_' + k + '_' + Math.random().toString(36).slice(2, 7),
        origin: 'file', file: f,
        name: f.name,
        ext: (f.name.split('.').pop() || '').toLowerCase(),
        size: f.size,
        artist: '', album: '', cover: '', duration: 0,
        platform: 'local', matchedId: null, matchedName: '', embeddedLyric: '',
        url: URL.createObjectURL(f)
      };
      list.push(t);
      added.push(t);
    });
    store.set('localTracks', list);
    renderLocalList();
    added.forEach((t) => enrichAudio(t));
    e.target.value = '';
  });

  const matchAllBtn = $('matchAllBtn');
  if (matchAllBtn) matchAllBtn.addEventListener('click', () => matchAllLocal());

  // 媒体库变化（文件夹扫描 / 下载归库 / ID3 回填）时刷新
  eventBus.on('library:changed', ({ kind }) => {
    if (kind === 'audio' && store.get('view') === 'local') renderLocalList();
  });
}

/** 匹配单首本地曲目：按歌名搜网易云，取最佳结果补全元数据 */
export async function matchLocal(idx) {
  const tracks = store.get('localTracks');
  const t = tracks[idx];
  if (!t) return null;
  const kw = buildKeyword(t.matchedName || t.name);
  if (!kw) return null;
  let res;
  try {
    res = await apiClient.neteaseSearch(kw);
  } catch (e) {
    eventBus.emit('toast', { type: 'error', message: '网络异常，匹配失败' });
    return null;
  }
  const list = res && !res.error && Array.isArray(res) ? res : [];
  if (!list.length) return null;
  const lc = kw.toLowerCase();
  const hit = list.find((x) => x.name && x.name.toLowerCase() === lc) || list[0];
  t.matchedId = hit.id;
  t.matchedName = hit.name || trackTitle(t);
  t.artist = hit.artist || t.artist;
  t.album = hit.album || t.album || '';
  t.cover = hit.cover || t.cover || '';
  if (hit.duration) t.duration = hit.duration;
  store.set('localTracks', tracks);
  renderLocalList();
  return hit;
}

/** 一键匹配所有尚未匹配在线信息的本地曲目 */
export async function matchAllLocal() {
  const tracks = store.get('localTracks');
  if (!tracks.length) {
    eventBus.emit('toast', { type: 'info', message: '请先导入本地音乐' });
    return;
  }
  const need = tracks.map((t, i) => i).filter((i) => !tracks[i].matchedId);
  if (!need.length) {
    eventBus.emit('toast', { type: 'info', message: '全部曲目已匹配过了' });
    return;
  }
  const btn = $('matchAllBtn');
  if (btn) { btn.disabled = true; btn.textContent = `匹配中 0/${need.length}`; }
  let ok = 0, fail = 0;
  for (let n = 0; n < need.length; n++) {
    const i = need[n];
    if (btn) btn.textContent = `匹配中 ${n + 1}/${need.length}`;
    try {
      const hit = await matchLocal(i);
      if (hit) ok++; else fail++;
    } catch (e) { fail++; }
    await sleep(280);
  }
  if (btn) { btn.disabled = false; btn.textContent = '☁ 匹配线上信息'; }
  eventBus.emit('toast', {
    type: fail ? 'info' : 'success',
    message: `匹配完成：成功 ${ok} 首` + (fail ? `，${fail} 首未找到` : '')
  });
}

/** 渲染本地列表 */
export function renderLocalList() {
  const el = $('localList');
  if (!el) return;
  const localTracks = store.get('localTracks');
  if (localTracks.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="big-icon"><svg style="width:48px;height:48px"><use href="#i-music"/></svg></div>
        <p>还没有导入音乐</p>
        <p class="sub-hint">可「导入音乐」或「添加文件夹」自动扫描</p>
      </div>`;
    return;
  }
  let html = '<div class="song-list-header"><span>#</span><span></span><span>标题</span><span>歌手</span><span style="text-align:right">时长</span><span>操作</span></div>';
  localTracks.forEach((t, i) => {
    const coverHtml = t.cover
      ? `<img class="s-cover" src="${t.cover}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : `<div class="s-cover" style="background:var(--hover);display:flex;align-items:center;justify-content:center;"><svg style="width:16px;height:16px;color:var(--text2)"><use href="#i-music"/></svg></div>`;
    const matched = !!(t.matchedId || t.matchedName);
    const matchBtn = t.matchedId
      ? `<button class="row-ok" data-match="${i}" title="已匹配：${escapeName(t.matchedName || t.name)}（点击重新匹配）" aria-label="重新匹配"><svg><use href="#i-check"/></svg></button>`
      : `<button class="row-match" data-match="${i}" title="联网匹配歌手/专辑/封面/歌词" aria-label="匹配线上信息"><svg><use href="#i-cloud"/></svg></button>`;
    html += `<div class="song-row ${matched ? 'matched' : ''}" data-type="local" data-idx="${i}">
      <span class="idx">${i + 1}</span>
      <span>${coverHtml}</span>
      <span class="s-name">${escapeName(trackTitle(t))}</span>
      <span class="s-artist">${escapeName(t.artist || '本地曲目')}</span>
      <span class="s-dur">${t.duration ? fmtDur(t.duration) : '--:--'}</span>
      <span class="s-platform">
        本地
        ${matchBtn}
        <button class="row-del" data-del="${i}" title="从列表中移除" aria-label="移除"><svg><use href="#i-trash"/></svg></button>
      </span>
    </div>`;
  });
  el.innerHTML = html;
  bindCoverFallback(el, '#i-music');
  el.querySelectorAll('.song-row').forEach((row) =>
    row.addEventListener('click', () => playLocal(+row.dataset.idx))
  );
  el.querySelectorAll('.row-del').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeLocal(+btn.dataset.del);
    })
  );
  el.querySelectorAll('.row-match, .row-ok').forEach((btn) =>
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const idx = +btn.dataset.match;
      const hit = await matchLocal(idx);
      if (!hit) eventBus.emit('toast', { type: 'info', message: '未找到对应的线上歌曲' });
      else eventBus.emit('toast', { type: 'success', message: `已匹配：${hit.artist || ''} - ${hit.name}` });
    })
  );
}

function fmtDur(ms) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 从本地列表移除指定项 */
export function removeLocal(idx) {
  const tracks = store.get('localTracks');
  if (idx < 0 || idx >= tracks.length) return;
  const t = tracks[idx];
  try { if (t.url && t.url.startsWith('blob:')) URL.revokeObjectURL(t.url); } catch (e) {}
  tracks.splice(idx, 1);
  store.set('localTracks', tracks);
  renderLocalList();
}

export default { initLocalLibrary, renderLocalList, removeLocal, matchLocal, matchAllLocal, PLATFORM_LABEL };
