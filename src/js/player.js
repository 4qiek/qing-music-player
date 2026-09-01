/**
 * player.js — 播放器核心控制
 * 职责：播放/暂停/切歌、进度更新（rAF 驱动）、音质切换、
 *       封面/信息/背景渲染、歌曲切换淡入淡出、播放详情浮层。
 */
import { store } from './store.js';
import { eventBus } from './eventBus.js';
import { apiClient } from './apiClient.js';
import * as audioEngine from './audioEngine.js';
import { loadLyric, updateLyric } from './lyric.js';
import { formatTime } from './utils.js';

const audio = document.getElementById('audio');
const PLATFORM_NAME = { netease: '网易云音乐', qq: 'QQ音乐', kugou: '酷狗音乐', local: '本地音乐' };

// ===== 工具：DOM 查询 =====
const $ = (id) => document.getElementById(id);

// ===== 基础播放 =====
export async function playTrack(track) {
  audioEngine.initAudioCtx(audio);
  audioEngine.resumeAudioCtx();

  store.set('currentTrack', track);
  store.set('currentIndex', store.get('currentIndex'));
  store.set('isPlaying', true);

  audio.src = track.url;
  try {
    await audio.play();
  } catch (e) {
    // 自动播放被拒等场景
    console.warn('[player] play() 被拒绝:', e.message);
  }

  setNowPlaying(track, track.artist);
  updatePlayButtons(false);
  updatePlayingRows();
  updateBackground(track.cover);
  updateDetailPage(track);
  updateMainPanel(track);
  triggerFadeIn();
  loadLyric(track, $('lyricPanel'));
}

// ===== UI 渲染 =====
export function setNowPlaying(t, artistText) {
  $('npTitle').textContent = t.name;
  $('npArtist').textContent = artistText || t.artist;

  const npImg = $('npCoverImg');
  const npVinyl = $('npVinyl');
  if (t.cover) {
    npImg.src = t.cover;
    npImg.style.display = 'block';
    npVinyl.style.display = 'none';
  } else {
    npImg.style.display = 'none';
    npVinyl.style.display = 'block';
  }
}

/** 更新左栏主面板（封面、歌名、歌手） */
export function updateMainPanel(t) {
  if (!t) return;
  $('mainSongName').textContent = t.name;
  $('mainSongArtist').textContent = t.artist || '未知艺术家';

  const img = $('mainCoverImg');
  const vinyl = $('mainVinyl');
  if (t.cover) {
    img.src = t.cover;
    img.style.display = 'block';
    vinyl.style.display = 'none';
  } else {
    img.style.display = 'none';
    vinyl.style.display = 'block';
  }
}

/** 更新浮层播放页 */
export function updateDetailPage(t) {
  if (!t) return;
  $('pdSongName').textContent = t.name;
  $('pdSongArtist').textContent = t.artist;

  const pdImg = $('pdCoverImg');
  const pdVinyl = $('pdVinyl');
  if (t.cover) {
    pdImg.src = t.cover;
    pdImg.style.display = 'block';
    pdVinyl.style.display = 'none';
  } else {
    pdImg.style.display = 'none';
    pdVinyl.style.display = 'block';
  }
}

export function updatePlayButtons(paused) {
  const icon = paused ? 'i-play' : 'i-pause';
  $('playBtn').innerHTML = `<svg><use href="#${icon}"/></svg>`;
  $('pdPlayBtn').innerHTML = `<svg><use href="#${icon}"/></svg>`;
  $('npPlayBtn').innerHTML = `<svg><use href="#${icon}"/></svg>`;

  const pausedClass = paused ? 'add' : 'remove';
  $('pdVinyl').classList[pausedClass]('paused');
  $('npVinyl').classList[pausedClass]('paused');
  $('mainVinyl').classList[pausedClass]('paused');
}

function updatePlayingRows() {
  document.querySelectorAll('.song-row').forEach((r) => r.classList.remove('playing'));
}

function updateBackground(cover) {
  const bg = $('bgLayer');
  if (cover) {
    bg.style.setProperty('--cover-url', `url("${cover}")`);
    bg.classList.add('has-cover');
  } else {
    bg.classList.remove('has-cover');
  }
}

