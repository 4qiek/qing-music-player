/**
 * main-media.js — 本地媒体基础设施（主进程）
 *  1. 注册 qing-file:// 流式协议（支持 Range，大视频可拖动，无需读入内存）
 *  2. 文件夹选择 / 递归扫描媒体文件 / 目录监听新增
 *  3. 读取文本 / 二进制（书籍、ID3、EPUB）
 *  4. music-metadata 解析音频内嵌标签 / 封面 / 歌词
 * 由 main.js 在 app ready 后 init。
 */
const { app, ipcMain, protocol, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { Readable } = require('stream');

// 让自定义协议具备标准媒体能力（流式、Range、可被 media 元素加载）
try {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'qing-file',
      privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true }
    }
  ]);
} catch (e) { /* 已注册可忽略 */ }

const AUDIO_EXT = ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'ape', 'wma', 'opus', 'aiff'];
const VIDEO_EXT = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv', 'ts', 'm4v', 'wmv', 'rmvb'];
const BOOK_EXT = ['txt', 'md', 'markdown', 'epub'];
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

// MIME 表必须与上面四个扩展名清单一一对应，缺项会回落 application/octet-stream，
// 而 <audio crossorigin="anonymous"> 在 CORS 模式下对 MIME 更敏感，可能直接拒绝播放。
// 已补齐：aiff / markdown（本次需求）、wmv / rmvb（核表时发现同样缺失）。
const MIME = {
  mp3: 'audio/mpeg', flac: 'audio/flac', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  aac: 'audio/aac', ape: 'audio/ape', wma: 'audio/x-ms-wma', opus: 'audio/ogg', aiff: 'audio/aiff',
  mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  mov: 'video/quicktime', flv: 'video/x-flv', ts: 'video/mp2t', m4v: 'video/mp4',
  wmv: 'video/x-ms-wmv', rmvb: 'video/vnd.rn-realmedia',
  txt: 'text/plain', md: 'text/plain', markdown: 'text/markdown', epub: 'application/epub+zip',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp'
};

function extOf(p) {
  return (p.split('.').pop() || '').toLowerCase();
}
function kindOf(p) {
  const e = extOf(p);
  if (AUDIO_EXT.includes(e)) return 'audio';
  if (VIDEO_EXT.includes(e)) return 'video';
  if (BOOK_EXT.includes(e)) return 'book';
  if (IMAGE_EXT.includes(e)) return 'image';
  return null;
}

// ===== 路径白名单（qing-file 安全加固） =====
// 仅允许用户主动选择的媒体文件夹（根目录）以及显式导入的单个文件被流式协议访问，
// 防止任意本地文件经自定义协议泄露。
const allowedRoots = new Set();
const allowedFiles = new Set();
function normalizePath(p) {
  try { return path.resolve(p).toLowerCase(); } catch { return String(p).toLowerCase(); }
}
function isPathAllowed(p) {
  const np = normalizePath(p);
  if (allowedFiles.has(np)) return true;
  for (const root of allowedRoots) {
    if (np === root || np.startsWith(root + path.sep)) return true;
  }
  return false;
}

// ===== 白名单持久化 =====
// 白名单仅存在于内存时，重启应用后会清空，导致上次导入的本地媒体全部 403 无法播放。
// 因此落盘到 userData/allowed-paths.json，init 时读回；读写失败一律静默，不影响播放。
const ALLOWED_STORE_NAME = 'allowed-paths.json';
let allowedStoreFileCache = '';
let persistTimer = null;

/** 白名单落盘文件路径（userData 目录下） */
function getAllowedStoreFile() {
  if (allowedStoreFileCache) return allowedStoreFileCache;
  try {
    allowedStoreFileCache = path.join(app.getPath('userData'), ALLOWED_STORE_NAME);
  } catch (e) {
    allowedStoreFileCache = '';
  }
  return allowedStoreFileCache;
}

