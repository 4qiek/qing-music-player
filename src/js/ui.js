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
  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  const msg = document.createElement('span');
  msg.className = 'toast-msg';
  // 使用 textContent，避免远程数据（歌名/歌词/错误）注入 XSS
  msg.textContent = message;
  el.appendChild(icon);
  el.appendChild(msg);
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

// ===== 空状态引导插画（极简线条风：圆角矩形 + 类型轮廓，描边用 currentColor → var(--text-3)） =====
const EMPTY_ILL = {
  music: '<rect x="18" y="10" width="60" height="52" rx="8"/><path d="M44 44V26l14-3v18"/><circle cx="40" cy="44" r="4"/><circle cx="54" cy="41" r="4"/>',
  video: '<rect x="18" y="10" width="60" height="52" rx="8"/><path d="M42 30l14 7-14 7z"/><path d="M26 18v6M26 48v6M70 18v6M70 48v6"/>',
  image: '<rect x="18" y="10" width="60" height="52" rx="8"/><circle cx="38" cy="26" r="4"/><path d="M24 54l14-14 10 10 8-8 16 16"/>',
  book: '<path d="M48 22c-6-4-14-4-20-2v32c6-2 14-2 20 2 6-4 14-4 20-2V20c-6-2-14-2-20 2z"/><path d="M48 22v32"/>',
  search: '<circle cx="44" cy="32" r="12"/><path d="M53 41l10 10"/>',
  heart: '<rect x="18" y="10" width="60" height="52" rx="8"/><path d="M48 50S34 42 34 33a7.5 7.5 0 0 1 14-3 7.5 7.5 0 0 1 14 3c0 9-14 17-14 17z"/>',
  clock: '<circle cx="48" cy="36" r="16"/><path d="M48 27v9l6 4"/>'
};

/**
 * 生成空状态内联 SVG 插画
 * @param {string} kind music / video / image / book / search / heart / clock
 * @returns {string} SVG 字符串
 */
export function emptyIll(kind = 'music') {
  return `<svg class="es-ill" viewBox="0 0 96 72" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${EMPTY_ILL[kind] || EMPTY_ILL.music}</svg>`;
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
    // 视频 / 书籍全屏浮层打开时，由其内部快捷键处理，避免误控音乐
    const vp = document.getElementById('videoPlayerOverlay');
    const br = document.getElementById('bookReader');
    if ((vp && vp.style.display !== 'none') || (br && br.style.display !== 'none')) return;
    // 弹窗打开时只响应 Esc（登录弹窗已随在线音乐移除，这里统一按类选择器匹配所有弹窗）
    const openModal = document.querySelector('.modal-overlay.show, .modal-mask.show');
    if (openModal) {
      if (e.key === 'Escape') openModal.classList.remove('show');
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
        $('weatherPage').classList.remove('show');
        // 关闭窄窗播放抽屉
        const pl = document.querySelector('.panel-left');
        if (pl) pl.classList.remove('drawer-open');
        const dm = $('drawerMask');
        if (dm) dm.classList.remove('show');
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

// ===== 通用输入弹窗（替代 Electron 不支持的 window.prompt） =====
let promptInputEl = null;
export function promptInput({ title = '输入', message = '', placeholder = '', defaultValue = '', confirmText = '确定', validate } = {}) {
  return new Promise((resolve) => {
    let overlay = document.getElementById('inputModal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = 'inputModal';
      overlay.innerHTML = `
        <div class="modal" role="dialog" aria-label="输入">
          <h3 id="inputModalTitle"></h3>
          <div class="modal-sub" id="inputModalSub"></div>
          <div class="form-group"><input type="text" id="inputModalField" aria-label="输入内容" autocomplete="off"></div>
          <div class="error-msg" id="inputModalError" role="alert"></div>
          <div class="modal-actions">
            <button class="btn" id="inputModalCancel" type="button">取消</button>
            <button class="btn btn-primary" id="inputModalOk" type="button">${confirmText}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    }
    const titleEl = overlay.querySelector('#inputModalTitle');
    const subEl = overlay.querySelector('#inputModalSub');
    const field = overlay.querySelector('#inputModalField');
    const errEl = overlay.querySelector('#inputModalError');
    const okBtn = overlay.querySelector('#inputModalOk');
    const cancelBtn = overlay.querySelector('#inputModalCancel');

    titleEl.textContent = title;
    subEl.textContent = message || '';
    field.value = defaultValue || '';
    errEl.textContent = '';

    const done = (val) => { overlay.classList.remove('show'); cleanup(); resolve(val); };
    const close = () => { overlay.classList.remove('show'); cleanup(); resolve(null); };
    function onOk() {
      const v = field.value.trim();
      if (validate) { const ve = validate(v); if (ve) { errEl.textContent = ve; return; } }
      done(v);
    }
    function onKey(e) { if (e.key === 'Enter') onOk(); else if (e.key === 'Escape') close(); }
    function cleanup() {
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', close);
      field.removeEventListener('keydown', onKey);
    }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', close);
    field.addEventListener('keydown', onKey);
    overlay.classList.add('show');
    setTimeout(() => field.focus(), 30);
  });
}

export default {
  toast,
  getTheme,
  setTheme,
  toggleTheme,
  initTheme,
  showSkeleton,
  emptyIll,
  initKeyboardShortcuts,
  initGlobalErrorHandler,
  showShortcutHint,
  promptInput
};
