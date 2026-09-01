/**
 * mini.js — 迷你模式
 * 职责：将窗口缩小为迷你条，仅保留播放控制。
 */
import { store } from './store.js';
import { eventBus } from './eventBus.js';

const $ = (id) => document.getElementById(id);

export function toggleMiniMode() {
  const on = !store.get('miniMode');
  store.set('miniMode', on);
  document.body.classList.toggle('mini-mode', on);
  if (window.qingAPI && window.qingAPI.setMiniMode) {
    window.qingAPI.setMiniMode(on);
  }
  const btn = $('miniBtn');
  if (btn) btn.classList.toggle('active', on);
  eventBus.emit('toast', {
    type: 'info',
    message: on ? '已进入迷你模式（点击 ⤢ 退出）' : '已退出迷你模式'
  });
}

export function initMini() {
  const btn = $('miniBtn');
  if (btn) btn.addEventListener('click', toggleMiniMode);
}

export default { initMini, toggleMiniMode };
