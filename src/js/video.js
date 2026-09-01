/**
 * video.js — 本地视频
 *  1. 视频库列表：电影平铺 + 剧集按 SxxExx 自动分组（季→集）
 *  2. 在线匹配影视信息（豆瓣，经 metaMatch）
 *  3. 全屏自定义播放器：进度拖拽 / 倍速 / 快进退 / 音量 / 画中画 / 全屏 /
 *     外挂字幕(srt/vtt，时间偏移、字号) / 断点续播 / 自动连播下一集 / 快捷键
 */
import { store } from './store.js';
import { eventBus } from './eventBus.js';
import { toast } from './ui.js';
import { apiClient } from './apiClient.js';
import { fetchMatch, bindCoverFallback, cleanVideoKeyword } from './metaMatch.js';
import { saveProgress, getProgress } from './persistence.js';

const $ = (id) => document.getElementById(id);
const VIDEO_EXTS = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv', 'ts', 'm4v', 'wmv', 'rmvb'];

function fmtSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / 1048576;
  return mb >= 1024 ? (mb / 1024).toFixed(2) + ' GB' : mb.toFixed(1) + ' MB';
}
function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
function esc(str) {
  return String(str || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function displayName(it) {
  return it.matchedName || (it.name || '').replace(/\.[^.]+$/, '');
}

// ===== 剧集识别 =====
const EP_PATTERNS = [
  /[Ss](\d{1,2})\s*[\.\-xX]?\s*[Ee](\d{1,3})/,          // S02E05
  /第\s*(\d{1,2})\s*季\s*第?\s*(\d{1,3})\s*[集话回]/,     // 第2季第5集
  /第\s*(\d{1,3})\s*[集话回]/,                            // 第5集（季=1）
  /(?:^|[\s\.\-\[])(\d{1,2})[xX](\d{1,3})(?=[\s\.\-\]]|$)/, // 2x05
  /[Ee][Pp]?\s*(\d{1,3})(?=[\s\.\-\]]|$)/                 // EP05 / E05
];
function parseEpisode(name) {
  const base = (name || '').replace(/\.[^.]+$/, '');
  for (let i = 0; i < EP_PATTERNS.length; i++) {
    const m = base.match(EP_PATTERNS[i]);
    if (m) {
      let season = 1, ep;
      if (i === 2 || i === 4) { ep = parseInt(m[1], 10); }
      else { season = parseInt(m[1], 10); ep = parseInt(m[2], 10); }
      if (ep >= 0 && ep < 1000) {
        let series = base.slice(0, m.index).replace(/[\s\.\-\_\[\(]+$/g, '');
        if (!series) series = base.replace(EP_PATTERNS[i], '').trim();
        return { series: series || '未命名剧集', season, ep };
      }
    }
  }
  return null;
}

/** 把视频列表分成：剧集组 {key,title,season,items[]} 与 电影 items[] */
function groupVideos(videos) {
  const groups = new Map();
  const movies = [];
  videos.forEach((it) => {
    const info = parseEpisode(it.name);
    if (info) {
      const key = info.series + '|S' + info.season;
      if (!groups.has(key)) groups.set(key, { key, title: info.series, season: info.season, items: [] });
      const g = groups.get(key);
      it._ep = info.ep;
      g.items.push(it);
    } else {
      movies.push(it);
    }
  });
  groups.forEach((g) => g.items.sort((a, b) => (a._ep || 0) - (b._ep || 0)));
  return { groups: Array.from(groups.values()).sort((a, b) => a.title.localeCompare(b.title, 'zh')), movies };
}

// ===== 列表渲染 =====
function rowHtml(it, epTag) {
  const cover = it.cover
    ? `<img class="s-cover" src="${it.cover}" referrerpolicy="no-referrer" loading="lazy" alt="">`
    : `<span class="s-cover s-cover-ph"><svg style="width:20px;height:20px"><use href="#i-video"/></svg></span>`;
  const name = displayName(it);
  const sub = it.year ? `${it.year}${it.matchedName && it.name ? ' · ' + esc(it.name) : ''}` : (it.matchedName ? esc(it.name) : '');
  const matched = !!(it.matchedId || it.matchedName);
  return `<div class="song-row video-row" data-path="${esc(it.path || it.name)}">
    ${cover}
    <span class="s-index">${epTag || ''}</span>
    <span class="s-name" title="${esc(name)}">${esc(name)}</span>
    <span class="s-artist" title="${esc(sub)}">${esc(sub)}</span>
    <span class="s-platform">${fmtSize(it.size)}</span>
    <span class="s-actions">
      <button class="row-match ${matched ? 'row-ok' : ''}" title="${matched ? '重新匹配' : '匹配影视信息'}">${matched ? '<svg style="width:13px;height:13px"><use href="#i-check"/></svg>' : '☁'}</button>
      <button class="row-del" title="移除"><svg style="width:13px;height:13px"><use href="#i-trash"/></svg></button>
    </span>
  </div>`;
}

function renderVideoList() {
  const list = $('videoList');
  if (!list) return;
  const videos = store.get('localVideos') || [];
  const sub = $('videoSub');
  if (sub) sub.textContent = videos.length ? `共 ${videos.length} 个视频` : '导入本地视频，或选择文件夹自动扫描';
  if (!videos.length) {
    list.innerHTML = '<div class="empty-state"><div class="big-icon"><svg style="width:48px;height:48px"><use href="#i-video"/></svg></div><p>还没有导入视频</p><p class="sub-hint">点击「导入视频」或「添加文件夹」</p></div>';
    return;
  }
  const { groups, movies } = groupVideos(videos);
  let html = '<div class="song-list-header"><span></span><span>#</span><span>名称</span><span>信息</span><span>大小</span><span>操作</span></div>';
  groups.forEach((g) => {
    const gid = 'vg-' + btoa(unescape(encodeURIComponent(g.key))).replace(/=/g, '');
    html += `<div class="video-group-head" data-gid="${gid}">
      <svg class="vgh-arrow" style="width:14px;height:14px"><use href="#i-chevron"/></svg>
      <span class="vgh-title">${esc(g.title)} · 第 ${g.season} 季</span>
      <span class="vgh-count">${g.items.length} 集</span>
    </div><div class="video-group-body" id="${gid}">`;
    g.items.forEach((it) => { html += rowHtml(it, 'E' + String(it._ep).padStart(2, '0')); });
    html += '</div>';
  });
  if (movies.length) {
    if (groups.length) html += '<div class="video-group-head static"><span class="vgh-title">其他视频</span><span class="vgh-count">' + movies.length + '</span></div>';
    movies.forEach((it) => { html += rowHtml(it, ''); });
  }
  list.innerHTML = html;
  bindCoverFallback(list, '#i-video');
  bindListEvents(list, videos);
}

function findVideoByDom(list, rowEl) {
  const key = rowEl.dataset.path;
  return (store.get('localVideos') || []).find((v) => (v.path || v.name) === key);
}

function bindListEvents(list, videos) {
  // 折叠分组
  list.querySelectorAll('.video-group-head[data-gid]').forEach((head) => {
    head.addEventListener('click', () => {
      const body = $(head.dataset.gid);
      if (body) body.classList.toggle('collapsed');
      head.classList.toggle('collapsed');
    });
  });
  list.querySelectorAll('.video-row').forEach((row) => {
    // 双击 / 点名称播放
    row.querySelector('.s-name').addEventListener('click', () => playFromRow(row));
    row.addEventListener('dblclick', () => playFromRow(row));
    const matchBtn = row.querySelector('.row-match');
    const delBtn = row.querySelector('.row-del');
    matchBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const it = findVideoByDom(list, row);
      if (!it) return;
      matchBtn.textContent = '…';
      const m = await fetchMatch(apiClient, cleanVideoKeyword(it.matchedName || it.name), 'movie');
      if (m) { it.matchedId = m.id; it.matchedName = m.name; it.year = m.year || ''; it.cover = m.cover || it.cover; renderVideoList(); toast({ type: 'success', message: '已匹配：' + m.name }); }
      else { matchBtn.textContent = '☁'; toast({ type: 'error', message: '未找到匹配结果' }); }
    });
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeVideo(findVideoByDom(list, row));
    });
  });
}

