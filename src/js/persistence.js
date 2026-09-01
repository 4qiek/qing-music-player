/**
 * persistence.js — 状态持久化
 *  1. 持久化可序列化设置：音量 / 播放模式 / 音质 / EQ / 上次视图
 *  2. 持久化“路径型”本地媒体库（文件夹导入、下载归库的条目；手动选入的 File 为会话级，不持久化）
 *  3. 视频断点续播、书籍阅读进度 / 阅读器设置
 * 重启后在应用初始化早期调用 restoreState() 恢复。
 */
import { store } from './store.js';

const STATE_KEY = 'qing-state-v2';
const PROGRESS_KEY = 'qing-progress-v1';
const READER_KEY = 'qing-reader-v1';

const SCALAR_KEYS = ['volume', 'playMode', 'quality', 'eqValues'];
const LIB_KEYS = ['localTracks', 'localVideos', 'localImages', 'localBooks'];

// 仅保留可序列化的路径型条目
function pickPathItems(list) {
  return (list || [])
    .filter((it) => it && it.origin === 'path' && it.path)
    .map((it) => ({ ...it, file: undefined }));
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, 400);
}

export function saveState() {
  try {
    const data = { lastView: store.get('view') };
    SCALAR_KEYS.forEach((k) => { data[k] = store.get(k); });
    LIB_KEYS.forEach((k) => { data[k] = pickPathItems(store.get(k)); });
    localStorage.setItem(STATE_KEY, JSON.stringify(data));
  } catch (e) { /* 配额超限等忽略 */ }
}

export function restoreState() {
  let data;
  try { data = JSON.parse(localStorage.getItem(STATE_KEY) || 'null'); } catch (e) { data = null; }
  if (!data) return null;
  SCALAR_KEYS.forEach((k) => {
    if (data[k] !== undefined) store.set(k, data[k]);
  });
  LIB_KEYS.forEach((k) => {
    if (Array.isArray(data[k]) && data[k].length) store.set(k, data[k]);
  });
  return data;
}

export function getLastView() {
  try {
    const d = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
    return d && d.lastView;
  } catch (e) { return null; }
}

// ===== 进度（视频断点 / 书籍位置） =====
function readProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); } catch (e) { return {}; }
}
function writeProgress(p) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ }
}

export function saveProgress(kind, key, data) {
  if (!key) return;
  const p = readProgress();
  if (!p[kind]) p[kind] = {};
  p[kind][key] = { ...(p[kind][key] || {}), ...data, _t: Date.now() };
  writeProgress(p);
}
export function getProgress(kind, key) {
  const p = readProgress();
  return (p[kind] && p[kind][key]) || null;
}

// ===== 阅读器设置 =====
export function getReaderSettings() {
  try {
    return Object.assign(
      { fontSize: 18, lineHeight: 1.9, bg: 'paper', progress: {}, bookmarks: {} },
      JSON.parse(localStorage.getItem(READER_KEY) || '{}')
    );
  } catch (e) {
    return { fontSize: 18, lineHeight: 1.9, bg: 'paper', progress: {}, bookmarks: {} };
  }
}
export function saveReaderSettings(s) {
  try { localStorage.setItem(READER_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

export function initPersistence() {
  // 关键状态变化即防抖落盘
  SCALAR_KEYS.forEach((k) => store.subscribe(k, scheduleSave));
  LIB_KEYS.forEach((k) => store.subscribe(k, scheduleSave));
  window.addEventListener('beforeunload', saveState);
}

export default {
  initPersistence, saveState, restoreState, getLastView,
  saveProgress, getProgress, getReaderSettings, saveReaderSettings
};
