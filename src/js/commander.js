/**
 * commander.js — 全局命令面板（Ctrl+K / Ctrl+L 唤起）
 * 一处搜索：功能页切换、本地音乐/视频/书籍、收藏、常用命令、在线搜索跳转。
 * 键盘：↑↓ 选择，Enter 执行，Esc 关闭。
 */
import { store } from './store.js';
import { switchView } from './view.js';
import { playQueueIndex } from './player.js';
import { toast } from './ui.js';

let panel = null;
let input = null;
let listEl = null;
let items = [];
let active = 0;

function buildCandidates(query) {
  const q = query.trim().toLowerCase();
  const out = [];

  // 1) 功能页 / 应用导航
  const navs = [
    { app: 'music', view: 'local', label: '本地音乐', icon: '#i-home' },
    { app: 'music', view: 'search', label: '在线搜索', icon: '#i-search' },
    { app: 'music', view: 'toplist', label: '排行榜', icon: '#i-trend' },
    { app: 'music', view: 'recommend', label: '每日推荐', icon: '#i-spark' },
    { app: 'music', view: 'favorites', label: '我的收藏', icon: '#i-heart' },
    { app: 'music', view: 'history', label: '播放历史', icon: '#i-clock' },
    { app: 'video', view: 'video', label: '视频', icon: '#i-video' },
    { app: 'image', view: 'image', label: '图片', icon: '#i-image' },
    { app: 'book', view: 'book', label: '书籍', icon: '#i-book' },
    { app: 'browser', label: '浏览器', icon: '#i-globe' }
  ];
  navs.forEach((n) => {
    if (!q || n.label.toLowerCase().includes(q)) {
      out.push({ type: 'nav', icon: n.icon, label: n.label, hint: '跳转', run: () => gotoApp(n) });
    }
  });

  // 2) 本地音乐
  (store.get('localTracks') || []).forEach((t, i) => {
    const name = t.matchedName || t.name;
    if (!q || name.toLowerCase().includes(q) || (t.artist || '').toLowerCase().includes(q)) {
      out.push({
        type: 'music', icon: '#i-music', label: name.replace(/\.[^.]+$/, ''), hint: t.artist || '本地音乐',
        run: () => { store.set('currentQueue', [...store.get('localTracks')]); playQueueIndex(i); }
      });
    }
  });

  // 3) 收藏
  (store.get('favorites') || []).forEach((t, i) => {
    if (!q || (t.name || '').toLowerCase().includes(q) || (t.artist || '').toLowerCase().includes(q)) {
      out.push({
        type: 'fav', icon: '#i-heart', label: t.name, hint: t.artist || '收藏',
        run: () => { store.set('currentQueue', [...store.get('favorites')]); playQueueIndex(i); }
      });
    }
  });

  // 4) 本地视频
  (store.get('localVideos') || []).forEach((t, i, arr) => {
    const name = t.matchedName || t.name;
    if (!q || name.toLowerCase().includes(q)) {
      out.push({
        type: 'video', icon: '#i-video', label: name.replace(/\.[^.]+$/, ''), hint: '本地视频',
        run: () => { gotoApp({ app: 'video', view: 'video' }); import('./video.js').then((m) => m.openVideo(t, arr, i)); }
      });
    }
  });

  // 5) 本地书籍
  (store.get('localBooks') || []).forEach((t) => {
    const name = t.matchedName || t.name;
    if (!q || name.toLowerCase().includes(q)) {
      out.push({
        type: 'book', icon: '#i-book', label: name.replace(/\.[^.]+$/, ''), hint: t.author || '本地书籍',
        run: () => { gotoApp({ app: 'book', view: 'book' }); import('./book.js').then((m) => m.openBook(t)); }
      });
    }
  });

  // 6) 常用命令
  const cmds = [
    { label: '切换深色 / 浅色主题', icon: '#i-moon', run: () => document.getElementById('themeToggle').click() },
    { label: '切换播放模式', icon: '#i-repeat', run: () => document.getElementById('playModeBtn').click() },
    { label: '新建歌单', icon: '#i-plus', run: () => document.getElementById('newPlaylistBtn').click() }
  ];
  cmds.forEach((c) => { if (!q || c.label.toLowerCase().includes(q)) out.push({ type: 'cmd', icon: c.icon, label: c.label, hint: '命令', run: c.run }); });

  // 7) 在线搜索兜底
  if (q) {
    out.unshift({
      type: 'online', icon: '#i-search', label: `在线搜索「${query.trim()}」`, hint: '网易云/QQ/酷狗',
      run: () => {
        const si = document.getElementById('searchInput');
        si.value = query.trim();
        gotoApp({ app: 'music', view: 'search' });
        import('./search.js').then((m) => m.doSearch());
      }
    });
  }
  return out.slice(0, 30);
}