/** 从某行起播：同剧集组按集连播，否则按整个列表顺序 */
function playFromRow(row) {
  const it = findVideoByDom(null, row);
  if (!it) return;
  const all = store.get('localVideos') || [];
  const info = parseEpisode(it.name);
  let seq;
  if (info) {
    seq = all.filter((v) => {
      const vInfo = parseEpisode(v.name);
      return vInfo && vInfo.series === info.series && vInfo.season === info.season;
    }).sort((a, b) => {
      const pa = parseEpisode(a.name), pb = parseEpisode(b.name);
      return (pa.ep || 0) - (pb.ep || 0);
    });
  } else {
    seq = all;
  }
  const idx = seq.findIndex((v) => v === it);
  openVideo(it, seq, idx < 0 ? 0 : idx);
}

async function matchAllVideos() {
  const videos = store.get('localVideos') || [];
  const todo = videos.filter((v) => !v.matchedName);
  if (!todo.length) { toast({ type: 'info', message: '都已匹配过了' }); return; }
  const btn = $('videoMatchAllBtn');
  let ok = 0;
  for (let i = 0; i < todo.length; i++) {
    if (btn) btn.textContent = `匹配中 ${i + 1}/${todo.length}`;
    const m = await fetchMatch(apiClient, cleanVideoKeyword(todo[i].matchedName || todo[i].name), 'movie');
    if (m) { todo[i].matchedId = m.id; todo[i].matchedName = m.name; todo[i].year = m.year || ''; todo[i].cover = m.cover || todo[i].cover; ok++; }
    await new Promise((r) => setTimeout(r, 280));
  }
  if (btn) btn.textContent = '☁ 匹配线上信息';
  renderVideoList();
  toast({ type: 'success', message: `匹配完成，成功 ${ok}/${todo.length}` });
}