/** init 时读回上次登记的白名单 */
function loadAllowedPaths() {
  const fp = getAllowedStoreFile();
  if (!fp) return;
  try {
    if (!fs.existsSync(fp)) return;
    const data = JSON.parse(fs.readFileSync(fp, 'utf-8')) || {};
    const roots = Array.isArray(data.roots) ? data.roots : [];
    const files = Array.isArray(data.files) ? data.files : [];
    roots.forEach((p) => { if (typeof p === 'string' && p) allowedRoots.add(normalizePath(p)); });
    files.forEach((p) => { if (typeof p === 'string' && p) allowedFiles.add(normalizePath(p)); });
  } catch (e) {
    // 文件损坏 / 不可读：忽略，退化为「本次会话重新登记」
  }
}

/** 同步写回落盘文件（失败不影响播放） */
function persistAllowedPaths() {
  const fp = getAllowedStoreFile();
  if (!fp) return;
  try {
    const data = { roots: Array.from(allowedRoots), files: Array.from(allowedFiles) };
    fs.writeFileSync(fp, JSON.stringify(data), 'utf-8');
  } catch (e) {
    // 磁盘不可写等：忽略
  }
}

/** 防抖写回，避免批量登记时反复写盘 */
function schedulePersistAllowed() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistAllowedPaths();
  }, 300);
}

/** 登记用户通过对话框选择的媒体文件夹（整目录可访问） */
function addAllowedRoot(dir) {
  if (!dir) return;
  const np = normalizePath(dir);
  if (allowedRoots.has(np)) return;
  allowedRoots.add(np);
  schedulePersistAllowed();
}
/** 登记用户显式导入的单个文件 */
function addAllowedFile(fp) {
  if (!fp) return;
  const np = normalizePath(fp);
  if (allowedFiles.has(np)) return;
  allowedFiles.add(np);
  schedulePersistAllowed();
}

/**
 * 为 qing-file 响应统一补 CORS 头。
 *
 * 原因：页面里 <audio id="audio" crossorigin="anonymous"> 会以 CORS 模式发起媒体请求，
 * 自定义协议响应若不带 Access-Control-Allow-Origin，浏览器会直接判为加载失败。
 *
 * 安全性说明：'*' 并不放宽任何文件读取边界——qing-file 仍受 isPathAllowed() 白名单保护，
 * 未登记的路径照旧返回 403；这里只是允许页面以 CORS 模式读取「已被白名单允许」的本地媒体。
 *
 * @param {object} headers 业务响应头
 * @returns {object} 带上 ACAO 的响应头
 */
function withCors(headers) {
  return Object.assign({ 'Access-Control-Allow-Origin': '*' }, headers || {});
}

/** 把磁盘绝对路径转成 qing-file:// 可播放 URL */
function toMediaUrl(absPath) {
  return 'qing-file://media/' + encodeURIComponent(absPath.replace(/\\/g, '/'));
}

/** 递归枚举目录下的媒体文件（异步，避免大目录卡死主进程；跳过隐藏 / 节点目录 / 符号链接循环，限制总量防爆） */
async function walkMedia(dir, out, cap, depth, visited) {
  if (out.length >= cap || depth > 12) return;
  if (!visited) visited = new Set();
  let realDir;
  try { realDir = await fs.promises.realpath(dir); } catch (e) { return; }
  if (visited.has(realDir)) return;
  visited.add(realDir);
  let entries = [];
  try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const ent of entries) {
    if (out.length >= cap) break;
    if (ent.name.startsWith('.') || ent.name === 'node_modules' || ent.name === '$RECYCLE.BIN' || ent.name === 'System Volume Information') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      // 跳过符号链接目录，防止循环
      try { const lst = await fs.promises.lstat(full); if (lst.isSymbolicLink()) continue; } catch (e) { continue; }
      await walkMedia(full, out, cap, depth + 1, visited);
    } else {
      const kind = kindOf(full);
      if (kind) {
        let size = 0;
        try { const st = await fs.promises.stat(full); size = st.size; } catch (e) {}
        out.push({ path: full, name: ent.name, ext: extOf(full), size, kind });
      }
    }
    // 每处理若干文件让出事件循环，避免扫描大目录时主进程无响应
    if ((out.length & 63) === 0) await new Promise((r) => setImmediate(r));
  }
}

