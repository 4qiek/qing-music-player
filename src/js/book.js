/**
 * book.js — 本地书籍
 *  1. 书库列表：导入 / 移除 / 豆瓣在线匹配（书名、作者、封面）
 *  2. 阅读器：支持 TXT / MD / EPUB
 *     - 自动解析章节目录、上一章/下一章
 *     - 阅读进度记忆、书签
 *     - 字号 / 行距 / 护眼底色（米白/白/护眼绿/夜间）
 */
import { store } from './store.js';
import { eventBus } from './eventBus.js';
import { toast } from './ui.js';
import { apiClient } from './apiClient.js';
import { fetchMatch, bindCoverFallback, cleanBookKeyword } from './metaMatch.js';
import { saveProgress, getProgress, getReaderSettings, saveReaderSettings } from './persistence.js';

const $ = (id) => document.getElementById(id);
const BOOK_EXTS = ['txt', 'md', 'markdown', 'epub'];

function esc(s) { return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function fmtSize(bytes) {
  if (!bytes) return '';
  const kb = bytes / 1024;
  return kb >= 1024 ? (kb / 1024).toFixed(2) + ' MB' : kb.toFixed(0) + ' KB';
}
function bookName(it) { return it.matchedName || (it.name || '').replace(/\.[^.]+$/, ''); }
function bookKey(it) { return it.path || it.name; }

// ============ 列表 ============
function rowHtml(it) {
  const cover = it.cover
    ? `<img class="s-cover book-cover" src="${it.cover}" referrerpolicy="no-referrer" loading="lazy" alt="">`
    : `<span class="s-cover s-cover-ph"><svg style="width:19px;height:19px"><use href="#i-book"/></svg></span>`;
  const matched = !!(it.matchedId || it.matchedName);
  const info = [it.author, it.year].filter(Boolean).join(' · ');
  return `<div class="song-row book-row" data-key="${esc(bookKey(it))}">
    ${cover}
    <span class="s-index">${(it.ext || '').toUpperCase()}</span>
    <span class="s-name" title="${esc(bookName(it))}">${esc(bookName(it))}</span>
    <span class="s-artist" title="${esc(info)}">${esc(info)}</span>
    <span class="s-platform">${fmtSize(it.size)}</span>
    <span class="s-actions">
      <button class="row-match ${matched ? 'row-ok' : ''}" title="${matched ? '重新匹配' : '匹配书籍信息'}">${matched ? '<svg style="width:13px;height:13px"><use href="#i-check"/></svg>' : '☁'}</button>
      <button class="row-del" title="移除"><svg style="width:13px;height:13px"><use href="#i-trash"/></svg></button>
    </span>
  </div>`;
}

function renderBookList() {
  const list = $('bookList');
  if (!list) return;
  const books = store.get('localBooks') || [];
  const sub = $('bookSub');
  if (sub) sub.textContent = books.length ? `共 ${books.length} 本书` : '导入 TXT / Markdown / EPUB，或选择文件夹自动扫描';
  if (!books.length) {
    list.innerHTML = '<div class="empty-state"><div class="big-icon"><svg style="width:48px;height:48px"><use href="#i-book"/></svg></div><p>还没有导入书籍</p><p class="sub-hint">点击「导入书籍」或「添加文件夹」</p></div>';
    return;
  }
  let html = '<div class="song-list-header"><span></span><span></span><span>书名</span><span>作者/年份</span><span>大小</span><span>操作</span></div>';
  books.forEach((it) => { html += rowHtml(it); });
  list.innerHTML = html;
  bindCoverFallback(list, '#i-book');
  list.querySelectorAll('.book-row').forEach((row) => {
    row.querySelector('.s-name').addEventListener('click', () => {
      const it = findByKey(row.dataset.key);
      if (it) openBook(it);
    });
    row.addEventListener('dblclick', () => { const it = findByKey(row.dataset.key); if (it) openBook(it); });
    row.querySelector('.row-match').addEventListener('click', async (e) => {
      e.stopPropagation();
      const it = findByKey(row.dataset.key);
      if (!it) return;
      const btn = row.querySelector('.row-match');
      btn.textContent = '…';
      const m = await fetchMatch(apiClient, cleanBookKeyword(it.matchedName || it.name), 'book');
      if (m) { it.matchedId = m.id; it.matchedName = m.name; it.author = m.card || it.author; it.year = m.year || it.year; it.cover = m.cover || it.cover; renderBookList(); toast({ type: 'success', message: '已匹配：' + m.name }); }
      else { btn.textContent = '☁'; toast({ type: 'error', message: '未找到匹配结果' }); }
    });
    row.querySelector('.row-del').addEventListener('click', (e) => {
      e.stopPropagation();
      removeBook(findByKey(row.dataset.key));
    });
  });
}
function findByKey(key) {
  return (store.get('localBooks') || []).find((b) => bookKey(b) === key);
}
function removeBook(it) {
  if (!it) return;
  store.set('localBooks', (store.get('localBooks') || []).filter((b) => b !== it));
  renderBookList();
}
async function matchAllBooks() {
  const books = store.get('localBooks') || [];
  const todo = books.filter((b) => !b.matchedName);
  if (!todo.length) { toast({ type: 'info', message: '都已匹配过了' }); return; }
  const btn = $('bookMatchAllBtn');
  let ok = 0;
  for (let i = 0; i < todo.length; i++) {
    if (btn) btn.textContent = `匹配中 ${i + 1}/${todo.length}`;
    const m = await fetchMatch(apiClient, cleanBookKeyword(todo[i].matchedName || todo[i].name), 'book');
    if (m) { todo[i].matchedId = m.id; todo[i].matchedName = m.name; todo[i].author = m.card || ''; todo[i].year = m.year || ''; todo[i].cover = m.cover || todo[i].cover; ok++; }
    await new Promise((r) => setTimeout(r, 280));
  }
  if (btn) btn.textContent = '☁ 匹配线上信息';
  renderBookList();
  toast({ type: 'success', message: `匹配完成，成功 ${ok}/${todo.length}` });
}

// ============ 文本 / EPUB 读取 ============
async function readItemBuffer(it) {
  if (it.origin === 'path' && it.path && window.qingAPI.fsReadBuffer) return window.qingAPI.fsReadBuffer(it.path);
  if (it.file) return it.file.arrayBuffer();
  return null;
}

/** TXT 章节切分：返回 [{title, text}] */
function splitTxtChapters(text) {
  const lines = text.split(/\r?\n/);
  const head = /^\s*(第\s*[\d一二三四五六七八九十百千零两]+\s*[章回节卷篇部][^\n]{0,30}|卷\s*[\d一二三四五六七八九十]+\s*[^\n]{0,20}|Chapter\s+\d+[^\n]{0,30}|序章|序言|前言|楔子|尾声|后记)\s*$/i;
  const marks = [];
  lines.forEach((ln, i) => { if (head.test(ln)) marks.push({ i, title: ln.trim() }); });
  if (marks.length < 2) return [{ title: '全文', text }];
  const chapters = [];
  for (let c = 0; c < marks.length; c++) {
    const start = marks[c].i;
    const end = c + 1 < marks.length ? marks[c + 1].i : lines.length;
    chapters.push({ title: marks[c].title, text: lines.slice(start + 1, end).join('\n').trim() });
  }
  // 第一章之前的内容作为开头
  if (marks[0].i > 0) {
    const pre = lines.slice(0, marks[0].i).join('\n').trim();
    if (pre) chapters.unshift({ title: '开篇', text: pre });
  }
  return chapters;
}

function htmlToBlocks(html) {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const body = doc.body || doc;
    const blocks = [];
    const walk = (node) => {
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) { const t = n.textContent.trim(); if (t) blocks.push(esc(t)); }
        else if (n.nodeType === 1) {
          const tag = n.tagName.toLowerCase();
          if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'li', 'blockquote', 'tr'].includes(tag)) {
            const t = n.textContent.trim();
            if (t) blocks.push('<p>' + esc(t) + '</p>');
          } else if (['br', 'hr'].includes(tag)) blocks.push('');
          else walk(n);
        }
      });
    };
    walk(body);
    return blocks.filter((b, i, a) => b || (a[i - 1])).join('\n').replace(/\n/g, '');
  } catch (e) {
    return '<p>' + esc(html.replace(/<[^>]+>/g, ' ')) + '</p>';
  }
}

