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

// 让自定义协议具备标准媒体能力（流式、Range、可被 media 元素加载）
try {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'qing-file',
      privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true, bypassCSP: true }
    }
  ]);
} catch (e) { /* 已注册可忽略 */ }

const AUDIO_EXT = ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'ape', 'wma', 'opus', 'aiff'];
const VIDEO_EXT = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv', 'ts', 'm4v', 'wmv', 'rmvb'];
const BOOK_EXT = ['txt', 'md', 'markdown', 'epub'];
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

const MIME = {
  mp3: 'audio/mpeg', flac: 'audio/flac', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  aac: 'audio/aac', ape: 'audio/ape', wma: 'audio/x-ms-wma', opus: 'audio/ogg',
  mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  mov: 'video/quicktime', flv: 'video/x-flv', ts: 'video/mp2t', m4v: 'video/mp4',
  txt: 'text/plain', md: 'text/plain', epub: 'application/epub+zip',
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

/** 把磁盘绝对路径转成 qing-file:// 可播放 URL */
function toMediaUrl(absPath) {
  return 'qing-file://media/' + encodeURIComponent(absPath.replace(/\\/g, '/'));
}

/** 递归枚举目录下的媒体文件（跳过隐藏 / 节点目录，限制总量防爆） */
function walkMedia(dir, out, cap, depth) {
  if (out.length >= cap || depth > 12) return;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const ent of entries) {
    if (out.length >= cap) break;
    if (ent.name.startsWith('.') || ent.name === 'node_modules' || ent.name === '$RECYCLE.BIN' || ent.name === 'System Volume Information') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkMedia(full, out, cap, depth + 1);
    else {
      const kind = kindOf(full);
      if (kind) {
        let size = 0;
        try { size = fs.statSync(full).size; } catch (e) {}
        out.push({ path: full, name: ent.name, ext: extOf(full), size, kind });
      }
    }
  }
}

// 已监听的目录 watcher（去重）
const watchers = new Map();
let getMainWindow = () => null;

function watchFolder(dir) {
  if (watchers.has(dir)) return;
  try {
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
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('media:folder-new', {
            path: full, name: path.basename(full), ext: extOf(full), size: st.size, kind,
            url: toMediaUrl(full)
          });
        }
      });
    });
    watchers.set(dir, { watcher: w, known });
  } catch (e) { /* 部分卷不支持递归监听，忽略 */ }
}

function init(getWindow) {
  getMainWindow = getWindow || getMainWindow;

  // ---- qing-file 流式协议（含 Range/206，支持视频拖动） ----
  protocol.registerStreamProtocol('qing-file', (request, callback) => {
    let filePath = '';
    try {
      const u = new url.URL(request.url);
      filePath = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
    } catch (e) { return callback({ statusCode: 400, data: null }); }
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) return callback({ statusCode: 404, data: null });
      const mime = MIME[extOf(filePath)] || 'application/octet-stream';
      const range = (request.headers && request.headers.Range) || (request.headers && request.headers.range);
      if (range) {
        const m = /bytes=(\d+)-(\d*)/.exec(range);
        if (m) {
          const start = parseInt(m[1], 10);
          const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
          if (start >= stat.size) {
            return callback({ statusCode: 416, headers: { 'Content-Range': `bytes */${stat.size}` }, data: null });
          }
          const stream = fs.createReadStream(filePath, { start, end });
          return callback({
            statusCode: 206,
            headers: {
              'Content-Type': mime,
              'Accept-Ranges': 'bytes',
              'Content-Range': `bytes ${start}-${end}/${stat.size}`,
              'Content-Length': String(end - start + 1)
            },
            data: stream
          });
        }
      }
      const stream = fs.createReadStream(filePath);
      callback({
        statusCode: 200,
        headers: { 'Content-Type': mime, 'Accept-Ranges': 'bytes', 'Content-Length': String(stat.size) },
        data: stream
      });
    });
  });

  // ---- 选择文件夹并扫描 ----
  ipcMain.handle('dialog:pickMediaFolder', async () => {
    const r = await dialog.showOpenDialog(getMainWindow(), {
      title: '选择媒体文件夹', properties: ['openDirectory']
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    const dir = r.filePaths[0];
    const files = [];
    walkMedia(dir, files, 20000, 0);
    files.forEach((f) => { f.url = toMediaUrl(f.path); });
    watchFolder(dir);
    return { canceled: false, dir, files };
  });

  // ---- 读取文本（TXT/MD，自动尝试 UTF-8，GBK 由渲染层兜底） ----
  ipcMain.handle('fs:readText', async (e, fp) => {
    try {
      const buf = fs.readFileSync(fp);
      return { text: buf.toString('utf8') };
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

module.exports = { init, toMediaUrl, kindOf, AUDIO_EXT, VIDEO_EXT, BOOK_EXT, IMAGE_EXT };
