/**
 * book.js — 书籍阅读器模块
 * 职责：TXT/Markdown 文档导入、列表、阅读面板（字号调节、滚动）。
 */
import { store } from './store.js';

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
      file: f
    }));
    store.set('localBooks', [...store.get('localBooks'), ...books]);
    renderBookList();
    e.target.value = '';
  });

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
  let html = '<div class="song-list-header"><span>#</span><span></span><span>书名</span><span>格式</span><span style="text-align:right">大小</span><span></span></div>';
  books.forEach((b, i) => {
    html += `<div class="song-row" data-idx="${i}" title="点击阅读">
      <span class="idx">${i + 1}</span>
      <span><div class="s-cover" style="background:var(--hover);display:flex;align-items:center;justify-content:center;"><svg style="width:16px;height:16px;color:var(--text2)"><use href="#i-book"/></svg></div></span>
      <span class="s-name">${escapeName(b.name)}</span>
      <span class="s-artist">${escapeName(b.ext)}</span>
      <span class="s-dur">${formatSize(b.size)}</span>
      <span class="s-platform">本地<button class="row-del" data-del="${i}" title="从列表中移除" aria-label="移除"><svg><use href="#i-trash"/></svg></button></span>
    </div>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('.song-row').forEach((row) =>
    row.addEventListener('click', () => openReader(+row.dataset.idx))
  );
  el.querySelectorAll('.row-del').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeBook(+btn.dataset.del);
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
  $('bookReaderTitle').textContent = b.name + ' (' + b.ext + ')';
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

export default { initBook, renderBookList, openReader, closeReader, removeBook };
