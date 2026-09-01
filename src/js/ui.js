/**
 * ui.js — 通用 UI 能力
 * 职责：Toast 非阻塞提示、深浅主题切换、键盘快捷键、
 *       骨架屏加载占位、全局未处理异常捕获与日志。
 */
import { store } from './store.js';
import { eventBus } from './eventBus.js';
import { togglePlay, prevTrack, nextTrack } from './player.js';

const $ = (id) => document.getElementById(id);

// ===== Toast =====
let toastContainer = null;
let toastId = 0;

function ensureToastContainer() {
  if (toastContainer) return toastContainer;
  toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  toastContainer.setAttribute('role', 'status');
  toastContainer.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastContainer);
  return toastContainer;
}

/**
 * 弹出 Toast
 * @param {object} opts { type: 'success'|'error'|'info', message, duration }
 */
export function toast({ type = 'info', message = '', duration = 2600 } = {}) {
  const container = ensureToastContainer();
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-icon"></span><span class="toast-msg">${message}</span>`;
  container.appendChild(el);
  // 触发进入动画
  requestAnimationFrame(() => el.classList.add('show'));
  const close = () => {
    el.classList.remove('show');
    el.classList.add('hide');
    setTimeout(() => el.remove(), 300);
  };
  el.addEventListener('click', close);
  const timer = setTimeout(close, duration);
  el.dataset.timer = timer;
  return el;
}

// ===== 主题切换 =====
const THEME_KEY = 'qing-player-theme';

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  const btn = $('themeToggle');
  if (btn) {
    btn.classList.toggle('active', theme === 'dark');
    btn.setAttribute('aria-label', theme === 'dark' ? '切换到浅色模式' : '切换到深色模式');
    const icon = $('themeIcon');
    if (icon) icon.setAttribute('href', theme === 'dark' ? '#i-sun' : '#i-moon');
  }
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  setTheme(saved === 'dark' ? 'dark' : 'light');
  const btn = $('themeToggle');
  if (btn) btn.addEventListener('click', toggleTheme);
}

// ===== 骨架屏 =====
export function showSkeleton(container, rows = 5) {
  let html = '';
  for (let i = 0; i < rows; i++) {
    html += `<div class="skeleton-row">
      <span class="skeleton skeleton-cover"></span>
      <span class="skeleton skeleton-line" style="width:${40 + Math.random() * 40}%"></span>
      <span class="skeleton skeleton-line" style="width:${20 + Math.random() * 25}%"></span>
    </div>`;
  }
  container.innerHTML = `<div class="skeleton-wrap">${html}</div>`;
}

// ===== 键盘快捷键 =====
function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // 输入框内不拦截
    if (isTypingTarget(document.activeElement)) return;
    // 弹窗打开时只响应 Esc
    const modalOpen = $('loginModal').classList.contains('show');
    if (modalOpen) {
      if (e.key === 'Escape') $('loginModal').classList.remove('show');
      return;
    }

    switch (e.key) {
      case ' ':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowUp':
        e.preventDefault();
        adjustVolume(+0.05);
        break;
      case 'ArrowDown':
        e.preventDefault();
        adjustVolume(-0.05);
        break;
      case 'ArrowRight':
        e.preventDefault();
        seekBy(5);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        seekBy(-5);
        break;
      case 'n':
      case 'N':
        nextTrack();
        break;
      case 'p':
      case 'P':
        prevTrack();
        break;
      case 'm':
      case 'M':
        toggleMute();
        break;
      case 'Escape':
        // 关闭浮层
        $('playerDetail').classList.remove('show');
        $('otherPlayerDetail').classList.remove('show');
        $('weatherPage').classList.remove('show');
        break;
    }
  });

  eventBus.on('toast', (payload) => toast(payload));
}

function adjustVolume(delta) {
  const audio = $('audio');
  if (!audio) return;
  const next = Math.max(0, Math.min(1, audio.volume + delta));
  audio.volume = next;
  store.set('volume', next);
  $('volume').value = next * 100;
  $('muteBtn').classList.toggle('active', next === 0);
}

function seekBy(sec) {
  const audio = $('audio');
  if (!audio || !audio.duration) return;
  audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + sec));
}

function toggleMute() {
  $('muteBtn').click();
}

// ===== 全局错误捕获与日志 =====
export function initGlobalErrorHandler() {
  window.addEventListener('unhandledrejection', (event) => {
    const err = event.reason;
    console.error('[global] 未处理的 Promise 异常:', err);
    toast({ type: 'error', message: '操作遇到问题，请稍后重试' });
  });

  window.addEventListener('error', (event) => {
    console.error('[global] 运行时错误:', event.error || event.message);
  });

  window.addEventListener('app:error', (event) => {
    console.error('[app] 业务异常:', event.detail);
  });
}

// 每次显示快捷键提示
export function showShortcutHint() {
  // 在底部迷你条 title 中体现
  $('npExpand').setAttribute('title', '展开播放页（Space 播放/暂停，↑↓ 音量，←→ 快进快退，N/P 切歌）');
}

export default {
  toast,
  getTheme,
  setTheme,
  toggleTheme,
  initTheme,
  showSkeleton,
  initKeyboardShortcuts,
  initGlobalErrorHandler,
  showShortcutHint
};