// 已监听的目录 watcher（去重）
const watchers = new Map();
let getMainWindow = () => null;

/** 向渲染层发送“文件夹新增媒体”通知（去重 + 通知逻辑统一在此） */
function notifyFolderNew(full, kind, st) {
  const key = full.toLowerCase();
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send('media:folder-new', {
      path: full, name: path.basename(full), ext: extOf(full), size: st.size, kind,
      url: toMediaUrl(full)
    });
  }
}

function watchFolder(dir) {
  if (watchers.has(dir)) return;
  try {
    // 优先尝试递归监听（Windows / macOS 支持）
    const known = new Set();
    const w = fs.watch(dir, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      const full = path.join(dir, filename);
      const kind = kindOf(full);
      if (!kind) return;
      fs.stat(full, (err, st) => {
        if (err || !st.isFile()) return;
        const key = full.toLowerCase();
        if (known.has(key)) return;
        known.add(key);
        notifyFolderNew(full, kind, st);
      });
    });
    watchers.set(dir, { watcher: w, known });
  } catch (e) {
    // 递归监听不被支持（如部分 Linux 发行版）：退回逐目录非递归监听
    watchFolderNonRecursive(dir);
  }
}

/** 非递归监听单个目录（新增子目录时补挂监听） */
function watchDir(dir, known) {
  if (watchers.has('nr:' + dir)) return;
  let w;
  try {
    w = fs.watch(dir, (eventType, filename) => {
      if (!filename) return;
      const full = path.join(dir, filename);
      let st;
      try { st = fs.statSync(full); } catch (e) { return; }
      if (st.isDirectory()) {
        // 新出现的子目录：注册后补挂监听
        if (!watchers.has('nr:' + full) && !full.startsWith('.')) {
          known.add(full.toLowerCase());
          watchDir(full, known);
        }
        return;
      }
      const kind = kindOf(full);
      if (!kind) return;
      const key = full.toLowerCase();
      if (known.has(key)) return;
      known.add(key);
      notifyFolderNew(full, kind, st);
    });
  } catch (e) { return; }
  watchers.set('nr:' + dir, { watcher: w, known });
}

/** 初始扫描已存在子目录并逐层挂监听（递归监听不可用时的回退方案） */
function watchFolderNonRecursive(dir) {
  const known = new Set();
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach((ent) => {
      if (ent.isDirectory() && !ent.name.startsWith('.')) {
        const full = path.join(dir, ent.name);
        known.add(full.toLowerCase());
        watchDir(full, known);
      }
    });
  } catch (e) { /* ignore */ }
  watchDir(dir, known);
}