function gotoApp(n) {
  const appItem = document.querySelector(`.app-item[data-app="${n.app}"]`);
  if (appItem) appItem.click();
  if (n.view) switchView(n.view);
  if (n.app === 'browser') {
    import('./browser.js').then((m) => m.openBrowser());
  }
}

function render() {
  const q = input.value;
  items = buildCandidates(q);
  active = 0;
  if (!items.length) {
    listEl.innerHTML = '<div class="cmd-empty">没有匹配项</div>';
    return;
  }
  listEl.innerHTML = items.map((it, i) => `
    <div class="cmd-item ${i === 0 ? 'on' : ''}" data-i="${i}">
      <svg class="cmd-ic"><use href="${it.icon || '#i-search'}"/></svg>
      <span class="cmd-label">${esc(it.label)}</span>
      <span class="cmd-hint">${esc(it.hint || '')}</span>
    </div>`).join('');
  listEl.querySelectorAll('.cmd-item').forEach((el) => {
    el.addEventListener('mouseenter', () => { active = +el.dataset.i; highlight(); });
    el.addEventListener('click', () => { active = +el.dataset.i; execute(); });
  });
}
function highlight() {
  listEl.querySelectorAll('.cmd-item').forEach((el, i) => el.classList.toggle('on', i === active));
  const cur = listEl.querySelector('.cmd-item.on');
  if (cur) cur.scrollIntoView({ block: 'nearest' });
}
function execute() {
  const it = items[active];
  close();
  if (it && typeof it.run === 'function') {
    try { it.run(); } catch (e) { toast({ type: 'error', message: '无法执行该命令' }); }
  }
}
function esc(s) { return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function open() {
  if (!panel) build();
  panel.classList.add('show');
  input.value = '';
  render();
  setTimeout(() => input.focus(), 30);
}
function close() { if (panel) panel.classList.remove('show'); }
function toggle() { if (!panel) build(); if (panel.classList.contains('show')) close(); else open(); }

function build() {
  panel = document.createElement('div');
  panel.className = 'cmd-palette';
  panel.innerHTML = `
    <div class="cmd-box" role="dialog" aria-label="命令面板">
      <div class="cmd-input-wrap">
        <svg style="width:16px;height:16px"><use href="#i-search"/></svg>
        <input type="text" id="cmdInput" placeholder="搜索功能、本地音乐 / 视频 / 书籍，或输入关键词在线搜…" autocomplete="off">
      </div>
      <div class="cmd-list" id="cmdList"></div>
      <div class="cmd-foot">↑↓ 选择 · Enter 执行 · Esc 关闭 · Ctrl+K 唤起</div>
    </div>`;
  document.body.appendChild(panel);
  input = panel.querySelector('#cmdInput');
  listEl = panel.querySelector('#cmdList');
  panel.addEventListener('click', (e) => { if (e.target === panel) close(); });
  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); highlight(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); highlight(); }
    else if (e.key === 'Enter') { e.preventDefault(); execute(); }
    else if (e.key === 'Escape') close();
  });
}

export function initCommander() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      toggle();
    } else if (e.key === 'Escape' && panel && panel.classList.contains('show')) {
      close();
    }
  });
}

export default { initCommander, open, close };