function removeVideo(it) {
  if (!it) return;
  const arr = (store.get('localVideos') || []).filter((v) => v !== it);
  store.set('localVideos', arr);
  renderVideoList();
}

// ============================================================
// 全屏播放器
// ============================================================
let curItem = null;
let seqList = [];
let seqIndex = 0;
let cues = [];
let subShift = 0;
let subSizeIdx = 1;
const SUB_SIZES = [18, 22, 28, 34];
let bound = false;
let progressDrag = false;
let saveTimer = null;

function progressKey(it) { return it.path || it.name; }

export function openVideo(item, seq, idx) {
  curItem = item;
  seqList = Array.isArray(seq) ? seq : [item];
  seqIndex = (typeof idx === 'number') ? idx : Math.max(0, seqList.indexOf(item));
  const overlay = $('videoPlayerOverlay');
  const video = $('videoPlayer');
  overlay.style.display = 'flex';
  cues = []; subShift = 0; resetSubUI();
  $('vpSubShiftVal').textContent = '0s';
  video.playbackRate = 1;
  $('vpSpeed').textContent = '1.0x';
  document.querySelectorAll('#vpSpeedMenu span').forEach((s) => s.classList.toggle('on', s.dataset.speed === '1'));
  $('videoPlayerTitle').textContent = displayName(item) + (item.ext ? '.' + item.ext : '');
  const info = parseEpisode(item.name);
  $('vpEpisodeLabel').textContent = info ? `第 ${info.season} 季 · 第 ${info.ep} 集` : '';
  video.src = item.url;
  video.volume = store.get('volume') != null ? store.get('volume') : 0.8;
  $('vpVolume').value = Math.round(video.volume * 100);
  video.play().catch(() => {});
}

function closeVideo() {
  const video = $('videoPlayer');
  persistProgress(true);
  try { if (document.pictureInPictureElement) document.exitPictureInPicture(); } catch (e) {}
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
  video.pause();
  video.removeAttribute('src');
  video.load();
  $('videoPlayerOverlay').style.display = 'none';
  curItem = null;
}

function togglePlay() {
  const video = $('videoPlayer');
  if (video.paused) video.play().catch(() => {}); else video.pause();
}
function seekBy(sec) {
  const v = $('videoPlayer');
  if (isFinite(v.duration)) v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + sec));
}
function nextEpisode() {
  if (seqIndex < seqList.length - 1) { openVideo(seqList[seqIndex + 1], seqList, seqIndex + 1); }
  else { toast({ type: 'info', message: '已经是最后一个了' }); $('videoPlayer').pause(); }
}
function prevEpisode() {
  if (seqIndex > 0) openVideo(seqList[seqIndex - 1], seqList, seqIndex - 1);
}

