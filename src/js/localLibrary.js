/**
 * localLibrary.js — 本地音乐管理
 * 负责本地文件的导入、列表渲染与播放入口。
 */
import { store } from './store.js';
import { playLocal } from './player.js';

const $ = (id) => document.getElementById(id);

const PLATFORM_LABEL = { netease: '网易', qq: 'QQ', kugou: '酷狗', local: '本地' };

/** 绑定导入控件事件 */
export function initLocalLibrary() {
  const fileInput = $('fileInput');
  $('importBtn').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    const tracks = files.map((f) => ({
      id: 'local_' + Date.now() + '_' + Math.random(),
      name: f.name.replace(/\.[^.]+$/, ''),
      artist: '本地文件',
      album: '',
      cover: '',
      duration: 0,
      platform: 'local',
      file: f,
      url: URL.createObjectURL(f)
    }));
    store.set('localTracks', [...store.get('localTracks'), ...tracks]);
    renderLocalList();
    e.target.value = '';
  });
}

/** 渲染本地列表 */
export function renderLocalList() {
  const el = $('localList');
  const localTracks = store.get('localTracks');
  if (localTracks.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="big-icon"><svg style="width:48px;height:48px"><use href="#i-music"/></svg></div>
        <p>还没有导入音乐</p>
        <button class="btn btn-primary" onclick="document.getElementById('fileInput').click()">选择本地文件</button>
      </div>`;
    return;
  }
  let html = '<div class="song-list-header"><span>#</span><span></span><span>标题</span><span>歌手</span><span style="text-align:right">时长</span><span></span></div>';
  localTracks.forEach((t, i) => {
    html += `<div class="song-row" data-type="local" data-idx="${i}">
      <span class="idx">${i + 1}</span>
      <span><div class="s-cover" style="background:var(--hover);display:flex;align-items:center;justify-content:center;"><svg style="width:16px;height:16px;color:var(--text2)"><use href="#i-music"/></svg></div></span>
      <span class="s-name">${escapeName(t.name)}</span>
      <span class="s-artist">${escapeName(t.artist)}</span>
      <span class="s-dur">--:--</span>
      <span class="s-platform">本地</span>
    </div>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('.song-row').forEach((row) =>
    row.addEventListener('click', () => playLocal(+row.dataset.idx))
  );
}

function escapeName(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default { initLocalLibrary, renderLocalList, PLATFORM_LABEL };