/** 歌曲切换淡入淡出动画 */
function triggerFadeIn() {
  const panel = document.querySelector('.panel-left');
  if (!panel) return;
  panel.classList.remove('track-fade');
  // 强制 reflow 后重新触发动画
  void panel.offsetWidth;
  panel.classList.add('track-fade');
}

// ===== 播放/暂停 =====
export function togglePlay() {
  if (!audio.src) return;
  audioEngine.initAudioCtx(audio);
  audioEngine.resumeAudioCtx();
  if (audio.paused) {
    audio.play();
    store.set('isPlaying', true);
    updatePlayButtons(false);
  } else {
    audio.pause();
    store.set('isPlaying', false);
    updatePlayButtons(true);
  }
}

// ===== 切歌 =====
export function prevTrack() {
  const queue = store.get('currentQueue');
  if (queue.length === 0) return;
  let idx = (store.get('currentIndex') - 1 + queue.length) % queue.length;
  store.set('currentIndex', idx);
  const t = queue[idx];
  if (t.platform === 'local') playTrack(t);
  else playOnlineFromQueue(idx);
}

export function nextTrack() {
  const queue = store.get('currentQueue');
  if (queue.length === 0) return;
  let idx = (store.get('currentIndex') + 1) % queue.length;
  store.set('currentIndex', idx);
  const t = queue[idx];
  if (t.platform === 'local') playTrack(t);
  else playOnlineFromQueue(idx);
}

async function playOnlineFromQueue(idx) {
  const queue = store.get('currentQueue');
  const t = queue[idx];
  setNowPlaying(t, '加载中...');
  let urlRes;
  try {
    if (t.platform === 'netease') urlRes = await apiClient.neteaseUrl({ id: t.id, level: store.get('quality') });
    else if (t.platform === 'qq') urlRes = await apiClient.qqUrl(t.id);
    else urlRes = await apiClient.kugouUrl(t.id, t.albumId);
  } catch (err) {
    urlRes = { error: err.message };
  }
  if (urlRes.error || !urlRes.url) {
    setNowPlaying(t, `暂无法播放：${urlRes.error || '接口暂不可用'}`);
    return;
  }
  t.url = urlRes.url;
  playTrack(t);
}

/** 在线歌曲点击播放（来自搜索结果） */
export async function playOnline(idx) {
  const results = store.get('searchResults');
  const t = results[idx];
  store.set('currentQueue', results);
  store.set('currentIndex', idx);
  setNowPlaying(t, '加载中...');
  let urlRes;
  try {
    if (t.platform === 'netease') urlRes = await apiClient.neteaseUrl({ id: t.id, level: store.get('quality') });
    else if (t.platform === 'qq') urlRes = await apiClient.qqUrl(t.id);
    else urlRes = await apiClient.kugouUrl(t.id, t.albumId);
  } catch (err) {
    urlRes = { error: err.message };
  }
  if (urlRes.error || !urlRes.url) {
    setNowPlaying(t, `暂无法播放：${urlRes.error || '接口暂不可用'}`);
    return;
  }
  t.url = urlRes.url;
  playTrack(t);
}

/** 本地歌曲点击播放 */
export function playLocal(idx) {
  const localTracks = store.get('localTracks');
  const t = localTracks[idx];
  store.set('currentQueue', localTracks);
  store.set('currentIndex', idx);
  playTrack(t);
}

// ===== 进度更新（rAF 批量驱动） =====
let rafId = null;

function updateProgressUI() {
  if (audio.duration) {
    const pct = (audio.currentTime / audio.duration) * 100;
    $('mainProgress').value = pct;
    $('pdProgress').value = pct;
    $('npProgress').value = pct;
    $('mainCurTime').textContent = formatTime(audio.currentTime);
    $('mainTotTime').textContent = formatTime(audio.duration);
    $('pdCurTime').textContent = formatTime(audio.currentTime);
    $('pdTotTime').textContent = formatTime(audio.duration);
    $('npCurTime').textContent = formatTime(audio.currentTime);
  }
  updateLyric(audio.currentTime);
}

function progressLoop() {
  updateProgressUI();
  rafId = requestAnimationFrame(progressLoop);
}

export function startProgressLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(progressLoop);
}

export function stopProgressLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