function setPlayIcon(playing) {
  const use = $('vpPlayIcon'), big = $('vpBigPlayIcon');
  if (use) use.querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play');
  if (big) { big.querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play'); $('vpBigPlay').classList.toggle('hidden', playing); }
}

function persistProgress(force) {
  const v = $('videoPlayer');
  if (!curItem || !v || !isFinite(v.duration)) return;
  if (saveTimer && !force) return;
  const ratio = v.currentTime / v.duration;
  // 看完 97% 视为看完，不保留断点
  const t = ratio > 0.97 ? 0 : v.currentTime;
  saveProgress('video', progressKey(curItem), { t, dur: v.duration, name: displayName(curItem) });
  if (!force) {
    saveTimer = setTimeout(() => { saveTimer = null; }, 3000);
  }
}

// ===== 外挂字幕 =====
function parseSubTime(str) {
  const m = str.trim().replace(',', '.').match(/(\d+):(\d{2}):(\d{2})\.(\d{1,3})/);
  if (!m) return 0;
  return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4].padEnd(3, '0')) / 1000;
}
function parseSubtitle(text, isVtt) {
  const out = [];
  const norm = text.replace(/\r/g, '');
  const blocks = norm.split(/\n{2,}/);
  blocks.forEach((blk) => {
    const lines = blk.split('\n').filter((l) => l.trim());
    const tl = lines.findIndex((l) => l.includes('-->'));
    if (tl < 0) return;
    const tm = lines[tl].match(/([\d:\.,]+)\s*-->\s*([\d:\.,]+)/);
    if (!tm) return;
    const body = lines.slice(tl + 1).map((l) => esc(l.replace(/<[^>]+>/g, ''))).join('<br>');
    out.push({ start: parseSubTime(tm[1]), end: parseSubTime(tm[2]), text: body });
  });
  return out.sort((a, b) => a.start - b.start);
}
function loadSubtitleFile(file) {
  const reader = new FileReader();
  const isVtt = /\.vtt$/i.test(file.name);
  reader.onload = () => {
    cues = parseSubtitle(String(reader.result || ''), isVtt);
    if (!cues.length) { toast({ type: 'error', message: '未解析到字幕' }); return; }
    $('vpSubShiftBox').style.display = 'flex';
    toast({ type: 'success', message: `已加载字幕（${cues.length} 条）` });
  };
  reader.readAsText(file, 'utf-8');
}
function resetSubUI() {
  cues = [];
  $('vpSubtitle').style.display = 'none';
  $('vpSubShiftBox').style.display = 'none';
}
function renderSubtitle(t) {
  const box = $('vpSubtitle');
  if (!cues.length) { box.style.display = 'none'; return; }
  const tt = t - subShift;
  // 线性查找当前 cue（字幕数量级不大）
  let cur = null;
  for (let i = 0; i < cues.length; i++) {
    if (cues[i].start <= tt && tt <= cues[i].end) { cur = cues[i]; break; }
    if (cues[i].start > tt) break;
  }
  if (cur) { box.innerHTML = cur.text; box.style.display = 'block'; box.style.fontSize = SUB_SIZES[subSizeIdx] + 'px'; }
  else box.style.display = 'none';
}

// ===== 进度条 =====
function setProgressUI(ratio) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  $('vpPlayed').style.width = pct + '%';
  $('vpThumb').style.left = pct + '%';
}
function progressRatioFromEvent(e) {
  const bar = $('vpProgress');
  const r = bar.getBoundingClientRect();
  return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
}

