/**
 * main/ipc-music.js — 音乐相关 IPC
 *
 * 在线音乐功能（在线搜索页 / 在线播放 / 平台切换 / 账号登录 / 云端歌单 /
 * 排行榜 / 每日推荐 / 相似推荐 / 音质切换）已整体移除。
 * 这里只保留两块能力：
 *   1) 网易云 search / lyric —— 供本地歌曲增强使用
 *      （本地曲目按歌名匹配封面、歌手、专辑，以及匹配后拉取在线歌词）
 *   2) 豆瓣元数据 —— 本地视频 / 书籍的封面与信息匹配
 */
const { ipcMain } = require('electron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const netease = require('NeteaseCloudMusicApi');
const { httpGet } = require('./shared');

// state 仍由 main/index.js 传入（跨模块共享状态），本模块当前不再持有登录态
module.exports = function initMusicIpc(state) {
  // ===== 历史登录态清理 =====
  // 登录功能已移除，启动时删除旧的 userData/login.dat（加密 cookie 文件），失败忽略
  const LOGIN_FILE = path.join(app.getPath('userData'), 'login.dat');
  try {
    if (fs.existsSync(LOGIN_FILE)) fs.unlinkSync(LOGIN_FILE);
  } catch (e) { /* 文件被占用 / 无权限等情况忽略 */ }

  // ========== 网易云：仅保留本地增强用到的两个接口 ==========

  // 按关键词搜索（本地曲目按歌名匹配歌手 / 专辑 / 封面）
  ipcMain.handle('netease:search', async (e, keyword) => {
    try {
      const res = await netease.search({ keywords: keyword, limit: 30, type: 1 });
      const songs = res.body?.result?.songs || [];
      const list = songs.map(s => ({
        id: s.id, name: s.name,
        artist: ((s.artists || []).map(a => a.name).join(' / ')) || ((s.ar || []).map(a => a.name).join(' / ')),
        album: s.album?.name || s.al?.name || '',
        cover: s.al?.picUrl || '',
        duration: (s.duration != null ? s.duration : (s.dt || 0)) / 1000,
        platform: 'netease'
      }));
      try {
        const det = await netease.song_detail({ ids: list.map(x => x.id).join(',') });
        const coverMap = {};
        (det.body?.songs || []).forEach(d => { if (d?.al?.picUrl) coverMap[d.id] = d.al.picUrl; });
        list.forEach(x => { if (!x.cover && coverMap[x.id]) x.cover = coverMap[x.id]; });
      } catch (err) { /* 详情失败不影响搜索结果 */ }
      return list;
    } catch (err) { return { error: err.message }; }
  });

  // 按歌曲 id 取歌词（本地曲目匹配到 matchedId 后走这里补全在线歌词）
  ipcMain.handle('netease:lyric', async (e, id) => {
    try {
      const res = await netease.lyric({ id });
      return { lrc: res.body?.lrc?.lyric || '', tlyric: res.body?.tlyric?.lyric || '' };
    } catch (err) { return { error: err.message }; }
  });

  // ========== 豆瓣元数据匹配 ==========
  ipcMain.handle('meta:suggest', async (e, keyword, kind) => {
    try {
      if (!keyword) return [];
      const isBook = kind === 'book';
      const base = isBook ? 'https://book.douban.com' : 'https://movie.douban.com';
      const url = base + '/j/subject_suggest?q=' + encodeURIComponent(keyword);
      const r = await httpGet(url, { 'Accept': 'application/json, text/plain, */*', 'Referer': base + '/', 'Accept-Language': 'zh-CN,zh;q=0.9' });
      if (r.status !== 200) return { error: 'HTTP ' + r.status };
      const arr = JSON.parse(r.body || '[]');
      return (Array.isArray(arr) ? arr : []).map(x => isBook ? ({
        id: x.id, type: 'book', name: x.title || '', subTitle: '', year: x.year || '', card: x.author_name || '', cover: x.pic || ''
      }) : ({
        id: x.id, type: x.type || 'movie', name: x.title || '', subTitle: x.sub_title || '', year: x.year || '', card: x.sub_title || '', cover: x.img || x.cover_url || '', episode: x.episode || ''
      }));
    } catch (err) { return { error: err.message }; }
  });

  // ========== 封面图片代理 ==========
  ipcMain.handle('meta:cover', async (e, imgUrl) => {
    try {
      if (!imgUrl || !/^https?:\/\//.test(imgUrl)) return { error: 'bad url' };
      const fetchBuf = (u, redirects) => new Promise((resolve, reject) => {
        const mod = u.startsWith('https') ? https : http;
        const req = mod.get(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://www.douban.com/' } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
            res.resume();
            return resolve(fetchBuf(new URL(res.headers.location, u).toString(), redirects - 1));
          }
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], buf: Buffer.concat(chunks) }));
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      const r = await fetchBuf(imgUrl, 2);
      if (r.status !== 200 || !r.buf || !r.buf.length) return { error: 'HTTP ' + r.status };
      const mime = (r.type || 'image/jpeg').split(';')[0].trim();
      return { dataUrl: 'data:' + mime + ';base64,' + r.buf.toString('base64') };
    } catch (err) { return { error: err.message }; }
  });
};
