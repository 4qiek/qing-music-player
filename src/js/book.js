/**
 * book.js — 书籍阅读器模块
 * 职责：TXT/Markdown 文档导入、列表、阅读面板（字号调节、滚动），
 *       以及按文件名到豆瓣在线匹配书名 / 作者 / 年份 / 封面。
 */
import { store } from './store.js';
import { apiClient } from './apiClient.js';
import { eventBus } from './eventBus.js';
import { sleep } from './utils.js';
import { cleanBookKeyword, fetchMatch, bindCoverFallback } from './metaMatch.js';

const $ = (id) => document.getElementById(id);

let bookContent = '';      // 当前阅读文本
let bookFont = 16;         // 字号 px

function escapeName(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function initBook() {
  const fileInput = $('bookFileInput');
  $('bookImportBtn').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const books = files.map((f) => ({
      id: 'book_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      name: f.name.replace(/\.[^.]+$/, ''),
      ext: (f.name.split('.').pop() || '').toUpperCase(),
      size: f.size,
      matchedId: null,
      file: f
    }));
    store.set('localBooks', [...store.get('localBooks'), ...books]);
    renderBookList();
    e.target.value = '';
  });

  const matchAllBtn = $('bookMatchAllBtn');
  if (matchAllBtn) matchAllBtn.addEventListener('click', () => matchAllBooks());

  // 阅读器交互
  $('bookReaderClose').addEventListener('click', closeReader);
  $('bookFontUp').addEventListener('click', () => setFont(bookFont + 2));
  $('bookFontDown').addEventListener('click', () => setFont(bookFont - 2));
  document.addEventListener('keydown', (e) => {
    if ($('bookReader').style.display === 'none') return;
    if (e.key === 'Escape') closeReader();
    else if (e.key === '=' || e.key === '+') setFont(bookFont + 2);
    else if (e.key === '-') setFont(bookFont - 2);
  });
}

/** 匹配单本书籍 */
export async function matchBook(idx) {
  const books = store.get('localBooks');
  const b = books[idx];
  if (!b) return null;
  const kw = cleanBookKeyword(b.name);
  let hit = null;
  try {
    hit = await fetchMatch(apiClient, kw, 'book');
  } catch (e) {
    hit = null;
  }
  if (hit) {
    b.matchedId = hit.id;
    b.matchedName = hit.name;
    b.author = hit.card;
    b.year = hit.year;
    b.cover = hit.cover;
    store.set('localBooks', books);
    renderBookList();
  }
  return hit;
}

/** 一键匹配全部书籍 */
export async function matchAllBooks() {
  const books = store.get('localBooks');
  if (!books.length) {
    eventBus.emit('toast', { type: 'info', message: '请先导入书籍' });
    return;
  }
  const need = books.map((b, i) => i).filter((i) => !books[i].matchedId);
  if (!need.length) {
    eventBus.emit('toast', { type: 'info', message: '全部书籍已匹配过了' });
    return;
  }
  const btn = $('bookMatchAllBtn');
  if (btn) { btn.disabled = true; btn.textContent = `匹配中 0/${need.length}`; }
  let ok = 0, fail = 0;
  for (let n = 0; n < need.length; n++) {
    if (btn) btn.textContent = `匹配中 ${n + 1}/${need.length}`;
    try {
      const hit = await matchBook(need[n]);
      if (hit) ok++; else fail++;
    } catch (e) { fail++; }
    await sleep(280);
  }
  if (btn) { btn.disabled = false; btn.textContent = '☁ 匹配线上信息'; }
  eventBus.emit('toast', {
    type: fail ? 'info' : 'success',
    message: `匹配完成：成功 ${ok} 本` + (fail ? `，${fail} 本未找到` : '')
  });
}

