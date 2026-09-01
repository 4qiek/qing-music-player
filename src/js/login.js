/**
 * login.js — 网易云登录与歌单
 * 支持账号密码登录 + 扫码登录（推荐，绕过手机号密码风控）
 */
import { store } from './store.js';
import { escapeHtml } from './utils.js';
import { eventBus } from './eventBus.js';
import { apiClient } from './apiClient.js';
import { renderSongList } from './search.js';
import { switchView } from './view.js';

const $ = (id) => document.getElementById(id);

let qrPollTimer = null;
let qrCurrentKey = '';

export function initLogin() {
  const modal = $('loginModal');

  $('loginBtn').addEventListener('click', () => {
    modal.classList.add('show');
    $('loginError').textContent = '';
    switchLoginTab('account');
  });
  $('loginCancel').addEventListener('click', () => {
    stopQrPoll();
    modal.classList.remove('show');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      stopQrPoll();
      modal.classList.remove('show');
    }
  });

  $('loginSubmit').addEventListener('click', doLogin);

  // 回车提交（仅账号面板）
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && $('loginAccountPanel').style.display !== 'none') doLogin();
  });

  // tab 切换
  document.querySelectorAll('.login-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchLoginTab(tab.dataset.tab));
  });
}

function switchLoginTab(tab) {
  document.querySelectorAll('.login-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  const isQr = tab === 'qr';
  $('loginAccountPanel').style.display = isQr ? 'none' : '';
  $('loginQrPanel').style.display = isQr ? '' : 'none';
  $('loginSubmit').style.display = isQr ? 'none' : '';
  $('loginError').textContent = '';
  if (isQr) startQrLogin();
  else stopQrPoll();
}

async function startQrLogin() {
  stopQrPoll();
  const img = $('loginQrImg');
  const loading = $('loginQrLoading');
  const status = $('loginQrStatus');
  img.style.display = 'none';
  loading.style.display = '';
  status.textContent = '二维码生成中…';

  const keyRes = await apiClient.neteaseQrKey();
  if (keyRes.error || !keyRes.key) {
    loading.style.display = 'none';
    status.textContent = '获取二维码失败：' + (keyRes.error || '未知错误');
    return;
  }
  qrCurrentKey = keyRes.key;

  const qrRes = await apiClient.neteaseQrCreate(qrCurrentKey);
  if (qrRes.error || !qrRes.qrimg) {
    loading.style.display = 'none';
    status.textContent = '生成二维码失败：' + (qrRes.error || '未知错误');
    return;
  }
  img.src = qrRes.qrimg;
  img.style.display = '';
  loading.style.display = 'none';
  status.textContent = '打开网易云音乐 App 扫码登录';

  // 轮询扫码状态（每 2 秒）
  qrPollTimer = setInterval(async () => {
    try {
      const r = await apiClient.neteaseQrCheck(qrCurrentKey);
      if (r.code === 800) {
        status.textContent = '等待扫码…';
      } else if (r.code === 801) {
        status.textContent = '已扫码，请在手机上确认登录';
      } else if (r.code === 802) {
        status.textContent = '已确认，正在登录…';
      } else if (r.code === 803) {
        stopQrPoll();
        status.textContent = '登录成功，正在获取用户信息…';
        await finishQrLogin(r.cookie);
      } else if (r.code === 800 || r.code === 801 || r.code === 802) {
        // 继续轮询
      } else {
        // 二维码过期或其他错误
        stopQrPoll();
        status.textContent = '二维码已过期，点击重新获取';
        img.style.display = 'none';
        loading.style.display = '';
        loading.textContent = '二维码已过期';
        loading.style.cursor = 'pointer';
        loading.onclick = () => { loading.onclick = null; startQrLogin(); };
      }
    } catch (e) {
      // 网络抖动忽略，继续轮询
    }
  }, 2000);
}

async function finishQrLogin(cookie) {
  const userRes = await apiClient.neteaseLoginStatus(cookie);
  if (userRes.success) {
    store.set('userInfo', userRes);
    $('loginModal').classList.remove('show');
    renderUserCard();
    loadUserPlaylists();
    eventBus.emit('toast', { type: 'success', message: `欢迎回来，${userRes.nickname}` });
  } else {
    $('loginQrStatus').textContent = '获取用户信息失败：' + (userRes.error || '未知错误');
  }
}

function stopQrPoll() {
  if (qrPollTimer) {
    clearInterval(qrPollTimer);
    qrPollTimer = null;
  }
  qrCurrentKey = '';
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
    $('loginError').textContent = (res.error || '登录失败') + '（建议改用扫码登录）';
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
      switchLoginTab('account');
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

export default { initLogin, renderUserCard, loadUserPlaylists };