function bindPlayer() {
  if (bound) return;
  bound = true;
  const video = $('videoPlayer');

  $('videoPlayerClose').addEventListener('click', closeVideo);
  $('vpPlay').addEventListener('click', togglePlay);
  $('vpBigPlay').addEventListener('click', togglePlay);
  $('vpStage').addEventListener('click', (e) => { if (e.target.id === 'vpStage' || e.target.tagName === 'VIDEO') togglePlay(); });
  $('vpNext').addEventListener('click', nextEpisode);
  $('vpPrev').addEventListener('click', prevEpisode);
  $('vpBack10').addEventListener('click', () => seekBy(-10));
  $('vpFwd10').addEventListener('click', () => seekBy(10));

  video.addEventListener('play', () => { setPlayIcon(true); });
  video.addEventListener('pause', () => { setPlayIcon(false); });
  video.addEventListener('loadedmetadata', () => {
    $('vpDur').textContent = fmtTime(video.duration);
    $('vpVolume').value = Math.round(video.volume * 100);
    // 断点续播
    const p = getProgress('video', progressKey(curItem || {}));
    if (p && p.t > 5) {
      video.currentTime = p.t;
      const tip = $('vpResumeTip');
      tip.textContent = `已恢复到 ${fmtTime(p.t)}`;
      tip.style.display = 'block';
      setTimeout(() => { tip.style.display = 'none'; }, 2600);
    }
  });
  video.addEventListener('timeupdate', () => {
    if (!progressDrag && isFinite(video.duration)) {
      setProgressUI(video.currentTime / video.duration);
      $('vpCur').textContent = fmtTime(video.currentTime);
    }
    renderSubtitle(video.currentTime);
    persistProgress(false);
  });
  video.addEventListener('progress', () => {
    if (video.buffered && video.buffered.length && isFinite(video.duration)) {
      const e = video.buffered.end(video.buffered.length - 1);
      $('vpBuffered').style.width = (e / video.duration * 100) + '%';
    }
  });
  video.addEventListener('ended', nextEpisode);
  video.addEventListener('error', () => {
    if (curItem) toast({ type: 'error', message: '该格式可能不受支持，尝试 MP4/WebM' });
  });

  // 进度拖拽
  const bar = $('vpProgress');
  bar.addEventListener('pointerdown', (e) => {
    progressDrag = true;
    bar.setPointerCapture(e.pointerId);
    const r = progressRatioFromEvent(e);
    setProgressUI(r);
    $('vpSeekTip').style.left = (r * 100) + '%';
    $('vpSeekTip').textContent = fmtTime(r * (video.duration || 0));
    $('vpSeekTip').style.display = 'block';
  });
  bar.addEventListener('pointermove', (e) => {
    if (!progressDrag) return;
    const r = progressRatioFromEvent(e);
    setProgressUI(r);
    $('vpSeekTip').style.left = (r * 100) + '%';
    $('vpSeekTip').textContent = fmtTime(r * (video.duration || 0));
  });
  bar.addEventListener('pointerup', (e) => {
    if (!progressDrag) return;
    progressDrag = false;
    $('vpSeekTip').style.display = 'none';
    const r = progressRatioFromEvent(e);
    if (isFinite(video.duration)) video.currentTime = r * video.duration;
  });

  // 音量
  $('vpVolume').addEventListener('input', (e) => {
    const val = e.target.value / 100;
    video.volume = val; video.muted = val === 0;
    store.set('volume', val);
    $('vpVolIcon').querySelector('use').setAttribute('href', val === 0 ? '#i-mute' : '#i-volume');
  });
  $('vpMute').addEventListener('click', () => {
    video.muted = !video.muted;
    $('vpVolIcon').querySelector('use').setAttribute('href', video.muted ? '#i-mute' : '#i-volume');
  });

  // 倍速
  const speedBtn = $('vpSpeed'), speedMenu = $('vpSpeedMenu');
  speedBtn.addEventListener('click', (e) => { e.stopPropagation(); speedMenu.style.display = speedMenu.style.display === 'none' ? 'block' : 'none'; });
  document.addEventListener('click', () => { speedMenu.style.display = 'none'; });
  speedMenu.addEventListener('click', (e) => {
    const sp = e.target.dataset.speed;
    if (!sp) return;
    const v = parseFloat(sp);
    video.playbackRate = v;
    speedBtn.textContent = v.toFixed(1).replace(/\.0$/, '.0') + 'x';
    speedMenu.querySelectorAll('span').forEach((s) => s.classList.toggle('on', s === e.target));
    speedMenu.style.display = 'none';
  });

  // 字幕
  $('vpSubLoad').addEventListener('click', () => $('vpSubFile').click());
  $('vpSubFile').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) loadSubtitleFile(f);
    e.target.value = '';
  });
  $('vpSubMinus').addEventListener('click', () => { subShift -= 0.5; $('vpSubShiftVal').textContent = subShift.toFixed(1) + 's'; });
  $('vpSubPlus').addEventListener('click', () => { subShift += 0.5; $('vpSubShiftVal').textContent = subShift.toFixed(1) + 's'; });
  $('vpSubSize').addEventListener('click', () => { subSizeIdx = (subSizeIdx + 1) % SUB_SIZES.length; toast({ message: '字幕字号 ' + SUB_SIZES[subSizeIdx] }); });

  // 画中画 / 全屏
  $('vpPip').addEventListener('click', async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch (err) { toast({ type: 'error', message: '当前不支持画中画' }); }
  });
  $('vpFull').addEventListener('click', toggleFullscreen);
  $('vpStage').addEventListener('dblclick', toggleFullscreen);

  // 快捷键（浮层可见时优先处理，避免触发音乐快捷键）
  document.addEventListener('keydown', (e) => {
    if ($('videoPlayerOverlay').style.display === 'none') return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const key = e.key;
    if (key === 'Escape') { closeVideo(); return; }
    e.preventDefault();
    e.stopPropagation();
    if (key === ' ') togglePlay();
    else if (key === 'ArrowLeft') seekBy(e.ctrlKey ? 0 : -5);
    else if (key === 'ArrowRight') seekBy(e.ctrlKey ? 0 : 5);
    else if (key === 'ArrowUp') { video.volume = Math.min(1, video.volume + 0.05); $('vpVolume').value = video.volume * 100; }
    else if (key === 'ArrowDown') { video.volume = Math.max(0, video.volume - 0.05); $('vpVolume').value = video.volume * 100; }
    else if (key === 'j' || key === 'J') seekBy(-10);
    else if (key === 'l' || key === 'L') seekBy(10);
    else if (key === 'f' || key === 'F') toggleFullscreen();
    else if (key === 'p' || key === 'P') $('vpPip').click();
    else if (key === 'm' || key === 'M') $('vpMute').click();
    else if (key === 'n' || key === 'N' || (e.ctrlKey && key === 'ArrowRight')) nextEpisode();
    else if ((e.ctrlKey && key === 'ArrowLeft')) prevEpisode();
  }, true);
}

