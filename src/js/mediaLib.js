/**
 * mediaLib.js — 统一本地媒体库
 * 职责：
 *  1. 选择文件夹 → 主进程递归扫描 → 按类型入库（走 qing-file:// 流协议，不占内存）
 *  2. 监听文件夹新增文件，自动增量入库
 *  3. 浏览器下载完成后按类型自动归库
 *  4. 读取音频内嵌 ID3 标签（标题/艺术家/专辑/封面/歌词）
 * 入库后通过 eventBus 'library:changed' { kind } 通知各视图刷新。
 */
import { store } from './store.js';
import { eventBus } from './eventBus.js';
import { toast } from './ui.js';

const KIND_KEY = {
  audio: 'localTracks',
  video: 'localVideos',
  image: 'localImages',
  book: 'localBooks'
};
const KIND_LABEL = { audio: '音乐', video: '视频', image: '图片', book: '书籍' };

function itemKey(it) {
  if (it.path) return 'p:' + it.path;
  if (it.file) return 'f:' + it.file.name + '|' + it.file.size;
  return 'n:' + it.name + '|' + (it.size || 0);
}

/** 向对应类型库去重追加，返回新增数量 */
function pushItems(kind, items) {
  const stateKey = KIND_KEY[kind];
  if (!stateKey) return 0;
  const list = store.get(stateKey) || [];
  const exist = new Set(list.map(itemKey));
  let added = 0;
  for (const it of items) {
    it.origin = it.origin || 'path';
    it.kind = kind;
    const k = itemKey(it);
    if (exist.has(k)) continue;
    exist.add(k);
    list.push(it);
    added++;
  }
  if (added) {
    store.set(stateKey, list);
    eventBus.emit('library:changed', { kind: kind, stateKey, added });
  }
  return added;
}

/** 由主进程扫描结果构造统一条目 */
function fileToItem(f) {
  return {
    origin: 'path',
    path: f.path,
    name: f.name,
    ext: f.ext,
    size: f.size,
    url: f.url,
    kind: f.kind,
    artist: '', album: '', cover: '', duration: 0,
    matchedId: null, matchedName: '', embeddedLyric: ''
  };
}

/** 选择文件夹并整库导入 */
export async function scanMediaFolder() {
  if (!window.qingAPI || !window.qingAPI.pickMediaFolder) {
    toast({ type: 'error', message: '当前环境不支持文件夹选择' });
    return null;
  }
  const res = await window.qingAPI.pickMediaFolder();
  if (!res || res.canceled) return null;
  const groups = { audio: [], video: [], image: [], book: [] };
  (res.files || []).forEach((f) => {
    if (groups[f.kind]) groups[f.kind].push(fileToItem(f));
  });
  const stats = {};
  Object.keys(groups).forEach((kind) => {
    stats[kind] = pushItems(kind, groups[kind]);
  });
  // 音频异步补内嵌标签
  groups.audio.forEach((it) => enrichAudio(it));
  const parts = Object.keys(stats)
    .filter((k) => stats[k] > 0)
    .map((k) => `${KIND_LABEL[k]} ${stats[k]}`);
  toast({
    type: parts.length ? 'success' : 'info',
    message: parts.length ? `已导入：${parts.join('、')}` : '该文件夹没有发现新媒体文件'
  });
  return stats;
}

/** 读取音频内嵌 ID3 标签并回填，完成后刷新音乐库 */
export async function enrichAudio(item) {
  try {
    let tag = null;
    if (item.origin === 'path' && item.path && window.qingAPI.metaId3) {
      tag = await window.qingAPI.metaId3(item.path);
    } else if (item.file && window.qingAPI.metaId3Buf) {
      const buf = await item.file.arrayBuffer();
      tag = await window.qingAPI.metaId3Buf(buf, item.ext);
    }
    if (!tag || tag.error) return null;
    let changed = false;
    if (tag.title && !item.matchedName) { item.matchedName = tag.title; changed = true; }
    if (tag.artist) { item.artist = tag.artist; changed = true; }
    if (tag.album) { item.album = tag.album; changed = true; }
    if (tag.cover) { item.cover = tag.cover; changed = true; }
    if (tag.lyrics) { item.embeddedLyric = tag.lyrics; changed = true; }
    if (changed) eventBus.emit('library:changed', { kind: 'audio' });
    return tag;
  } catch (e) {
    return null;
  }
}

/** 浏览器下载完成 → 自动归入对应库 */
export async function addDownloadToLibrary(savePath) {
  if (!savePath || !window.qingAPI || !window.qingAPI.mediaUrlForPath) return null;
  const info = await window.qingAPI.mediaUrlForPath(savePath);
  if (!info || info.error || !info.kind) return null;
  const item = fileToItem({
    path: savePath, name: info.name, ext: info.ext, size: info.size,
    url: info.url, kind: info.kind
  });
  const added = pushItems(info.kind, [item]);
  if (added) {
    if (info.kind === 'audio') enrichAudio(item);
    toast({ type: 'success', message: `下载完成，已加入${KIND_LABEL[info.kind]}库` });
  }
  return info.kind;
}

export function initMediaLib() {
  if (window.qingAPI && window.qingAPI.onMediaFolderNew) {
    window.qingAPI.onMediaFolderNew((f) => {
      if (!f || !f.kind) return;
      pushItems(f.kind, [fileToItem(f)]);
    });
  }
}

export default {
  scanMediaFolder, enrichAudio, addDownloadToLibrary, initMediaLib, pushItems, fileToItem
};
