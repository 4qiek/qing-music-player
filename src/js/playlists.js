/**
 * playlists.js — 自建歌单
 *  - 多歌单新建 / 重命名(简化为删除重建) / 删除
 *  - 任意歌曲（在线 / 本地）加入歌单，本地与在线可混排
 *  - 侧栏列出歌单，点击进入歌单视图并播放
 *  - 歌单持久化到 localStorage（本地 File 项为会话级，路径项/在线项可长期保留）
 */
import { store } from './store.js';
import { eventBus } from './eventBus.js';
import { toast } from './ui.js';
import { switchView } from './view.js';
import { playQueueIndex, isFavorite, toggleFavorite } from './player.js';

const $ = (id) => document.getElementById(id);
const KEY = 'qing-playlists-v1';

function load() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { list = []; }
  store.set('playlists', list);
  return list;
}
function save(list) {
  // 去掉不可序列化的 File 对象
  const clean = list.map((p) => ({
    id: p.id, name: p.name,
    tracks: (p.tracks || []).map((t) => {
      const c = { ...t };
      delete c.file;
      return c;
    })
  }));
  store.set('playlists', clean);
  try { localStorage.setItem(KEY, JSON.stringify(clean)); } catch (e) { /* ignore */ }
}
function trackKey(t) {
  return t.platform + ':' + (t.id || t.path || t.name);
}

function createPlaylist(name) {
  const list = store.get('playlists') || [];
  const pl = { id: 'pl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), name: name || ('歌单 ' + (list.length + 1)), tracks: [] };
  list.push(pl);
  save(list);
  renderPlaylistNav();
  return pl;
}

function deletePlaylist(id) {
  let list = store.get('playlists') || [];
  list = list.filter((p) => p.id !== id);
  save(list);
  renderPlaylistNav();
}

function addToPlaylist(id, track) {
  const list = store.get('playlists') || [];
  const pl = list.find((p) => p.id === id);
  if (!pl) return false;
  const k = trackKey(track);
  if (pl.tracks.some((t) => trackKey(t) === k)) {
    toast({ type: 'info', message: '这首歌已在「' + pl.name + '」里' });
    return false;
  }
  const c = { ...track };
  delete c.file;
  pl.tracks.push(c);
  save(list);
  toast({ type: 'success', message: `已加入「${pl.name}」` });
  if (store.get('view') === 'playlist' && store.get('openPlaylistId') === id) openPlaylist(id);
  return true;
}

function removeFromPlaylist(id, index) {
  const list = store.get('playlists') || [];
  const pl = list.find((p) => p.id === id);
  if (!pl) return;
  pl.tracks.splice(index, 1);
  save(list);
  openPlaylist(id);
}

// ===== 侧栏 =====
function renderPlaylistNav() {
  const nav = $('playlistNav');
  const section = $('playlistSection');
  if (!nav) return;
  const list = store.get('playlists') || [];
  if (section) section.style.display = list.length ? 'block' : 'none';
  nav.innerHTML = list.map((p) => `
    <div class="nav-item playlist-nav-item" data-pid="${p.id}" role="button" tabindex="0">
      <svg><use href="#i-list"/></svg>
      <span class="pl-nav-name">${esc(p.name)}</span>
      <span class="pl-nav-count">${p.tracks.length}</span>
      <button class="pl-nav-del" data-del="${p.id}" title="删除歌单" aria-label="删除歌单">×</button>
    </div>`).join('');
  nav.querySelectorAll('.playlist-nav-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('pl-nav-del')) return;
      document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
      item.classList.add('active');
      openPlaylist(item.dataset.pid);
    });
  });
  nav.querySelectorAll('.pl-nav-del').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const pl = (store.get('playlists') || []).find((x) => x.id === b.dataset.del);
    if (pl && confirm(`删除歌单「${pl.name}」？歌单内歌曲文件不会被删除`)) deletePlaylist(b.dataset.del);
  }));
}

