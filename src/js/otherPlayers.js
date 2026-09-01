/**
 * otherPlayers.js — 其他音乐播放器检测与控制（SMTC）
 * 职责：检测系统中正在播放的应用、渲染列表、打开详情、
 *       轮询更新播放状态与进度、按歌名匹配网易云歌词。
 */
import { store } from './store.js';
import { apiClient } from './apiClient.js';
import { parseLRC } from './lyric.js';
import { formatTime } from './utils.js';

const $ = (id) => document.getElementById(id);

const APP_NAME_MAP = {
  'cloudmusic.exe': '网易云音乐',
  'QQMusic.exe': 'QQ音乐',
  'QQMusicPlayer.exe': 'QQ音乐',
  'KuGou.exe': '酷狗音乐',
  'kugou.exe': '酷狗音乐',
  'KwMusic.exe': '酷我音乐',
  'Spotify.exe': 'Spotify',
  'AppleMusic.exe': 'Apple Music',
  'AppleInc.AppleMusicWin': 'Apple Music',
  'iTunes.exe': 'iTunes',
  'AppleInc.iTunes': 'iTunes',
  'MiguMusic.exe': '咪咕音乐',
  'foobar2000.exe': 'foobar2000',
  'AIMP.exe': 'AIMP',
  'chrome.exe': 'Chrome',
  'msedge.exe': 'Edge',
  'firefox.exe': 'Firefox',
  'Microsoft.ZuneMusic': '系统媒体播放器',
  'Music.UI.exe': '系统媒体播放器'
};

function getAppName(appId) {
  if (!appId) return '未知应用';
  const lower = appId.toLowerCase();
  for (const [key, name] of Object.entries(APP_NAME_MAP)) {
    if (lower.includes(key.toLowerCase())) return name;
  }
  const parts = appId.split('.');
  return parts[parts.length - 1] || appId;
}

let smtcPollTimer = null;
let opdLyricData = [];
let opdLyricTimer = null;

// ===== 检测 =====
export async function detectSmtcSessions() {
  let sessionsRaw;
  let players = [];
  try {
    [sessionsRaw, players] = await Promise.all([
      apiClient.getSmtcSessions(),
      apiClient.detectPlayers ? apiClient.detectPlayers() : []
    ]);
  } catch (e) {
    sessionsRaw = [];
  }
  let sessions = sessionsRaw;
  if (sessions && !Array.isArray(sessions)) sessions = [sessions];
  const list = Array.isArray(sessions) ? sessions : [];
  store.set('smtcSessions', list);

  // 合并进程补充
  const smtcAppIds = new Set(list.map((s) => getAppName(s.appId)));
  const merged = [...list];
  (players || []).forEach((p) => {
    if (!smtcAppIds.has(p.name)) {
      merged.push({
        appId: p.process,
        title: '',
        artist: '',
        cover: '',
        status: 'NotPlaying',
        position: 0,
        duration: 0,
        isProcessOnly: true,
        processName: p.name
      });
    }
  });

  renderSmtcList(merged);

  // 当前选中会话状态更新
  const current = store.get('currentSmtcSession');
  if (current && !current.isProcessOnly) {
    const updated = list.find((s) => s.appId === current.appId);
    if (updated) {
      store.set('currentSmtcSession', updated);
      updateOpdDisplay();
    }
  }
}

// ===== 列表渲染 =====
function renderSmtcList(list) {
  const el = $('opList');
  const displayList = list || store.get('smtcSessions');
  if (!displayList || displayList.length === 0) {
    el.innerHTML = '<div class="op-empty">未检测到正在播放的应用<br><span style="font-size:10px">打开网易云/QQ/酷狗等即可在此控制</span></div>';
    return;
  }
  el.innerHTML = displayList.map((s, i) => {
    const isPlaying = s.status === 'Playing';
    const name = s.isProcessOnly ? s.processName : getAppName(s.appId);
    const title = s.title || (s.isProcessOnly ? '未播放' : '未知歌曲');
    const artist = s.artist || (s.isProcessOnly ? '点击开始播放' : '未知艺术家');
    const statusIcon = isPlaying ? '▶' : (s.isProcessOnly ? '○' : '⏸');
    return `
    <div class="op-item ${isPlaying ? 'playing' : ''}" data-index="${i}" role="button" tabindex="0" aria-label="${name} ${title}">
      ${s.cover ? `<img class="op-cover" src="file:///${s.cover.replace(/\\/g, '/')}" alt="">` : `<div class="op-cover-placeholder"><svg><use href="#i-music"/></svg></div>`}
      <div class="op-info">
        <div class="op-song">${title}</div>
        <div class="op-app">${name} · ${artist}</div>
      </div>
      <div class="op-status">${statusIcon}</div>
    </div>`;
  }).join('');

  el.querySelectorAll('.op-item').forEach((item) => {
    const open = () => openOtherPlayerDetail(parseInt(item.dataset.index, 10), displayList);
    item.addEventListener('click', open);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });
}

// ===== 详情 =====
function openOtherPlayerDetail(index, list) {
  const displayList = list || store.get('smtcSessions');
  const session = displayList[index];
  if (!session) return;
  store.set('currentSmtcSession', session);
  $('otherPlayerDetail').classList.add('show');
  updateOpdDisplay();
  if (!session.isProcessOnly) {
    loadOpdLyrics();
    startOpdPolling();
  } else {
    $('opdLyrics').innerHTML = '<div class="lyrics-placeholder"><svg style="width:40px;height:40px;opacity:0.3;margin-bottom:12px"><use href="#i-music"/></svg><br>应用尚未开始播放<br><span style="font-size:12px;opacity:0.7">点击播放键让它播放起来吧</span></div>';
  }
}

