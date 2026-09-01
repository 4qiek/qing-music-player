/**
 * sleepTimer.js — 睡眠定时
 * 职责：15/30/60/90 分钟后自动暂停播放。
 */
import { store } from './store.js';
import { eventBus } from './eventBus.js';

const $ = (id) => document.getElementById(id);

let timer = null;
let deadline = 0;

function stopTimer() {
  if (timer) { clearInterval(timer); timer = null; }
  deadline = 0;
  store.set('sleepTimerRemaining', 0);
  const btn = $('sleepBtn');
  if (btn) { btn.classList.remove('active'); btn.title = '睡眠定时'; }
}

function update() {
  const remain = deadline - Date.now();
  if (remain <= 0) {
    stopTimer();
    const audio = document.getElementById('audio');
    if (audio && !audio.paused) audio.pause();
    eventBus.emit('toast', { type: 'info', message: '睡眠定时已到点，播放已暂停' });
    return;
  }
  store.set('sleepTimerRemaining', remain);
  const btn = $('sleepBtn');
  if (btn) {
    const min = Math.ceil(remain / 60000);
    btn.classList.add('active');
    btn.title = `睡眠定时：${min} 分钟后暂停`;
  }
}

function setSleep(min) {
  stopTimer();
  deadline = Date.now() + min * 60000;
  timer = setInterval(update, 1000);
  update();
  eventBus.emit('toast', { type: 'success', message: `${min} 分钟后将自动暂停播放` });
}

export function initSleepTimer() {
  const btn = $('sleepBtn');
  const menu = $('sleepMenu');
  if (!btn || !menu) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('show');
  });
  document.addEventListener('click', () => menu.classList.remove('show'));
  menu.querySelectorAll('.sleep-item[data-min]').forEach((item) => {
    item.addEventListener('click', () => {
      setSleep(parseInt(item.dataset.min, 10));
      menu.classList.remove('show');
    });
  });
  const cancel = $('sleepCancel');
  if (cancel) cancel.addEventListener('click', () => {
    stopTimer();
    eventBus.emit('toast', { type: 'info', message: '已取消睡眠定时' });
    menu.classList.remove('show');
  });
}

export default { initSleepTimer };
