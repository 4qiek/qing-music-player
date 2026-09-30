/**
 * accent.js — 自定义点缀色
 * 预设色板 + 自定义取色；把 hex 持久化（store 键 accentColor + localStorage），
 * 并动态派生 soft / border / text 三个层级写入 :root 内联变量；
 * text 派生 = 亮度压暗 40%（暗色模式反向提亮 40%）；启动时恢复，主题切换时重算。
 */
import { store } from './store.js';

const KEY = 'qing-accent-color';

/** hex → {r,g,b}，非法输入返回 null */
function hexToRgb(hex) {
  const m = String(hex || '').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16)
  };
}

function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

/** 把点缀色与派生层级写入 :root（暗色模式直接使用用户色，仅派生值随模式调整） */
function apply(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return;
  const dark = isDark();
  const style = document.documentElement.style;
  style.setProperty('--pop', hex);
  style.setProperty('--pop-soft', `rgba(${rgb.r},${rgb.g},${rgb.b},${dark ? 0.14 : 0.10})`);
  style.setProperty('--pop-border', `rgba(${rgb.r},${rgb.g},${rgb.b},${dark ? 0.4 : 0.35})`);
  // text 派生：亮色压暗 40%，暗色提亮 40%，保证在 soft 浅底上的可读性
  const f = dark ? (c) => c + (255 - c) * 0.4 : (c) => c * 0.6;
  style.setProperty('--pop-text', `rgb(${Math.round(f(rgb.r))},${Math.round(f(rgb.g))},${Math.round(f(rgb.b))})`);
}

/** 高亮当前选中的预设色块 */
function markActive(hex) {
  document.querySelectorAll('.ac-sw').forEach((sw) => {
    sw.classList.toggle('active', sw.dataset.color.toLowerCase() === String(hex).toLowerCase());
  });
}

/** 选中并持久化点缀色 */
export function setAccent(hex) {
  if (!hexToRgb(hex)) return;
  store.set('accentColor', hex);
  try { localStorage.setItem(KEY, hex); } catch (e) { /* 存储不可用时静默 */ }
  apply(hex);
  markActive(hex);
}

/** 初始化：绑定按钮/浮层交互并恢复上次选择 */
export function initAccent() {
  const btn = document.getElementById('accentToggle');
  const menu = document.getElementById('accentMenu');
  const custom = document.getElementById('accentCustom');
  if (!btn || !menu) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('show');
  });
  menu.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => menu.classList.remove('show'));

  menu.querySelectorAll('.ac-sw').forEach((sw) => {
    sw.addEventListener('click', () => {
      if (custom) custom.value = sw.dataset.color;
      setAccent(sw.dataset.color);
    });
  });
  if (custom) {
    custom.addEventListener('input', () => setAccent(custom.value));
  }

  // 启动恢复
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
  if (saved && hexToRgb(saved)) {
    store.set('accentColor', saved);
    apply(saved);
    markActive(saved);
    if (custom) custom.value = saved;
  }

  // 深浅主题切换时按新模式重算派生值
  new MutationObserver(() => {
    const cur = store.get('accentColor');
    if (cur) apply(cur);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

export default { initAccent, setAccent };