// ===== 歌单视图 =====
function openPlaylist(id) {
  const list = store.get('playlists') || [];
  const pl = list.find((p) => p.id === id);
  if (!pl) return;
  store.set('openPlaylistId', id);
  switchView('playlist');
  $('playlistTitle').textContent = pl.name;
  $('playlistSub').textContent = `共 ${pl.tracks.length} 首 · 本地与在线可混排`;
  const el = $('playlistList');
  if (!pl.tracks.length) {
    el.innerHTML = '<div class="empty-state"><p>歌单还是空的</p><p class="sub-hint">在歌曲上右键 → 加入歌单</p></div>';
    return;
  }
  let html = '<div class="song-list-header"><span>#</span><span></span><span>标题</span><span>歌手</span><span style="text-align:right">时长</span><span>来源/移除</span></div>';
  pl.tracks.forEach((t, i) => {
    const cover = t.cover
      ? `<img class="s-cover" src="${t.cover}" referrerpolicy="no-referrer" loading="lazy" alt="">`
      : `<span class="s-cover s-cover-ph"><svg style="width:16px;height:16px"><use href="#i-music"/></svg></span>`;
    const label = t.platform === 'local' ? '本地' : ({ netease: '网易', qq: 'QQ', kugou: '酷狗' }[t.platform] || '在线');
    html += `<div class="song-row" data-pidx="${i}">
      <span class="idx">${i + 1}</span><span>${cover}</span>
      <span class="s-name">${esc(t.matchedName || t.name)}</span>
      <span class="s-artist">${esc(t.artist || '未知艺术家')}</span>
      <span class="s-dur">${fmtDur(t.duration)}</span>
      <span class="s-platform">${label}
        <button class="row-del" data-rm="${i}" title="从歌单移除"><svg><use href="#i-trash"/></svg></button>
      </span>
    </div>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('.song-row').forEach((row) => row.addEventListener('click', () => {
    store.set('currentQueue', [...pl.tracks]);
    playQueueIndex(+row.dataset.pidx);
  }));
  el.querySelectorAll('.row-del').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    removeFromPlaylist(id, +b.dataset.rm);
  }));
}

// ===== “加入歌单”浮层 =====
let pendingTrack = null;
function openAddToPlaylist(track) {
  if (!track) { toast({ type: 'info', message: '请先选择一首歌' }); return; }
  pendingTrack = track;
  let modal = document.getElementById('addToPlModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'addToPlModal';
    modal.className = 'modal-mask';
    modal.innerHTML = `
      <div class="modal-card add-pl-card" role="dialog" aria-label="加入歌单">
        <div class="modal-head"><b>加入歌单</b><button class="modal-x" id="addPlClose" aria-label="关闭">×</button></div>
        <div class="add-pl-list" id="addPlList"></div>
        <button class="btn btn-primary" id="addPlNew">＋ 新建歌单并加入</button>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
    $('addPlClose').addEventListener('click', () => modal.classList.remove('show'));
    $('addPlNew').addEventListener('click', () => {
      const name = prompt('新歌单名称：', '我的歌单');
      if (!name || !name.trim()) return;
      const pl = createPlaylist(name.trim());
      if (pendingTrack) addToPlaylist(pl.id, pendingTrack);
      modal.classList.remove('show');
    });
  }
  const listEl = $('addPlList');
  const list = store.get('playlists') || [];
  listEl.innerHTML = list.length
    ? list.map((p) => `<button class="add-pl-item" data-pid="${p.id}"><svg style="width:15px;height:15px"><use href="#i-list"/></svg>${esc(p.name)}<span class="add-pl-n">${p.tracks.length}</span></button>`).join('')
    : '<p class="add-pl-empty">还没有歌单，点下方按钮新建</p>';
  listEl.querySelectorAll('.add-pl-item').forEach((b) => b.addEventListener('click', () => {
    if (pendingTrack) addToPlaylist(b.dataset.pid, pendingTrack);
    modal.classList.remove('show');
  }));
  modal.classList.add('show');
}

// ===== 歌曲行右键菜单（在线/收藏/历史/歌单/本地通用） =====
function trackFromRow(row) {
  // 本地音乐行
  if (row.dataset.type === 'local' || row.closest('#localList')) {
    const idx = +row.dataset.idx;
    return (store.get('localTracks') || [])[idx];
  }
  // 歌单视图行
  if (row.dataset.pidx != null && store.get('view') === 'playlist') {
    const pl = (store.get('playlists') || []).find((p) => p.id === store.get('openPlaylistId'));
    return pl ? pl.tracks[+row.dataset.pidx] : null;
  }
  // 其余列表基于 currentQueue
  const idx = (row.dataset.idx != null) ? +row.dataset.idx : -1;
  const q = store.get('currentQueue') || [];
  return q[idx];
}

function initContextMenu() {
  let menu = null;
  const close = () => { if (menu) menu.remove(); menu = null; };
  document.addEventListener('click', close);
  document.addEventListener('scroll', close, true);
  document.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('.song-row');
    if (!row) return;
    const t = trackFromRow(row);
    if (!t) return;
    e.preventDefault();
    close();
    menu = document.createElement('div');
    menu.className = 'ctx-menu';
    const fav = isFavorite(t);
    menu.innerHTML = `
      <button data-act="play">▶ 播放</button>
      <button data-act="fav">${fav ? '♥ 取消收藏' : '♡ 收藏'}</button>
      <button data-act="addpl">＋ 加入歌单</button>`;
    menu.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 130) + 'px';
    document.body.appendChild(menu);
    menu.addEventListener('click', (ev) => {
      const act = ev.target.dataset.act;
      close();
      if (act === 'play') row.click();
      else if (act === 'fav') toggleFavorite(t);
      else if (act === 'addpl') openAddToPlaylist(t);
    });
  });
}

function esc(s) { return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function fmtDur(d) {
  if (!d || isNaN(d)) return '--:--';
  const m = Math.floor(d / 60), s = Math.floor(d % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export function initPlaylists() {
  load();
  renderPlaylistNav();
  initContextMenu();
  const btn = $('newPlaylistBtn');
  if (btn) btn.addEventListener('click', () => {
    const name = prompt('新歌单名称：', '我的歌单');
    if (name && name.trim()) {
      const pl = createPlaylist(name.trim());
      renderPlaylistNav();
      openPlaylist(pl.id);
    }
  });
  // 视图切走时关闭歌单浮层
  document.addEventListener('view:switched', () => { const m = $('addToPlModal'); if (m) m.classList.remove('show'); });
}

export default {
  initPlaylists, openPlaylist, openAddToPlaylist, createPlaylist, addToPlaylist, renderPlaylistNav
};