export function renderBookList() {
  const el = $('bookList');
  const books = store.get('localBooks');
  if (!books.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="big-icon"><svg style="width:48px;height:48px"><use href="#i-book"/></svg></div>
        <p>还没有导入书籍</p>
        <button class="btn btn-primary" onclick="document.getElementById('bookFileInput').click()">选择 TXT / Markdown 文件</button>
      </div>`;
    return;
  }
  let html = '<div class="song-list-header"><span>#</span><span></span><span>书名</span><span>作者 / 信息</span><span style="text-align:right">大小</span><span>操作</span></div>';
  books.forEach((b, i) => {
    const coverHtml = b.cover
      ? `<img class="s-cover" src="${b.cover}" alt="" loading="lazy" referrerpolicy="no-referrer" style="object-fit:cover;">`
      : `<div class="s-cover" style="background:var(--hover);display:flex;align-items:center;justify-content:center;"><svg style="width:16px;height:16px;color:var(--text2)"><use href="#i-book"/></svg></div>`;
    const matched = !!b.matchedId;
    const sub = matched
      ? `${escapeName(b.author || '')}${b.year ? ' · ' + b.year : ''}`
      : escapeName(b.ext);
    const matchBtn = matched
      ? `<button class="row-ok" data-match="${i}" title="已匹配：${escapeName(b.matchedName || b.name)}（点击重新匹配）" aria-label="重新匹配"><svg><use href="#i-check"/></svg></button>`
      : `<button class="row-match" data-match="${i}" title="联网匹配书名/作者/封面" aria-label="匹配线上信息"><svg><use href="#i-cloud"/></svg></button>`;
    html += `<div class="song-row ${matched ? 'matched' : ''}" data-idx="${i}" title="点击阅读">
      <span class="idx">${i + 1}</span>
      <span>${coverHtml}</span>
      <span class="s-name">${escapeName(b.name)}<span class="row-tag">${escapeName(b.ext)}</span></span>
      <span class="s-artist">${sub}</span>
      <span class="s-dur">${formatSize(b.size)}</span>
      <span class="s-platform">本地
        ${matchBtn}
        <button class="row-del" data-del="${i}" title="从列表中移除" aria-label="移除"><svg><use href="#i-trash"/></svg></button>
      </span>
    </div>`;
  });
  el.innerHTML = html;
  bindCoverFallback(el, '#i-book');
  el.querySelectorAll('.song-row').forEach((row) =>
    row.addEventListener('click', () => openReader(+row.dataset.idx))
  );
  el.querySelectorAll('.row-del').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeBook(+btn.dataset.del);
    })
  );
  el.querySelectorAll('.row-match, .row-ok').forEach((btn) =>
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const idx = +btn.dataset.match;
      btn.classList.add('loading');
      const hit = await matchBook(idx);
      if (!hit) eventBus.emit('toast', { type: 'info', message: '未找到对应的书籍信息' });
      else eventBus.emit('toast', { type: 'success', message: `已匹配：${hit.name}` });
    })
  );
}

/** 从书籍列表移除指定项 */
export function removeBook(idx) {
  const books = store.get('localBooks');
  if (idx < 0 || idx >= books.length) return;
  books.splice(idx, 1);
  store.set('localBooks', books);
  renderBookList();
}

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

/** 打开阅读器 */
export function openReader(idx) {
  const b = store.get('localBooks')[idx];
  if (!b) return;
  const title = b.matchedName || b.name;
  $('bookReaderTitle').textContent = title + (b.author ? ' · ' + b.author : '') + ' (' + b.ext + ')';
  $('bookReader').style.display = 'flex';
  $('bookContent').innerHTML = '<div style="padding:40px;color:var(--text-2)">加载中…</div>';
  const reader = new FileReader();
  reader.onload = () => {
    bookContent = String(reader.result || '');
    renderContent();
  };
  reader.onerror = () => {
    $('bookContent').innerHTML = '<div style="padding:40px;color:var(--error)">文件读取失败（可能是编码不支持）</div>';
  };
  reader.readAsText(b.file, 'utf-8');
}

function renderContent() {
  const content = $('bookContent');
  // 简单分段：按空行切段，保留换行
  const paras = bookContent.split(/\r?\n\s*\r?\n/);
  content.innerHTML = paras.map((p) => {
    const text = p.trim();
    if (!text) return '';
    // 安全转义，同时保留单行换行
    return `<p>${escapeName(text).replace(/\n/g, '<br>')}</p>`;
  }).join('');
  content.scrollTop = 0;
}

function setFont(size) {
  bookFont = Math.max(12, Math.min(32, size));
  $('bookContent').style.fontSize = bookFont + 'px';
  $('bookContent').style.lineHeight = '1.9';
  $('bookFontSize').textContent = bookFont + 'px';
}

/** 关闭阅读器 */
export function closeReader() {
  $('bookReader').style.display = 'none';
  $('bookContent').innerHTML = '';
}

export default { initBook, renderBookList, openReader, closeReader, removeBook, matchBook, matchAllBooks };
