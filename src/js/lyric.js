/**
 * lyric.js — 歌词解析与展示
 * 负责 LRC 解析、加载、主播放器歌词滚动（含翻译合并）。
 */
import { store } from './store.js';
import { apiClient } from './apiClient.js';
import { formatTime } from './utils.js';

/**
 * 解析 LRC 文本
 * @param {string} lrcText
 * @returns {Array<{time:number,text:string}>}
 */
export function parseLRC(lrcText) {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const result = [];
  const timeReg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
  lines.forEach((line) => {
    const text = line.replace(timeReg, '').trim();
    timeReg.lastIndex = 0;
    let match;
    while ((match = timeReg.exec(line)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const ms = parseInt(match[3].padEnd(3, '0'), 10);
      const time = min * 60 + sec + ms / 1000;
      if (text) result.push({ time, text });
    }
  });
  return result.sort((a, b) => a.time - b.time);
}

/**
 * 加载当前曲目歌词（主播放器）
 * @param {object} track 曲目
 * @param {HTMLElement} lyricEl 歌词容器
 */
export async function loadLyric(track, lyricEl) {
  store.set('lyricData', []);
  store.set('currentLyricIndex', -1);

  let lyricData = [];
  // 网易云歌曲直接用 id；本地歌曲若已在线匹配，则用 matchedId 拉取在线歌词
  let lyricId = null;
  if (track.platform === 'netease') lyricId = track.id;
  else if (track.platform === 'local' && track.matchedId) lyricId = track.matchedId;

  if (lyricId) {
    try {
      const res = await apiClient.neteaseLyric(lyricId);
      if (res && res.lrc) {
        lyricData = parseLRC(res.lrc);
        // 翻译歌词合并
        if (res.tlyric) {
          const trans = parseLRC(res.tlyric);
          lyricData.forEach((l) => {
            const t = trans.find((x) => Math.abs(x.time - l.time) < 0.5);
            if (t) l.text += '\n' + t.text;
          });
        }
      }
    } catch (e) {
      lyricData = [];
    }
  }

  store.set('lyricData', lyricData);

  if (lyricData.length === 0) {
    lyricEl.innerHTML = '<div class="lyric-line empty">暂无歌词</div>';
    lyricEl.style.transform = 'translateY(0)';
    return;
  }
  lyricEl.innerHTML = lyricData
    .map((l, i) => `<div class="lyric-line" data-idx="${i}">${l.text.replace(/\n/g, '<br>')}</div>`)
    .join('');
  lyricEl.style.transform = 'translateY(0)';
}

/**
 * 根据播放进度更新高亮歌词（节流调用由 rAF 驱动）
 * @param {number} currentTime 当前秒
 */
export function updateLyric(currentTime) {
  const lyricData = store.get('lyricData');
  const lyricEl = document.getElementById('lyricPanel');
  if (lyricData.length === 0 || !lyricEl) return;

  let idx = -1;
  for (let i = 0; i < lyricData.length; i++) {
    if (lyricData[i].time <= currentTime) idx = i;
    else break;
  }
  if (idx === store.get('currentLyricIndex')) return;
  store.set('currentLyricIndex', idx);

  const lines = lyricEl.querySelectorAll('.lyric-line');
  lines.forEach((l) => l.classList.remove('active'));
  if (idx >= 0 && lines[idx]) {
    lines[idx].classList.add('active');
    const lineHeight = lines[idx].offsetHeight + 16;
    lyricEl.style.transform = `translateY(${-idx * lineHeight}px)`;
  }

  // 桌面歌词窗口同步（开启时）
  if (store.get('lyricDesktopOn') && window.qingAPI && window.qingAPI.lyricUpdate) {
    const cur = lyricData[idx];
    const next = lyricData[idx + 1];
    window.qingAPI.lyricUpdate({
      text: cur ? cur.text.split('\n')[0] : '',
      next: next ? next.text.split('\n')[0] : ''
    });
  }
}

export default { parseLRC, loadLyric, updateLyric, formatTime };