async function parseEpub(buffer) {
  if (!window.JSZip) throw new Error('EPUB 组件未加载');
  const zip = await window.JSZip.loadAsync(buffer);
  // container → opf 路径
  const container = await zip.file('META-INF/container.xml').async('string');
  const opfPath = (container.match(/full-path="([^"]+)"/) || [])[1];
  if (!opfPath) throw new Error('EPUB 结构异常');
  const opf = await zip.file(opfPath).async('string');
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  // manifest: id → href
  const manifest = {};
  const itemRe = /<item\b[^>]*>/gi;
  let m;
  while ((m = itemRe.exec(opf))) {
    const tag = m[0];
    const id = (tag.match(/id="([^"]+)"/) || [])[1];
    const href = (tag.match(/href="([^"]+)"/) || [])[1];
    if (id && href) manifest[id] = opfDir + href;
  }
  // spine 顺序
  const spine = [];
  const refRe = /<itemref\b[^>]*idref="([^"]+)"/gi;
  while ((m = refRe.exec(opf))) { if (manifest[m[1]]) spine.push(manifest[m[1]]); }
  const chapters = [];
  for (let i = 0; i < spine.length; i++) {
    const f = zip.file(spine[i]);
    if (!f) continue;
    const html = await f.async('string');
    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]
      || (html.match(/<h[1-3][^>]*>([^<]*)<\/h[1-3]>/i) || [])[1]
      || ('第 ' + (i + 1) + ' 节');
    chapters.push({ title: title.trim() || ('第 ' + (i + 1) + ' 节'), text: '__HTML__' + htmlToBlocks(html) });
  }
  if (!chapters.length) throw new Error('EPUB 无正文章节');
  return chapters;
}

