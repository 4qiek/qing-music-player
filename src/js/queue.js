/**
 * queue.js — 播放队列面板
 * 职责：展示当前队列，支持点击播放、移除、清空、上下移动排序。
 */
import { store } from './store.js';
import { playOnline, toggleFavorite, isFavorite } from './player.js';
import { escapeHtml, PLATFORM_LABEL } from './utils.js';

const $ = (id) => document.getElementById(id);

function renderQueue() {
  const list = $('queueList');
  const queue = store.get('currentQueue') || [];
  const curIdx = store.get('currentIndex');
  if (!queue.length) {
    list.innerHTML = '<div class="empty-state" style="padding:24px 0"><p>播放队列是空的</p></div>';
    return;
  }
  let html = '';
  queue.forEach((t, i) => {
    const active = i === curIdx;
    html += `<div class="queue-row ${active ? 'active' : ''}" data-idx="${i}">
      <span class="q-idx">${i + 1}</span>
      <span class="q-name">${active ? '<svg style="width:12px;height:12px;color:var(--accent)"><use href="#i-volume"/></svg> ' : ''}${escapeHtml(t.name)}</span>
      <span class="q-artist">${escapeHtml(t.artist || '')}</span>
      <span class="q-tag">${PLATFORM_LABEL[t.platform] || ''}</span>
      <span class="q-ops">
        <button class="q-move-up" title="上移" data-action="up">↑</button>
        <button class="q-remove" title="移除" data-action="remove">✕</button>
      </span>
    </div>`;
  });
  list.innerHTML = html;

  list.querySelectorAll('.queue-row').forEach((row) => {
    const idx = parseInt(row.dataset.idx, 10);
    row.addEventListener('click', (e) => {
      if (e.target.closest('.q-ops')) return;
      store.set('searchResults', queue);
      playOnline(idx);
    });
    row.querySelector('[data-action="up"]').addEventListener('click', (e) => {
      e.stopPropagation();
      moveUp(idx);
    });
    row.querySelector('[data-action="remove"]').addEventListener('click', (e) => {
      e.stopPropagation();
      removeAt(idx);
    });
  });
}

function moveUp(idx) {
  if (idx <= 0) return;
  const queue = [...store.get('currentQueue')];
  const curIdx = store.get('currentIndex');
  const a = queue[idx];
  queue[idx] = queue[idx - 1];
  queue[idx - 1] = a;
  store.set('currentQueue', queue);
  if (curIdx === idx) store.set('currentIndex', idx - 1);
  else if (curIdx === idx - 1) store.set('currentIndex', idx);
  renderQueue();
}

function removeAt(idx) {
  const queue = [...store.get('currentQueue')];
  let curIdx = store.get('currentIndex');
  queue.splice(idx, 1);
  store.set('currentQueue', queue);
  if (idx < curIdx) store.set('currentIndex', curIdx - 1);
  else if (idx === curIdx) store.set('currentIndex', Math.min(curIdx, queue.length - 1));
  renderQueue();
}

export function initQueue() {
  const btn = $('queueBtn');
  const panel = $('queuePanel');
  if (btn) {
    btn.addEventListener('click', () => {
      panel.classList.toggle('show');
      btn.classList.toggle('active');
      renderQueue();
    });
  }
  const clearBtn = $('queueClear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      store.set('currentQueue', []);
      store.set('currentIndex', -1);
      renderQueue();
    });
  }
  // 队列变化时刷新面板
  store.subscribe('currentQueue', () => {
    if (panel && panel.classList.contains('show')) renderQueue();
  });
  store.subscribe('currentIndex', () => {
    if (panel && panel.classList.contains('show')) renderQueue();
  });
}

export default { initQueue, renderQueue };