function init(getWindow) {
  getMainWindow = getWindow || getMainWindow;
  // 恢复上次运行登记的路径白名单（必须在协议可用前完成，否则重启后本地媒体全部 403）
  loadAllowedPaths();
  // 退出前兜底落盘，避免防抖窗口内退出丢失本次登记
  try { app.on('before-quit', persistAllowedPaths); } catch (e) { /* ignore */ }

  // ---- qing-file 流式协议（含 Range/206，支持视频拖动）----
  // Electron 28 用 protocol.handle（registerStreamProtocol 已移除）
  protocol.handle('qing-file', async (request) => {
    let filePath = '';
    try {
      const u = new url.URL(request.url);
      filePath = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
    } catch (e) {
      return new Response('bad url', {
        status: 400,
        headers: withCors({ 'Content-Type': 'text/plain; charset=utf-8' })
      });
    }
    // 安全加固：仅允许白名单内的路径被流式访问（403 带可读说明，便于定位播放失败）
    if (!isPathAllowed(filePath)) {
      return new Response('forbidden: path not allowed', {
        status: 403,
        headers: withCors({ 'Content-Type': 'text/plain; charset=utf-8' })
      });
    }
    let stat;
    try { stat = fs.statSync(filePath); } catch (e) {
      return new Response('not found', {
        status: 404,
        headers: withCors({ 'Content-Type': 'text/plain; charset=utf-8' })
      });
    }
    if (!stat.isFile()) {
      return new Response('not found', {
        status: 404,
        headers: withCors({ 'Content-Type': 'text/plain; charset=utf-8' })
      });
    }
    const mime = MIME[extOf(filePath)] || 'application/octet-stream';

    // ---- CORS 预flight（OPTIONS）兜底 ----
    // 页面里 <audio crossorigin="anonymous"> 以 CORS 模式请求本地媒体。按 Fetch 规范 Range
    // 属于安全列表请求头，理论上不触发预flight，但不同 Chromium 版本对自定义协议的处理存在差异；
    // 若不短路，OPTIONS 会落到底下的 GET 分支，返回「200 + 整个文件流」且缺少
    // Allow-Methods / Allow-Headers，预flight 判定失败 → 媒体加载失败。
    // 注意：该分支位于路径白名单校验之后，未登记路径的预flight 同样走 403，不放宽任何边界。
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: withCors({
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Range, Content-Type',
          'Access-Control-Max-Age': '86400'
        })
      });
    }

    const range = request.headers.get('Range');
    if (range) {
      const m = /bytes=(\d+)-(\d*)/.exec(range);
      if (m) {
        const start = parseInt(m[1], 10);
        const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
        if (start >= stat.size) {
          return new Response('', {
            status: 416,
            headers: withCors({
              'Content-Type': mime,
              'Content-Range': `bytes */${stat.size}`
            })
          });
        }
        const stream = fs.createReadStream(filePath, { start, end });
        return new Response(Readable.toWeb(stream), {
          status: 206,
          headers: withCors({
            'Content-Type': mime,
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Content-Length': String(end - start + 1)
          })
        });
      }
    }
    const stream = fs.createReadStream(filePath);
    return new Response(Readable.toWeb(stream), {
      status: 200,
      headers: withCors({
        'Content-Type': mime,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(stat.size)
      })
    });
  });

  // ---- 选择文件夹并扫描 ----
  ipcMain.handle('dialog:pickMediaFolder', async () => {
    const r = await dialog.showOpenDialog(getMainWindow(), {
      title: '选择媒体文件夹', properties: ['openDirectory']
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    const dir = r.filePaths[0];
    // 登记白名单：该文件夹（含子目录）后续可被 qing-file 协议访问
    addAllowedRoot(dir);
    const files = [];
    await walkMedia(dir, files, 20000, 0);
    files.forEach((f) => { f.url = toMediaUrl(f.path); });
    watchFolder(dir);
    return { canceled: false, dir, files };
  });

  // ---- 批量补登记白名单（渲染层启动时把已入库的本地路径回传，解决重启后 403） ----
  ipcMain.handle('media:registerPaths', async (e, list) => {
    const paths = Array.isArray(list) ? list : [];
    let count = 0;
    for (const p of paths) {
      if (typeof p !== 'string' || !p) continue;
      // 目录按根登记（含子目录），文件按单文件登记；
      // 路径当前不存在（文件被移走）时按单文件登记，用户放回文件后即可直接播放
      let isDir = false;
      try { isDir = fs.statSync(p).isDirectory(); } catch (err) { isDir = false; }
      if (isDir) addAllowedRoot(p);
      else addAllowedFile(p);
      count++;
    }
    // 批量登记后立刻写盘，避免防抖窗口内退出导致丢失
    if (count) persistAllowedPaths();
    return { ok: true, count: count };
  });

  // ---- 读取文本（TXT/MD，先试 UTF-8（fatal），失败回退 GBK；EPUB 等 zip 内一律 UTF-8） ----
  ipcMain.handle('fs:readText', async (e, fp) => {
    try {
      const buf = fs.readFileSync(fp);
      let text;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
      } catch (e) {
        // UTF-8 解码失败（如 GBK 编码的本地文本），回退 GBK
        text = new TextDecoder('gbk').decode(buf);
      }
      return { text };
    } catch (err) { return { error: err.message }; }
  });

  // ---- 读取二进制（ArrayBuffer，用于 ID3 / EPUB） ----
  ipcMain.handle('fs:readBuffer', async (e, fp) => {
    try {
      const buf = fs.readFileSync(fp);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    } catch (err) { return { error: err.message }; }
  });

  // ---- 解析音频内嵌标签（ID3 / Vorbis Comment） ----
  ipcMain.handle('meta:id3', async (e, fp) => {
    try {
      const mm = require('music-metadata');
      const meta = await mm.parseFile(fp, { duration: false, skipCovers: false });
      const c = meta.common || {};
      let cover = '';
      if (Array.isArray(c.picture) && c.picture[0]) {
        const pic = c.picture[0];
        cover = `data:${pic.format || 'image/jpeg'};base64,${Buffer.from(pic.data).toString('base64')}`;
      }
      let lyrics = '';
      if (c.lyrics && c.lyrics[0]) lyrics = c.lyrics[0].text || '';
      return {
        title: c.title || '',
        artist: (c.artist || (Array.isArray(c.artists) ? c.artists.join(' / ') : '')) || '',
        album: c.album || '',
        year: c.year || '',
        track: c.track && c.track.no ? c.track.no : 0,
        cover, lyrics
      };
    } catch (err) { return { error: err.message }; }
  });

  // ---- 由磁盘路径生成媒体 URL（下载归库用） ----
  ipcMain.handle('media:urlForPath', async (e, fp) => {
    try {
      const st = fs.statSync(fp);
      // 登记白名单：该文件后续可被 qing-file 协议访问（如下载归库的单文件）
      addAllowedFile(fp);
      return { url: toMediaUrl(fp), size: st.size, ext: extOf(fp), kind: kindOf(fp), name: path.basename(fp) };
    } catch (err) { return { error: err.message }; }
  });

  // ---- 从内存 buffer 解析音频标签（手动选入的 File） ----
  ipcMain.handle('meta:id3buf', async (e, arrayBuf, extName) => {
    try {
      const mm = require('music-metadata');
      const buf = Buffer.from(arrayBuf);
      const mime = MIME[(extName || '').toLowerCase()] || 'audio/mpeg';
      const meta = await mm.parseBuffer(buf, { mimeType: mime, path: 'x.' + (extName || 'mp3') }, { duration: false, skipCovers: false });
      const c = meta.common || {};
      let cover = '';
      if (Array.isArray(c.picture) && c.picture[0]) {
        const pic = c.picture[0];
        cover = `data:${pic.format || 'image/jpeg'};base64,${Buffer.from(pic.data).toString('base64')}`;
      }
      let lyrics = '';
      if (c.lyrics && c.lyrics[0]) lyrics = c.lyrics[0].text || '';
      return {
        title: c.title || '', artist: (c.artist || (Array.isArray(c.artists) ? c.artists.join(' / ') : '')) || '',
        album: c.album || '', year: c.year || '',
        track: c.track && c.track.no ? c.track.no : 0, cover, lyrics
      };
    } catch (err) { return { error: err.message }; }
  });
}

module.exports = {
  init,
  toMediaUrl,
  kindOf,
  AUDIO_EXT,
  VIDEO_EXT,
  BOOK_EXT,
  IMAGE_EXT,
  addAllowedRoot,
  addAllowedFile,
  loadAllowedPaths,
  persistAllowedPaths
};
