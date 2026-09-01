/**
 * desktopLyric.js — 桌面歌词
 * 职责：控制透明置顶的桌面歌词悬浮窗（主进程负责窗口，本模块负责开关）。
 */
import { store } from './store.js';
import { eventBus } from './eventBus.js';

const $ = (id) => document.getElementById(id);

export function setDesktopLyric(on) {
  store.set('lyricDesktopOn', on);
  if (window.qingAPI) {
    if (on) window.qingAPI.lyricShow();
    else window.qingAPI.lyricHide();
  }
  const btn = $('lyricBtn');
  if (btn) btn.classList.toggle('active', on);
}

export function toggleDesktopLyric() {
  setDesktopLyric(!store.get('lyricDesktopOn'));
  eventBus.emit('toast', {
    type: 'info',
    message: store.get('lyricDesktopOn') ? '桌面歌词已开启' : '桌面歌词已关闭'
  });
}

export function initDesktopLyric() {
  const btn = $('lyricBtn');
  if (btn) btn.addEventListener('click', toggleDesktopLyric);
}

export default { initDesktopLyric, toggleDesktopLyric, setDesktopLyric };
