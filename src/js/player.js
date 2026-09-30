/**
 * player.js — 播放器核心控制
 * 职责：播放/暂停/切歌、进度更新（rAF 驱动）、
 *       封面/信息/背景渲染、歌曲切换淡入淡出、播放详情浮层。
 *
 * 在线音乐功能（在线搜索 / 在线播放 / 平台切换 / 音质切换 / 相似推荐）已整体移除，
 * 本模块只负责本地曲目的播放与自愈。
 */
import { store } from './store.js';
import { eventBus } from './eventBus.js';
import * as audioEngine from './audioEngine.js';
import { loadLyric, updateLyric } from './lyric.js';
import { formatTime } from './utils.js';
import { isLocalTrack } from './trackUtil.js';

// 本地曲目判定统一由 trackUtil 提供（lyric / playlists / queue 也用它，避免循环依赖）；
// 此处原样再导出，保持既有 player.isLocalTrack 调用方不受影响。
export { isLocalTrack };

const audio = document.getElementById('audio');
// ===== 播放模式 =====
export function cyclePlayMode() {
  const order = ['list', 'single', 'shuffle', 'smart'];
  const cur = store.get('playMode');
  const next = order[(order.indexOf(cur) + 1) % order.length];
  store.set('playMode', next);
  renderPlayMode();
  const label = { list: '列表循环', single: '单曲循环', shuffle: '随机播放', smart: '心动模式' }[next];
  eventBus.emit('toast', { type: 'info', message: '播放模式：' + label });
  return next;
}

export function renderPlayMode() {
  const mode = store.get('playMode');
  const label = { list: '列表循环', single: '单曲循环', shuffle: '随机播放', smart: '心动模式' }[mode];
  const btn = $('playModeBtn');
  if (btn) {
    btn.title = '播放模式：' + label + '（点击切换）';
    btn.classList.toggle('active', mode !== 'list');
  }
  const txt = $('playModeLabel');
  if (txt) txt.textContent = label;
  const icon = $('playModeIcon');
  if (icon) {
    const href = { list: '#i-repeat', single: '#i-repeat1', shuffle: '#i-shuffle', smart: '#i-spark' }[mode] || '#i-repeat';
    icon.innerHTML = '<use href="' + href + '"/>';
  }
}

function pickNextIndex(dir) {
  const queue = store.get('currentQueue');
  if (queue.length === 0) return -1;
  const cur = store.get('currentIndex');
  const mode = store.get('playMode');
  if (mode === 'single') return cur;
  if (mode === 'shuffle' || mode === 'smart') {
    if (queue.length === 1) return 0;
    let r;
    do { r = Math.floor(Math.random() * queue.length); } while (r === cur);
    return r;
  }
  return (cur + (dir || 1) + queue.length) % queue.length;
}

// ===== 收藏夹 =====
export function favoriteKey(t) {
  return t ? (t.platform + ':' + (t.id || t.path || t.name)) : '';
}

export function isFavorite(t) {
  return store.get('favorites').some((f) => favoriteKey(f) === favoriteKey(t));
}

export function toggleFavorite(t) {
  if (!t) return false;
  const favs = [...store.get('favorites')];
  const key = favoriteKey(t);
  const i = favs.findIndex((f) => favoriteKey(f) === key);
  let on;
  if (i >= 0) { favs.splice(i, 1); on = false; }
  else { favs.unshift({ ...t }); on = true; }
  store.set('favorites', favs);
  try { localStorage.setItem('qing-favorites', JSON.stringify(favs)); } catch (e) { /* ignore */ }
  renderFavoriteButtons();
  eventBus.emit('toast', { type: on ? 'success' : 'info', message: on ? '已收藏到我的收藏' : '已取消收藏' });
  return on;
}

/**
 * 读取本地收藏（localStorage）
 * 在线音乐功能已移除：历史落盘里可能混入在线条目，这里按 isLocalTrack 过滤丢弃，
 * 并顺带把过滤结果写回，避免每次启动重复过滤。
 */
export function loadFavorites() {
  try {
    const raw = localStorage.getItem('qing-favorites');
    if (!raw) return;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return;
    const local = list.filter(isLocalTrack);
    store.set('favorites', local);
    if (local.length !== list.length) {
      try { localStorage.setItem('qing-favorites', JSON.stringify(local)); } catch (e) { /* 配额超限忽略 */ }
    }
  } catch (e) { /* ignore */ }
}

function renderFavoriteButtons() {
  const cur = store.get('currentTrack');
  document.querySelectorAll('.fav-btn').forEach((b) => {
    b.classList.toggle('active', !!(cur && isFavorite(cur)));
  });
}

