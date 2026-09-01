/**
 * main/ipc-music.js — 音乐相关 IPC（网易云 / QQ / 酷狗 / 豆瓣元数据）
 */
const { ipcMain } = require('electron');
const https = require('https');
const http = require('http');
const netease = require('NeteaseCloudMusicApi');
const { httpGet } = require('./shared');

module.exports = function initMusicIpc(state) {
  const { neteaseCookie } = state;

  // ---------- 网易云歌曲字段映射（兼容新旧字段） ----------
  function mapNeteaseSongs(songs) {
    return (songs || []).map((s) => ({
      id: s.id,
      name: s.name,
      artist: ((s.artists || []).map((a) => a.name).join(' / ')) || ((s.ar || []).map((a) => a.name).join(' / ')),
      album: s.album?.name || s.al?.name || '',
      cover: s.album?.picUrl || s.al?.picUrl || '',
      duration: (s.duration != null ? s.duration : (s.dt || 0)) / 1000,
      platform: 'netease'
    }));
  }

  // ========== 网易云 ==========
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
      } catch {}
      return list;
    } catch (err) { return { error: err.message }; }
  });

  ipcMain.handle('netease:url', async (e, { id, level }) => {
    try {
      const res = await netease.song_url_v1({ id, level: level || 'standard', cookie: state.neteaseCookie });
      const url = res.body?.data?.[0]?.url;
      const br = res.body?.data?.[0]?.br;
      return url ? { url, br } : { error: '无法获取播放地址（可能需要更高音质权限）' };
    } catch (err) { return { error: err.message }; }
  });

  ipcMain.handle('netease:detail', async (e, ids) => {
    try {
      const res = await netease.song_detail({ ids });
      return mapNeteaseSongs(res.body?.songs || []);
    } catch (err) { return { error: err.message }; }
  });

  ipcMain.handle('netease:lyric', async (e, id) => {
    try {
      const res = await netease.lyric({ id });
      return { lrc: res.body?.lrc?.lyric || '', tlyric: res.body?.tlyric?.lyric || '' };
    } catch (err) { return { error: err.message }; }
  });

  ipcMain.handle('netease:login', async (e, { phone, password }) => {
    try {
      const res = await netease.login_cellphone({ phone, password });
      if (res.body?.code === 200) {
        return { success: true, userId: res.body.account?.id, nickname: res.body.profile?.nickname, avatar: res.body.profile?.avatarUrl };
      }
      return { success: false, error: res.body?.message || '登录失败' };
    } catch (err) { return { success: false, error: err.message }; }
  });

  // ========== 网易云扫码登录 ==========
  ipcMain.handle('netease:qrKey', async () => {
    try {
      const res = await netease.login_qr_key({});
      const key = res.body?.data?.unikey || res.body?.unikey || '';
      if (!key) return { error: '获取二维码 key 失败' };
      return { key };
    } catch (err) { return { error: err.message }; }
  });

  ipcMain.handle('netease:qrCreate', async (e, key) => {
    try {
      const res = await netease.login_qr_create({ key, qrimg: true });
      const qrimg = res.body?.data?.qrimg || res.body?.qrimg || '';
      return qrimg ? { qrimg } : { error: '生成二维码失败' };
    } catch (err) { return { error: err.message }; }
  });

  ipcMain.handle('netease:qrCheck', async (e, key) => {
    try {
      const res = await netease.login_qr_check({ key });
      const code = res.body?.code;
      const cookie = res.body?.cookie || '';
      if (code === 803 && cookie) { state.neteaseCookie = cookie; return { code, cookie, message: '登录成功' }; }
      return { code, message: res.body?.message || '' };
    } catch (err) { return { code: -1, error: err.message }; }
  });

  ipcMain.handle('netease:loginStatus', async (e, cookie) => {
    try {
      const ck = cookie || state.neteaseCookie;
      const res = await netease.login_status({ cookie: ck });
      const data = res.body?.data || res.body || {};
      const profile = data.profile || {};
      const account = data.account || {};
      if (!account.id && !profile.userId) return { error: '未登录' };
      if (ck && !state.neteaseCookie) state.neteaseCookie = ck;
      return { success: true, userId: account.id || profile.userId, nickname: profile.nickname || '', avatar: profile.avatarUrl || '', cookie: ck };
    } catch (err) { return { error: err.message }; }
  });

  ipcMain.handle('netease:playlist', async (e, uid) => {
    try {
      const res = await netease.user_playlist({ uid, limit: 50, cookie: state.neteaseCookie });
      return (res.body?.playlist || []).map(p => ({ id: p.id, name: p.name, cover: p.coverImgUrl, count: p.trackCount }));
    } catch (err) { return { error: err.message }; }
  });

  ipcMain.handle('netease:playlistDetail', async (e, id) => {
    try {
      const res = await netease.playlist_track({ id, limit: 50, cookie: state.neteaseCookie });
      return mapNeteaseSongs(res.body?.songs || []);
    } catch (err) { return { error: err.message }; }
  });

  // ========== 发现页 ==========
  ipcMain.handle('netease:toplist', async () => {
    try {
      const res = await netease.toplist();
      return (res.body?.list || []).slice(0, 12).map(t => ({ id: t.id, name: t.name, cover: t.coverImgUrl || '', updateFrequency: t.updateFrequency || '', playCount: t.playCount || 0, trackCount: (t.tracks || []).length }));
    } catch (err) { return { error: err.message }; }
  });

  ipcMain.handle('netease:topDetail', async (e, id) => {
    try {
      const res = await netease.playlist_detail({ id, limit: 60 });
      return mapNeteaseSongs(res.body?.playlist?.tracks || res.body?.data?.playlist?.tracks || []);
    } catch (err) { return { error: err.message }; }
  });

  ipcMain.handle('netease:personalized', async (e, limit = 30) => {
    try {
      const res = await netease.personalized({ limit });
      return (res.body?.result || []).map(p => ({ id: p.id, name: p.name, cover: p.picUrl || '', playCount: p.playCount || 0, trackCount: p.trackCount || 0, platform: 'netease' }));
    } catch (err) { return { error: err.message }; }
  });

  ipcMain.handle('netease:simi', async (e, id) => {
    try {
      const res = await netease.simi_song({ id });
      return mapNeteaseSongs(res.body?.songs || []);
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

  // ========== QQ音乐 ==========
  ipcMain.handle('qq:search', async (e, keyword) => {
    try {
      const url = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${encodeURIComponent(keyword)}&format=json&p=1&n=30&cr=1`;
      const res = await httpGet(url, { Referer: 'https://y.qq.com/' });
      const data = JSON.parse(res.body);
      const list = data?.data?.song?.list || [];
      return list.map(s => ({
        id: s.songmid, name: s.songname,
        artist: (s.singer || []).map(a => a.name).join(' / '),
        album: s.albumname || '',
        cover: s.albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${s.albummid}.jpg` : '',
        duration: s.interval, platform: 'qq'
      }));
    } catch (err) { return { error: err.message }; }
  });

  ipcMain.handle('qq:url', async (e, songmid) => {
    try {
      const guid = Math.floor(Math.random() * 10000000000).toString();
      const filenames = [`C400${songmid}.m4a`, `M500${songmid}.mp3`, `M800${songmid}.mp3`, `M320${songmid}.mp3`, `C200${songmid}.m4a`];
      const data = JSON.stringify({
        req: { module: 'CDN.SrfCdnDispatchServer', method: 'GetCdnDispatch', param: { guid, calltype: 0, userip: '' } },
        req_0: { module: 'vkey.GetVkeyServer', method: 'CgiGetVkey', param: { guid, songmid: filenames.map(() => songmid), filename: filenames, songtype: filenames.map(() => 0), uin: '0', loginflag: 1, platform: '20' } }
      });
      const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?data=${encodeURIComponent(data)}`;
      const res = await httpGet(url, { Referer: 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });
      const body = JSON.parse(res.body);
      const infos = body?.req_0?.data?.midurlinfo || [];
      const streamHost = 'https://dl.stream.qqmusic.qq.com/';
      for (let i = 0; i < infos.length; i++) {
        const info = infos[i] || {};
        if (info.purl) return { url: `${streamHost}${info.purl}` };
        if (info.vkey) return { url: `${streamHost}${filenames[i]}?vkey=${info.vkey}&guid=${guid}&uin=0&fromtag=66` };
      }
      const altUrl = `https://c.y.qq.com/base/fcgi-bin/fcg_music_express_mobile3.fcg?format=json&platform=yqq&cid=205361747&uin=0&songmid=${songmid}&filename=${filenames[0]}&guid=${guid}`;
      const res2 = await httpGet(altUrl, { Referer: 'https://y.qq.com/' });
      const vkey2 = JSON.parse(res2.body)?.data?.items?.[0]?.vkey;
      if (vkey2) return { url: `https://dl.stream.qqmusic.qq.com/${filenames[0]}?vkey=${vkey2}&guid=${guid}&uin=0&fromtag=66` };
      return { error: '该歌曲为 VIP 专属或受版权保护，暂无法免费播放' };
    } catch (err) { return { error: err.message }; }
  });

  // ========== 酷狗音乐 ==========
  ipcMain.handle('kugou:search', async (e, keyword) => {
    try {
      const url = `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(keyword)}&page=1&pagesize=30&format=json&platform=WebFilter`;
      const res = await httpGet(url, { Referer: 'https://www.kugou.com/' });
      const list = JSON.parse(res.body)?.data?.lists || [];
      return list.map(s => ({
        id: s.FileHash, name: s.SongName, artist: s.SingerName, album: s.AlbumName || '', albumId: s.AlbumID || '',
        cover: (s.Image ? s.Image.replace('{size}', '400').replace(/^http:/, 'https:') : '') || (s.AlbumID ? `https://albumcover.kugou.com/albumcover/${s.AlbumID}.jpg` : ''),
        duration: s.Duration, platform: 'kugou'
      }));
    } catch (err) { return { error: err.message }; }
  });

  ipcMain.handle('kugou:url', async (e, hash, albumId) => {
    const tryGet = async (u) => { try { const r = await httpGet(u, { Referer: 'https://www.kugou.com/' }); return JSON.parse(r.body); } catch { return null; } };
    try {
      const b1 = await tryGet(`https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`);
      if (b1?.url) return { url: b1.url };
      const mid = (() => { let t = ''; for (let i = 0; i < 32; i++) t += '0123456789abcdef'[Math.floor(Math.random() * 16)]; return t; })();
      const build = (album, platid) => `https://wwwapi.kugou.com/yy/index.php?r=play/getdata&hash=${hash}&album_id=${album || ''}&platid=${platid}&appid=1014&mid=${mid}`;
      for (const u of [build(albumId, 4), build('', 4), build('', 0)]) {
        const b = await tryGet(u);
        if (b?.data?.play_url) return { url: b.data.play_url };
      }
      return { error: '该歌曲受版权保护或已在酷狗下架，暂无法播放' };
    } catch (err) { return { error: err.message }; }
  });
};
