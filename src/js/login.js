/**
 * login.js — 网易云登录与歌单
 * 负责登录弹窗、用户卡片渲染、我的歌单加载与播放。
 */
import { store } from './store.js';
import { eventBus } from './eventBus.js';
import { apiClient } from './apiClient.js';
import { renderSongList } from './search.js';
import { switchView } from './view.js';

const $ = (id) => document.getElementById(id);

export function initLogin() {
  const modal = $('loginModal');

  $('loginBtn').addEventListener('click', () => {
    modal.classList.add('show');
    $('loginError').textContent = '';
  });
  $('loginCancel').addEventListener('click', () => modal.classList.remove('show'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('show');
  });

  $('loginSubmit').addEventListener('click', doLogin);

  // 回车提交
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });
}

async function doLogin() {
  const phone = $('loginPhone').value.trim();
  const password = $('loginPass').value;
  if (!phone || !password) {
    $('loginError').textContent = '请输入手机号和密码';
    return;
  }
  $('loginError').textContent = '登录中...';
  const res = await apiClient.neteaseLogin({ phone, password });
  if (res.success) {
    store.set('userInfo', res);
    $('loginModal').classList.remove('show');
    renderUserCard();
    loadUserPlaylists();
    eventBus.emit('toast', { type: 'success', message: `欢迎回来，${res.nickname}` });
  } else {
    $('loginError').textContent = res.error || '登录失败';
  }
}

export function renderUserCard() {
  const card = $('userCard');
  const userInfo = store.get('userInfo');
  if (userInfo) {
    card.innerHTML = `<div class="user-info">
      <div class="avatar">${userInfo.avatar ? `<img src="${userInfo.avatar}" alt="">` : '<svg><use href="#i-music"/></svg>'}</div>
      <div><div class="uname">${escapeHtml(userInfo.nickname)}</div><div class="logout" id="logoutBtn">退出登录</div></div>
    </div>`;
    $('logoutBtn').addEventListener('click', () => {
      store.set('userInfo', null);
      $('playlistSection').style.display = 'none';
      $('playlistNav').innerHTML = '';
      renderUserCard();
    });
  } else {
    card.innerHTML = '<button class="login-btn" id="loginBtn">登录网易云账号</button>';
    $('loginBtn').addEventListener('click', () => {
      $('loginModal').classList.add('show');
      $('loginError').textContent = '';
    });
  }
}

export async function loadUserPlaylists() {
  const userInfo = store.get('userInfo');
  if (!userInfo) return;
  const playlists = await apiClient.neteasePlaylist(userInfo.userId);
  if (!playlists || playlists.error) return;
  $('playlistSection').style.display = 'block';
  const nav = $('playlistNav');
  nav.innerHTML = '';
  playlists.forEach((p) => {
    const item = document.createElement('div');
    item.className = 'nav-item';
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.innerHTML = `<svg><use href="#i-music"/></svg> ${escapeHtml(p.name.length > 8 ? p.name.slice(0, 8) + '...' : p.name)} <span class="badge">${p.count}</span>`;
    const open = async () => {
      document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
      item.classList.add('active');
      switchView('playlist');
      $('playlistTitle').textContent = p.name;
      $('playlistSub').textContent = `${p.count} 首歌曲`;
      $('playlistList').innerHTML = '<div class="loading">加载歌单中</div>';
      const tracks = await apiClient.neteasePlaylistDetail(p.id);
      if (!tracks || tracks.error) {
        $('playlistList').innerHTML = '<div class="empty-state"><p>加载失败</p></div>';
        return;
      }
      store.set('searchResults', tracks);
      store.set('currentQueue', tracks);
      renderSongList($('playlistList'), tracks);
    };
    item.addEventListener('click', open);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
    nav.appendChild(item);
  });
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default { initLogin, renderUserCard, loadUserPlaylists };