// ===== 播放历史 =====
function recordHistory(t) {
  if (!t) return;
  const key = favoriteKey(t);
  const hist = store.get('history').filter((h) => favoriteKey(h) !== key);
  hist.unshift({ ...t, playedAt: Date.now() });
  if (hist.length > 60) hist.length = 60;
  store.set('history', hist);
  try { localStorage.setItem('qing-history', JSON.stringify(hist)); } catch (e) { /* ignore */ }
}

/**
 * 读取播放历史（localStorage）
 * 与收藏同理：过滤掉历史落盘里混入的在线条目。
 */
export function loadHistory() {
  try {
    const raw = localStorage.getItem('qing-history');
    if (!raw) return;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return;
    const local = list.filter(isLocalTrack);
    store.set('history', local);
    if (local.length !== list.length) {
      try { localStorage.setItem('qing-history', JSON.stringify(local)); } catch (e) { /* 配额超限忽略 */ }
    }
  } catch (e) { /* ignore */ }
}

export function clearHistory() {
  store.set('history', []);
  try { localStorage.removeItem('qing-history'); } catch (e) { /* ignore */ }
}

// ===== 工具：DOM 查询 =====
const $ = (id) => document.getElementById(id);

// ===== 基础播放 =====
export async function playTrack(track) {
  // 本地曲目显示匹配到的歌名（无则去掉扩展名）
  if (isLocalTrack(track)) {
    const cleanName = track.matchedName || String(track.name || '').replace(/\.[^.]+$/, '');
    if (cleanName && cleanName !== track.name) track = { ...track, name: cleanName };
  }
  // ===== Web Audio（EQ / 可视化）初始化：失败时降级为直连播放 =====
  // createMediaElementSource() 对同一个 media 元素只能成功一次且不可撤销，
  // 因此只有「元素尚未被接管」时降级才有意义：此时跳过 Web Audio，
  // audio 元素自行输出到声卡，至少保证出声（代价是没有 EQ / 频谱）。
  // 若元素已被接管，则不可回退，沿用既有链路并仅记录错误。
  let webAudioOk = false;
  try {
    audioEngine.initAudioCtx(audio);
    webAudioOk = true;
  } catch (e) {
    if (audioEngine.isAudioElementCaptured()) {
      console.warn('[player] Web Audio 链路异常，audio 元素已被接管、无法回退，沿用既有链路:', e && e.message);
    } else {
      console.warn('[player] Web Audio 初始化失败，降级为不接 EQ 的直连播放:', e && e.message);
    }
  }
  audioEngine.resumeAudioCtx();
  // 新曲目：清空自愈标记，允许该曲目失败时重新登记白名单重试一次
  _localRepairKey = '';

  store.set('currentTrack', track);
  store.set('isPlaying', true);

  audio.src = track.url;
  let played = false;
  try {
    await audio.play();
    played = true;
  } catch (e) {
    // 自动播放被浏览器拒绝：修正 UI 播放态并提示，避免「显示播放中但无声且无提示」
    console.warn('[player] play() 被拒绝:', e && e.message);
    store.set('isPlaying', false);
    updatePlayButtons(true);
    eventBus.emit('toast', { type: 'error', message: '浏览器阻止了自动播放，请再点一次播放' });
  }
  // 播放真正开始后再确认 AudioContext 已 running：
  // resumeAudioCtx() 未 await 且静默吞错，若上下文停在 suspended 会出现「在播但无声」
  if (played && webAudioOk) await ensureAudioCtxRunning();

  setNowPlaying(track, track.artist);
  recordHistory(track);
  renderFavoriteButtons();
  updatePlayButtons(false);
  updatePlayingRows();
  updateBackground(track.cover);
  updateDetailPage(track);
  updateMainPanel(track);
  triggerFadeIn();
  audioEngine.fadeIn(0.45);
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
  // Web Audio 初始化失败不能阻断本次点击（B3 提示用户「再点一次播放」时走的就是这里），
  // 失败即降级为直连播放，至少保证能出声
  let webAudioOk = false;
  try {
    audioEngine.initAudioCtx(audio);
    webAudioOk = true;
  } catch (e) {
    console.warn('[player] Web Audio 初始化失败，本次以直连方式播放:', e && e.message);
  }
  audioEngine.resumeAudioCtx();
  if (audio.paused) {
    audio.play();
    store.set('isPlaying', true);
    updatePlayButtons(false);
    if (webAudioOk) ensureAudioCtxRunning();
  } else {
    audio.pause();
    store.set('isPlaying', false);
    updatePlayButtons(true);
  }
}

// ===== 切歌 =====
/** 在线音乐功能已移除：队列中若残留旧在线条目，给出提示而不是去请求接口 */
function skipNonLocal() {
  eventBus.emit('toast', { type: 'info', message: '该曲目为在线歌曲，在线音乐功能已移除' });
}