// ============ 阅读器 ============
let reader = null;

export async function openBook(it) {
  $('bookReader').style.display = 'flex';
  $('bookReaderTitle').textContent = bookName(it);
  $('bookContent').innerHTML = '<div class="br-loading">正在打开…</div>';
  let chapters;
  try {
    const ext = (it.ext || '').toLowerCase();
    if (ext === 'epub') {
      const buf = await readItemBuffer(it);
      chapters = await parseEpub(buf);
    } else {
      let text = '';
      if (it.origin === 'path' && it.path && window.qingAPI.fsReadText) {
        const r = await window.qingAPI.fsReadText(it.path);
        text = r.text || '';
      } else if (it.file) {
        text = await it.file.text();
      }
      if (!text) throw new Error('读取失败');
      chapters = splitTxtChapters(text);
    }
  } catch (e) {
    $('bookContent').innerHTML = '<div class="br-loading">打开失败：' + esc(e.message) + '</div>';
    return;
  }
  const settings = getReaderSettings();
  reader = {
    item: it, key: bookKey(it), chapters, idx: 0,
    settings, drawerTab: 'toc', scrollPos: 0
  };
  applyReaderSettings();
  // 恢复进度
  const prog = getProgress('book', reader.key);
  reader.idx = (prog && prog.idx >= 0 && prog.idx < chapters.length) ? prog.idx : 0;
  showChapter(reader.idx, prog ? prog.pos : 0);
}

function closeBook() {
  persistBookProgress();
  $('bookReader').style.display = 'none';
  reader = null;
}