function updateOpdDisplay() {
  const s = store.get('currentSmtcSession');
  if (!s) return;
  const appName = s.isProcessOnly ? s.processName : getAppName(s.appId);
  $('opdSource').textContent = appName;
  $('opdSongName').textContent = s.title || (s.isProcessOnly ? appName : '未知歌曲');
  $('opdSongArtist').textContent = s.artist || (s.isProcessOnly ? '点击播放键开始' : '暂无艺术家信息');

  const coverImg = $('opdCover');
  const coverPh = $('opdCoverPlaceholder');
  if (s.cover) {
    coverImg.src = 'file:///' + s.cover.replace(/\\/g, '/');
    coverImg.style.display = 'block';
    coverPh.style.display = 'none';
  } else {
    coverImg.style.display = 'none';
    coverPh.style.display = 'flex';
  }

  const isPlaying = s.status === 'Playing';
  $('opdPlayBtn').innerHTML = `<svg><use href="#${isPlaying ? 'i-pause' : 'i-play'}"/></svg>`;

  const pos = s.position || 0;
  const dur = s.duration || 0;
  $('opdCurTime').textContent = formatTime(pos);
  $('opdTotalTime').textContent = formatTime(dur);
  $('opdProgressFill').style.width = dur > 0 ? (pos / dur) * 100 + '%' : '0%';

  const bg = $('opdBg');
  bg.style.backgroundImage = s.cover ? `url(file:///${s.cover.replace(/\\/g, '/')})` : 'none';
}

// ===== 轮询 =====
function startOpdPolling() {
  if (smtcPollTimer) clearInterval(smtcPollTimer);
  smtcPollTimer = setInterval(async () => {
    const current = store.get('currentSmtcSession');
    if (!current) return;
    try {
      const sessions = await apiClient.getSmtcSessions();
      const updated = sessions.find((s) => s.appId === current.appId);
      if (updated) {
        const songChanged = updated.title !== current.title;
        store.set('currentSmtcSession', updated);
        updateOpdDisplay();
        if (songChanged) loadOpdLyrics();
      }
    } catch (e) { /* ignore */ }
  }, 2000);
}

function stopOpdPolling() {
  if (smtcPollTimer) {
    clearInterval(smtcPollTimer);
    smtcPollTimer = null;
  }
}

// ===== 歌词 =====
async function loadOpdLyrics() {
  const current = store.get('currentSmtcSession');
  if (!current) return;
  const { title, artist } = current;
  if (!title) {
    $('opdLyrics').innerHTML = '<div class="lyrics-placeholder">暂无歌词</div>';
    return;
  }
  try {
    const keyword = artist ? `${title} ${artist}` : title;
    const results = await apiClient.neteaseSearch(keyword);
    if (results && results.length > 0) {
      const best = results.find((r) => r.name === title) || results[0];
      const lyric = await apiClient.neteaseLyric(best.id);
      if (lyric && lyric.lrc) {
        opdLyricData = parseLRC(lyric.lrc);
        renderOpdLyrics();
        startOpdLyricScroll();
        return;
      }
    }
    $('opdLyrics').innerHTML = '<div class="lyrics-placeholder">未找到歌词</div>';
  } catch (e) {
    $('opdLyrics').innerHTML = '<div class="lyrics-placeholder">歌词加载失败</div>';
  }
}

function renderOpdLyrics() {
  const container = $('opdLyrics');
  if (opdLyricData.length === 0) {
    container.innerHTML = '<div class="lyrics-placeholder">暂无歌词</div>';
    return;
  }
  container.innerHTML = opdLyricData.map((line, i) =>
    `<div class="lyric-line" data-index="${i}">${line.text || '♪'}</div>`
  ).join('');
}

function startOpdLyricScroll() {
  if (opdLyricTimer) clearInterval(opdLyricTimer);
  opdLyricTimer = setInterval(() => {
    const current = store.get('currentSmtcSession');
    if (!current || opdLyricData.length === 0) return;
    const time = current.position || 0;
    let activeIndex = -1;
    for (let i = 0; i < opdLyricData.length; i++) {
      if (time >= opdLyricData[i].time) activeIndex = i;
      else break;
    }
    const container = $('opdLyrics');
    container.querySelectorAll('.lyric-line').forEach((el, i) => {
      el.classList.toggle('active', i === activeIndex);
    });
    if (activeIndex >= 0) {
      const activeEl = container.querySelector(`.lyric-line[data-index="${activeIndex}"]`);
      if (activeEl) {
        const offset = activeEl.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2;
        container.scrollTo({ top: offset, behavior: 'smooth' });
      }
    }
  }, 500);
}

// ===== 控制 =====
async function controlSession(action) {
  const current = store.get('currentSmtcSession');
  if (!current) return;
  if (current.isProcessOnly) {
    await apiClient.mediaKey(action);
  } else {
    await apiClient.smtcControl(action, current.appId);
  }
  setTimeout(detectSmtcSessions, 500);
}

export function initOtherPlayers() {
  $('opdClose').addEventListener('click', () => {
    $('otherPlayerDetail').classList.remove('show');
    stopOpdPolling();
    if (opdLyricTimer) {
      clearInterval(opdLyricTimer);
      opdLyricTimer = null;
    }
  });

  $('opdPlayBtn').addEventListener('click', () => controlSession('playpause'));
  $('opdPrevBtn').addEventListener('click', () => controlSession('prev'));
  $('opdNextBtn').addEventListener('click', () => controlSession('next'));

  $('opRefresh').addEventListener('click', detectSmtcSessions);
  setInterval(detectSmtcSessions, 5000);
  detectSmtcSessions();
}

export default { initOtherPlayers, detectSmtcSessions };