// ===== 音质切换 =====
export async function switchQuality(level) {
  store.set('quality', level);
  const cur = store.get('currentTrack');
  if (cur && cur.platform === 'netease' && audio.src) {
    const wasPlaying = !audio.paused;
    const curTime = audio.currentTime;
    const res = await apiClient.neteaseUrl({ id: cur.id, level });
    if (res.url) {
      audio.src = res.url;
      audio.currentTime = curTime;
      if (wasPlaying) audio.play();
    }
  }
}

// ===== 音频元素事件绑定 =====
export function initAudioEvents() {
  audio.volume = 0.8;

  audio.addEventListener('loadedmetadata', () => {
    $('mainTotTime').textContent = formatTime(audio.duration);
    $('pdTotTime').textContent = formatTime(audio.duration);
    $('npTotTime').textContent = formatTime(audio.duration);
  });

  audio.addEventListener('play', () => {
    store.set('isPlaying', true);
    updatePlayButtons(false);
  });

  audio.addEventListener('pause', () => {
    store.set('isPlaying', false);
    updatePlayButtons(true);
  });

  audio.addEventListener('ended', nextTrack);

  audio.addEventListener('error', () => {
    eventBus.emit('toast', { type: 'error', message: '播放出错，请检查网络或换一首试试' });
  });

  // 进度条拖动跳转
  const seek = (el) => {
    el.addEventListener('input', () => {
      if (audio.duration) audio.currentTime = (el.value / 100) * audio.duration;
    });
  };
  seek($('mainProgress'));
  seek($('pdProgress'));
  seek($('npProgress'));

  // 进度条拖动/悬停时显示时间提示
  const mainProgress = $('mainProgress');
  const tip = $('progressTip');
  const updateTip = (clientX) => {
    if (!audio.duration) return;
    const rect = mainProgress.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    tip.textContent = formatTime(ratio * audio.duration);
    tip.style.left = ratio * 100 + '%';
    tip.classList.add('show');
  };
  mainProgress.addEventListener('pointermove', (e) => updateTip(e.clientX));
  mainProgress.addEventListener('pointerdown', (e) => updateTip(e.clientX));
  mainProgress.addEventListener('pointerleave', () => tip.classList.remove('show'));
  mainProgress.addEventListener('input', () => {
    const rect = mainProgress.getBoundingClientRect();
    updateTip(rect.left + (mainProgress.value / 100) * rect.width);
  });

  // 音量
  $('volume').addEventListener('input', () => {
    audio.volume = $('volume').value / 100;
    store.set('volume', audio.volume);
    $('muteBtn').classList.toggle('active', audio.volume === 0);
  });

  // 静音切换
  const muteBtn = $('muteBtn');
  muteBtn.addEventListener('click', () => {
    if (audio.volume > 0) {
      audio.dataset.lastVol = audio.volume;
      audio.volume = 0;
      $('volume').value = 0;
    } else {
      audio.volume = parseFloat(audio.dataset.lastVol) || 0.8;
      $('volume').value = audio.volume * 100;
    }
    store.set('volume', audio.volume);
    muteBtn.classList.toggle('active', audio.volume === 0);
  });

  // 控制按钮
  $('playBtn').addEventListener('click', togglePlay);
  $('pdPlayBtn').addEventListener('click', togglePlay);
  $('npPlayBtn').addEventListener('click', togglePlay);
  $('prevBtn').addEventListener('click', prevTrack);
  $('nextBtn').addEventListener('click', nextTrack);
  $('pdPrevBtn').addEventListener('click', prevTrack);
  $('pdNextBtn').addEventListener('click', nextTrack);
  $('npNextBtn').addEventListener('click', nextTrack);

  // 浮层开关
  $('npExpand').addEventListener('click', () => $('playerDetail').classList.add('show'));
  $('expandBtn').addEventListener('click', () => $('playerDetail').classList.add('show'));
  $('pdClose').addEventListener('click', () => $('playerDetail').classList.remove('show'));

  // 启动 rAF 进度循环
  startProgressLoop();
}

export default {
  playTrack,
  playLocal,
  playOnline,
  togglePlay,
  prevTrack,
  nextTrack,
  switchQuality,
  initAudioEvents,
  setNowPlaying,
  updateMainPanel,
  updateDetailPage
};