function showChapter(idx, restorePos) {
  if (!reader) return;
  reader.idx = Math.max(0, Math.min(reader.chapters.length - 1, idx));
  const ch = reader.chapters[reader.idx];
  const content = $('bookContent');
  content.innerHTML = ch.text.startsWith('__HTML__')
    ? '<h2 class="br-h2">' + esc(ch.title) + '</h2>' + ch.text.slice(8)
    : '<h2 class="br-h2">' + esc(ch.title) + '</h2>' + String(ch.text || '').split(/\n+/).map((p) => p.trim() ? '<p>' + esc(p) + '</p>' : '').join('');
  $('brChapterTitle').textContent = `${reader.idx + 1}/${reader.chapters.length} · ${ch.title}`;
  content.scrollTop = restorePos ? restorePos * content.scrollHeight : 0;
  if ($('#brDrawer').style.display !== 'none') renderDrawer();
  persistBookProgress();
}

function persistBookProgress() {
  if (!reader) return;
  const c = $('bookContent');
  const pos = c.scrollHeight ? c.scrollTop / c.scrollHeight : 0;
  saveProgress('book', reader.key, { idx: reader.idx, pos, title: reader.chapters[reader.idx].title });
}

function applyReaderSettings() {
  if (!reader) return;
  const s = reader.settings;
  const c = $('bookContent');
  c.style.fontSize = s.fontSize + 'px';
  c.style.lineHeight = s.lineHeight;
  c.dataset.bg = s.bg;
  $('bookFontSize').textContent = s.fontSize;
}

function changeFont(delta) {
  if (!reader) return;
  reader.settings.fontSize = Math.max(14, Math.min(30, reader.settings.fontSize + delta));
  saveReaderSettings(reader.settings);
  applyReaderSettings();
}
function cycleLine() {
  if (!reader) return;
  const seq = [1.6, 1.9, 2.2, 2.5];
  const cur = seq.indexOf(Number(reader.settings.lineHeight));
  reader.settings.lineHeight = seq[(cur + 1) % seq.length];
  saveReaderSettings(reader.settings);
  applyReaderSettings();
  toast({ message: '行距 ' + reader.settings.lineHeight });
}
function cycleBg() {
  if (!reader) return;
  const seq = ['paper', 'white', 'green', 'dark'];
  const cur = seq.indexOf(reader.settings.bg);
  reader.settings.bg = seq[(cur + 1) % seq.length];
  saveReaderSettings(reader.settings);
  applyReaderSettings();
  toast({ message: '底色：' + ({ paper: '米白', white: '纯白', green: '护眼绿', dark: '夜间' }[reader.settings.bg]) });
}

