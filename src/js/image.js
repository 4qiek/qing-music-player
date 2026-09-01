/**
 * image.js — 图片查看器模块
 * 职责：图片导入、缩略图网格、全屏查看（缩放 + 上一张/下一张）。
 */
import { store } from './store.js';

const $ = (id) => document.getElementById(id);

let viewerIndex = 0;
let viewerZoom = 1;

function escapeName(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function initImage() {
  const fileInput = $('imageFileInput');
  $('imageImportBtn').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const imgs = files.map((f) => ({
      id: 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      name: f.name,
      size: f.size,
      file: f,
      url: URL.createObjectURL(f)
    }));
    store.set('localImages', [...store.get('localImages'), ...imgs]);
    renderImageGrid();
    e.target.value = '';
  });

  // 查看器交互
  $('imageViewerClose').addEventListener('click', closeViewer);
  $('imageZoomIn').addEventListener('click', () => setZoom(viewerZoom + 0.25));
  $('imageZoomOut').addEventListener('click', () => setZoom(viewerZoom - 0.25));
  $('imageViewerPrev').addEventListener('click', () => navViewer(-1));
  $('imageViewerNext').addEventListener('click', () => navViewer(1));

  document.addEventListener('keydown', (e) => {
    if ($('imageViewer').style.display === 'none') return;
    if (e.key === 'Escape') closeViewer();
    else if (e.key === 'ArrowLeft') navViewer(-1);
    else if (e.key === 'ArrowRight') navViewer(1);
    else if (e.key === '+' || e.key === '=') setZoom(viewerZoom + 0.25);
    else if (e.key === '-') setZoom(viewerZoom - 0.25);
  });
}

export function renderImageGrid() {
  const grid = $('imageGrid');
  const imgs = store.get('localImages');
  if (!imgs.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="big-icon"><svg style="width:48px;height:48px"><use href="#i-image"/></svg></div>
        <p>还没有导入图片</p>
        <button class="btn btn-primary" onclick="document.getElementById('imageFileInput').click()">选择本地图片</button>
      </div>`;
    return;
  }
  grid.innerHTML = imgs.map((img, i) => `
    <div class="img-cell" data-idx="${i}" title="${escapeName(img.name)}">
      <img src="${img.url}" alt="${escapeName(img.name)}" loading="lazy">
      <div class="img-name">${escapeName(img.name)}</div>
    </div>`).join('');
  grid.querySelectorAll('.img-cell').forEach((cell) =>
    cell.addEventListener('click', () => openViewer(+cell.dataset.idx))
  );
}

/** 打开全屏查看 */
export function openViewer(idx) {
  const imgs = store.get('localImages');
  if (!imgs.length) return;
  viewerIndex = Math.max(0, Math.min(idx, imgs.length - 1));
  viewerZoom = 1;
  $('imageViewer').style.display = 'flex';
  renderViewer();
}

function renderViewer() {
  const imgs = store.get('localImages');
  const img = imgs[viewerIndex];
  if (!img) return;
  $('imageViewerImg').src = img.url;
  $('imageViewerImg').alt = img.name;
  $('imageViewerTitle').textContent = img.name;
  $('imageViewerCount').textContent = (viewerIndex + 1) + ' / ' + imgs.length;
  $('imageViewerImg').style.transform = `scale(${viewerZoom})`;
}

function navViewer(delta) {
  const imgs = store.get('localImages');
  if (!imgs.length) return;
  viewerIndex = (viewerIndex + delta + imgs.length) % imgs.length;
  viewerZoom = 1;
  renderViewer();
}

function setZoom(z) {
  viewerZoom = Math.max(0.25, Math.min(4, z));
  $('imageViewerImg').style.transform = `scale(${viewerZoom})`;
}

/** 关闭全屏查看 */
export function closeViewer() {
  $('imageViewer').style.display = 'none';
  $('imageViewerImg').removeAttribute('src');
}

export default { initImage, renderImageGrid, openViewer, closeViewer };