function toggleFullscreen() {
  const stage = $('vpStage');
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else (stage || $('videoPlayerOverlay')).requestFullscreen();
  } catch (e) {}
}

// ============================================================
export function initVideo() {
  bindPlayer();
  eventBus.on('library:changed', ({ kind }) => { if (kind === 'video' && store.get('view') === 'video') renderVideoList(); });
  document.addEventListener('view:video', renderVideoList);
  const imp = $('videoImportBtn');
  if (imp) imp.addEventListener('click', importVideos);
  const all = $('videoMatchAllBtn');
  if (all) all.addEventListener('click', matchAllVideos);
  renderVideoList();
}

async function importVideos() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.multiple = true;
  inp.accept = VIDEO_EXTS.map((e) => '.' + e).join(',');
  inp.onchange = async () => {
    const files = Array.from(inp.files || []);
    if (!files.length) return;
    const list = store.get('localVideos') || [];
    const exist = new Set(list.map((v) => v.name + '|' + v.size));
    let added = 0;
    for (const f of files) {
      if (exist.has(f.name + '|' + f.size)) continue;
      exist.add(f.name + '|' + f.size);
      list.push({
        origin: 'file', file: f, url: URL.createObjectURL(f), name: f.name,
        ext: (f.name.split('.').pop() || '').toLowerCase(), size: f.size,
        artist: '', album: '', cover: '', duration: 0, matchedId: null, matchedName: '', year: ''
      });
      added++;
    }
    store.set('localVideos', list);
    renderVideoList();
    toast({ type: 'success', message: added ? `已导入 ${added} 个视频` : '视频已在库中' });
  };
  inp.click();
}

export default {
  initVideo, renderVideoList, openVideo, removeVideo, matchAllVideos
};