// ===== 目录 / 书签抽屉 =====
function toggleDrawer(tab) {
  const drawer = $('brDrawer');
  const show = drawer.style.display === 'none';
  drawer.style.display = show ? 'block' : 'none';
  if (show) {
    if (tab) reader.drawerTab = tab;
    drawer.querySelectorAll('.br-drawer-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === reader.drawerTab));
    renderDrawer();
  }
}
function renderDrawer() {
  if (!reader) return;
  const list = $('brDrawerList');
  if (reader.drawerTab === 'toc') {
    list.innerHTML = reader.chapters.map((c, i) =>
      `<div class="br-toc-item ${i === reader.idx ? 'on' : ''}" data-i="${i}">${esc(c.title)}</div>`).join('');
    list.querySelectorAll('.br-toc-item').forEach((el) => el.addEventListener('click', () => {
      showChapter(+el.dataset.i, 0);
    }));
  } else {
    const s = getReaderSettings();
    const marks = (s.bookmarks && s.bookmarks[reader.key]) || [];
    list.innerHTML = marks.length
      ? marks.map((mk, i) => `<div class="br-mark-item" data-i="${i}"><span>${esc(mk.label)}</span><button data-del="${i}" title="删除书签">×</button></div>`).join('')
      : '<p class="br-empty">还没有书签，点顶部书签图标添加</p>';
    list.querySelectorAll('.br-mark-item').forEach((el) => el.addEventListener('click', (e) => {
      if (e.target.dataset.del != null) {
        e.stopPropagation();
        const st = getReaderSettings();
        st.bookmarks[reader.key].splice(+e.target.dataset.del, 1);
        saveReaderSettings(st); reader.settings = st; renderDrawer();
        return;
      }
      const st = getReaderSettings();
      const mk = st.bookmarks[reader.key][+el.dataset.i];
      if (mk) showChapter(mk.idx, mk.pos);
    }));
  }
}
function addBookmark() {
  if (!reader) return;
  const st = getReaderSettings();
  if (!st.bookmarks) st.bookmarks = {};
  if (!st.bookmarks[reader.key]) st.bookmarks[reader.key] = [];
  const c = $('bookContent');
  const pos = c.scrollHeight ? c.scrollTop / c.scrollHeight : 0;
  st.bookmarks[reader.key].unshift({
    idx: reader.idx, pos,
    label: reader.chapters[reader.idx].title + ' · ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  });
  saveReaderSettings(st); reader.settings = st;
  toast({ type: 'success', message: '已添加书签' });
  reader.drawerTab = 'mark';
  toggleDrawer('mark');
}

let bound = false;
function bindReader() {
  if (bound) return;
  bound = true;
  $('bookReaderClose').addEventListener('click', closeBook);
  $('bookFontDown').addEventListener('click', () => changeFont(-1));
  $('bookFontUp').addEventListener('click', () => changeFont(1));
  $('brLineBtn').addEventListener('click', cycleLine);
  $('brBgBtn').addEventListener('click', cycleBg);
  $('brPrevCh').addEventListener('click', () => reader && showChapter(reader.idx - 1));
  $('brNextCh').addEventListener('click', () => reader && showChapter(reader.idx + 1));
  $('brTocBtn').addEventListener('click', () => { if (reader) { reader.drawerTab = 'toc'; toggleDrawer('toc'); } });
  $('brMarkBtn').addEventListener('click', addBookmark);
  document.querySelectorAll('.br-drawer-tabs button').forEach((b) => b.addEventListener('click', () => {
    reader.drawerTab = b.dataset.tab;
    document.querySelectorAll('.br-drawer-tabs button').forEach((x) => x.classList.toggle('on', x === b));
    renderDrawer();
  }));
  let scrollTimer = null;
  $('bookContent').addEventListener('scroll', () => {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(persistBookProgress, 500);
  });
  // 阅读器快捷键
  document.addEventListener('keydown', (e) => {
    if (!reader || $('bookReader').style.display === 'none') return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'Escape') { closeBook(); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); showChapter(reader.idx - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); showChapter(reader.idx + 1); }
  }, true);
}

// ============ 初始化 ============
export function initBook() {
  bindReader();
  eventBus.on('library:changed', ({ kind }) => { if (kind === 'book' && store.get('view') === 'book') renderBookList(); });
  document.addEventListener('view:book', renderBookList);
  const imp = $('bookImportBtn');
  if (imp) imp.addEventListener('click', () => $('bookFileInput').click());
  $('bookFileInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    await importBookFiles(files);
    e.target.value = '';
  });
  const all = $('bookMatchAllBtn');
  if (all) all.addEventListener('click', matchAllBooks);
  renderBookList();
}

async function importBookFiles(files) {
  if (!files.length) return;
  const list = store.get('localBooks') || [];
  const exist = new Set(list.map((b) => (b.path || b.name) + '|' + (b.size || 0)));
  let added = 0;
  for (const f of files) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (!BOOK_EXTS.includes(ext)) continue;
    const key = f.name + '|' + f.size;
    if (exist.has(key)) continue;
    exist.add(key);
    list.push({
      origin: 'file', file: f, url: URL.createObjectURL(f), name: f.name, ext, size: f.size,
      author: '', year: '', cover: '', matchedId: null, matchedName: ''
    });
    added++;
  }
  store.set('localBooks', list);
  renderBookList();
  toast({ type: added ? 'success' : 'info', message: added ? `已导入 ${added} 本书` : '书籍已在库中' });
}

export default { initBook, openBook, renderBookList, removeBook };