export function prevTrack() {
  const queue = store.get('currentQueue');
  if (queue.length === 0) return;
  const idx = pickNextIndex(-1);
  store.set('currentIndex', idx);
  const t = queue[idx];
  if (isLocalTrack(t)) playTrack(t);
  else skipNonLocal();
}

export function nextTrack() {
  const queue = store.get('currentQueue');
  if (queue.length === 0) return;
  const idx = pickNextIndex(1);
  store.set('currentIndex', idx);
  const t = queue[idx];
  if (isLocalTrack(t)) playTrack(t);
  else skipNonLocal();
}

/** 本地歌曲点击播放 */
export function playLocal(idx) {
  const localTracks = store.get('localTracks');
  const t = localTracks[idx];
  store.set('currentQueue', localTracks);
  store.set('currentIndex', idx);
  playTrack(t);
}

/** 统一队列播放入口：按 currentQueue 索引播放本地曲目 */
export function playQueueIndex(idx) {
  const queue = store.get('currentQueue') || [];
  if (idx < 0 || idx >= queue.length) return;
  store.set('currentIndex', idx);
  const t = queue[idx];
  if (isLocalTrack(t)) playTrack(t);
  else skipNonLocal();
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
  // 仅在播放时持续以 rAF 刷新进度；暂停时停掉循环以省 CPU，
  // 由 'play' 事件重新启动，暂停态下的拖动进度由 timeupdate 兜底刷新。
  if (!audio.paused) {
    rafId = requestAnimationFrame(progressLoop);
  } else {
    rafId = null;
  }
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

// ===== 播放失败诊断与自愈 =====
// 记录已尝试自愈过的曲目，同一曲目每次播放只自愈一次，避免 403 反复重试形成死循环
let _localRepairKey = '';
// 自愈进行中标记：卸载/重载 src 期间可能出现中间态 error，此时不提示也不重复触发自愈
let _localRepairing = false;

/**
 * 本地路径型曲目播放失败时，重新向主进程登记该路径并强制重新加载一次。
 * 典型场景：重启后 qing-file 白名单尚未补登记 → 协议返回 403 → 补登记后即可播放。
 *
 * 注意：toMediaUrl() 是确定性函数，重取到的 URL 与失败前的 URL 完全相同，
 * 单纯「再次赋同一个 src」是否触发重新加载在各浏览器实现上并不确定，
 * 因此这里先 removeAttribute('src') + load() 彻底卸载旧资源，再赋 URL、load()、play()。
 * 失败一律返回 false，由调用方继续走错误提示，不会吞掉错误。
 *
 * @param {object} t 曲目
 * @returns {Promise<boolean>} 是否成功重新播放
 */
async function repairLocalTrack(t) {
  try {
    if (!t || !t.path) return false;
    if (!window.qingAPI || typeof window.qingAPI.mediaUrlForPath !== 'function') return false;
    const info = await window.qingAPI.mediaUrlForPath(t.path);
    if (!info || info.error || !info.url) return false;
    t.url = info.url;
    // 1. 卸载旧资源，确保后续赋值被视为「新的加载」而不是无变化的重复赋值
    audio.removeAttribute('src');
    audio.load();
    // 2. 赋新 URL 并显式要求重新加载
    audio.src = info.url;
    audio.load();
    // 3. 播放；rejection 必须 catch，否则会变成未处理的 Promise 异常
    await audio.play();
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 播放开始后确保 AudioContext 处于 running 状态。
 *
 * audioEngine.resumeAudioCtx() 是同步且不 await 的，内部还静默吞掉异常；
 * 一旦上下文停在 suspended，媒体元素看似在播、进度在走，但声音全部经 Web Audio 输出
 * 就变成静音。这里在 play() 成功之后补一次可等待的 resume 并校验最终状态，
 * 仍非 running 时打一条 warn 便于排障（不改变播放时序语义，只做补充与校验）。
 *
 * @returns {Promise<void>}
 */
async function ensureAudioCtxRunning() {
  const ctx = audioEngine.getAudioCtx();
  if (!ctx) return;
  try {
    if (ctx.state !== 'running') await ctx.resume();
    if (ctx.state !== 'running') {
      console.warn('[player] AudioContext 仍处于 ' + ctx.state + ' 状态，可能导致无声音输出');
    }
  } catch (e) {
    console.warn('[player] AudioContext resume 失败:', e && e.message);
  }
}

/** 本地文件不可访问时的可操作提示（区分「磁盘路径失效」与「手动选入文件失效」） */
function localFileHint(t) {
  if (t && t.origin === 'file') {
    return '该文件已失效（手动选入的文件仅本次运行有效），请重新导入音乐';
  }
  return '无法访问该音乐文件，请在音乐库重新导入所在文件夹';
}

/** 音频元素 error 事件统一处理：本地文件先自愈，仍失败则给出明确可操作提示 */
async function handlePlayError() {
  // 自愈过程中由 removeAttribute('src') / load() 触发的中间态错误直接忽略，
  // 避免提前弹提示或递归触发自愈
  if (_localRepairing) return;
  const t = store.get('currentTrack');
  if (isLocalTrack(t)) {
    const key = favoriteKey(t);
    if (t.path && _localRepairKey !== key) {
      _localRepairKey = key;
      _localRepairing = true;
      let ok = false;
      try {
        ok = await repairLocalTrack(t);
      } finally {
        _localRepairing = false;
      }
      if (ok) return;
    }
    eventBus.emit('toast', { type: 'error', message: localFileHint(t) });
    store.set('isPlaying', false);
    updatePlayButtons(true);
    stopProgressLoop();
    try { setNowPlaying(t, '本地文件无法访问'); } catch (e) { /* DOM 未就绪忽略 */ }
    return;
  }
  // 在线播放已移除，此处只可能是本地曲目异常
  eventBus.emit('toast', { type: 'error', message: '播放出错，请在音乐库重新导入该文件后重试' });
}

// ===== 音频元素事件绑定 =====
export function initAudioEvents() {
  const savedVol = store.get('volume');
  audio.volume = (typeof savedVol === 'number') ? savedVol : 0.8;

  audio.addEventListener('loadedmetadata', () => {
    $('mainTotTime').textContent = formatTime(audio.duration);
    $('pdTotTime').textContent = formatTime(audio.duration);
    $('npTotTime').textContent = formatTime(audio.duration);
  });

  audio.addEventListener('play', () => {
    store.set('isPlaying', true);
    updatePlayButtons(false);
    startProgressLoop();
  });

  audio.addEventListener('pause', () => {
    store.set('isPlaying', false);
    updatePlayButtons(true);
  });

  // 暂停态拖动进度条时，timeupdate 兜底刷新进度 UI（此时 rAF 循环已停止）
  audio.addEventListener('timeupdate', () => {
    if (audio.paused) updateProgressUI();
  });

  audio.addEventListener('ended', nextTrack);

  audio.addEventListener('error', () => {
    handlePlayError();
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

  // 浮层开关：宽窗口展开播放详情页；窄窗口（≤980px）切换底部抽屉
  const isNarrowWin = () => window.matchMedia('(max-width: 980px)').matches;
  const setDrawer = (open) => {
    const panel = document.querySelector('.panel-left');
    const mask = $('drawerMask');
    if (panel) panel.classList.toggle('drawer-open', open);
    if (mask) mask.classList.toggle('show', open);
  };
  $('npExpand').addEventListener('click', () => {
    if (isNarrowWin()) {
      const panel = document.querySelector('.panel-left');
      setDrawer(!(panel && panel.classList.contains('drawer-open')));
    } else {
      $('playerDetail').classList.add('show');
    }
  });
  $('expandBtn').addEventListener('click', () => $('playerDetail').classList.add('show'));
  $('pdClose').addEventListener('click', () => $('playerDetail').classList.remove('show'));
  // 抽屉：点遮罩关闭；窗口变宽时复位
  const drawerMask = $('drawerMask');
  if (drawerMask) drawerMask.addEventListener('click', () => setDrawer(false));
  window.addEventListener('resize', () => { if (!isNarrowWin()) setDrawer(false); });
  // 抽屉：下拉手势关闭（仅在抽屉已滑到顶部时生效，避免与列表滚动冲突）
  const drawerPanel = document.querySelector('.panel-left');
  let drawerTouchY = null;
  if (drawerPanel) {
    drawerPanel.addEventListener('touchstart', (e) => {
      drawerTouchY = e.touches[0].clientY;
    }, { passive: true });
    drawerPanel.addEventListener('touchend', (e) => {
      if (drawerTouchY == null) return;
      const dy = e.changedTouches[0].clientY - drawerTouchY;
      drawerTouchY = null;
      if (dy > 60 && drawerPanel.scrollTop <= 0 && drawerPanel.classList.contains('drawer-open')) {
        setDrawer(false);
      }
    }, { passive: true });
  }

  // 启动 rAF 进度循环
  startProgressLoop();
}

export default {
  isLocalTrack,
  playTrack,
  playLocal,
  playQueueIndex,
  togglePlay,
  prevTrack,
  nextTrack,
  initAudioEvents,
  setNowPlaying,
  updateMainPanel,
  updateDetailPage,
  cyclePlayMode,
  renderPlayMode,
  favoriteKey,
  isFavorite,
  toggleFavorite,
  loadFavorites,
  loadHistory,
  clearHistory
};
