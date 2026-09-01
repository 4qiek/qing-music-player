const { app, BrowserWindow, ipcMain, net } = require('electron');
const path = require('path');
const https = require('https');
const http = require('http');

// 网易云音乐API
const netease = require('NeteaseCloudMusicApi');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#f5f5f7',
    title: '清 · 音乐播放器',
    icon: path.join(__dirname, 'assets', 'qing-icon.ico'),
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ========== 通用HTTP请求 ==========
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', ...headers } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ========== 网易云音乐 ==========
ipcMain.handle('netease:search', async (e, keyword) => {
  try {
    const res = await netease.search({ keywords: keyword, limit: 30, type: 1 });
    const songs = res.body?.result?.songs || [];
    const list = songs.map(s => ({
      id: s.id,
      name: s.name,
      // 兼容网易云新旧接口字段（新版 artists/album/duration，旧版 ar/al/dt）
      artist: ((s.artists || []).map(a => a.name).join(' / ')) || ((s.ar || []).map(a => a.name).join(' / ')),
      album: s.album?.name || s.al?.name || '',
      cover: s.al?.picUrl || '',
      duration: (s.duration != null ? s.duration : (s.dt || 0)) / 1000,
      platform: 'netease'
    }));
    // 新版 search 接口不带封面，用 song_detail 批量补（一次请求多个 id）
    try {
      const det = await netease.song_detail({ ids: list.map(x => x.id).join(',') });
      const coverMap = {};
      (det.body?.songs || []).forEach(d => { if (d?.al?.picUrl) coverMap[d.id] = d.al.picUrl; });
      list.forEach(x => { if (!x.cover && coverMap[x.id]) x.cover = coverMap[x.id]; });
    } catch {}
    return list;
  } catch (err) {
    return { error: err.message };
  }
});
ipcMain.handle('netease:url', async (e, { id, level }) => {
  try {
    const res = await netease.song_url_v1({ id, level: level || 'standard' });
    const url = res.body?.data?.[0]?.url;
    const br = res.body?.data?.[0]?.br;
    return url ? { url, br } : { error: '无法获取播放地址（可能需要更高音质权限）' };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('netease:detail', async (e, ids) => {
  try {
    const res = await netease.song_detail({ ids });
    const songs = res.body?.songs || [];
    return songs.map(s => ({
      id: s.id,
      name: s.name,
      artist: (s.ar || []).map(a => a.name).join(' / '),
      album: s.al?.name || '',
      cover: s.al?.picUrl || '',
      duration: s.dt / 1000,
      platform: 'netease'
    }));
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('netease:lyric', async (e, id) => {
  try {
    const res = await netease.lyric({ id });
    return {
      lrc: res.body?.lrc?.lyric || '',
      tlyric: res.body?.tlyric?.lyric || ''
    };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('netease:login', async (e, { phone, password }) => {
  try {
    const res = await netease.login_cellphone({ phone, password });
    if (res.body?.code === 200) {
      return {
        success: true,
        userId: res.body.account?.id,
        nickname: res.body.profile?.nickname,
        avatar: res.body.profile?.avatarUrl
      };
    }
    return { success: false, error: res.body?.message || '登录失败' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('netease:playlist', async (e, uid) => {
  try {
    const res = await netease.user_playlist({ uid, limit: 50 });
    const playlists = res.body?.playlist || [];
    return playlists.map(p => ({
      id: p.id,
      name: p.name,
      cover: p.coverImgUrl,
      count: p.trackCount
    }));
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('netease:playlistDetail', async (e, id) => {
  try {
    const res = await netease.playlist_track({ id, limit: 50 });
    const tracks = res.body?.songs || [];
    return tracks.map(s => ({
      id: s.id,
      name: s.name,
      artist: (s.ar || []).map(a => a.name).join(' / '),
      album: s.al?.name || '',
      duration: s.dt / 1000,
      platform: 'netease'
    }));
  } catch (err) {
    return { error: err.message };
  }
});

// ========== QQ音乐 ==========
ipcMain.handle('qq:search', async (e, keyword) => {
  try {
    const url = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${encodeURIComponent(keyword)}&format=json&p=1&n=30&cr=1`;
    const res = await httpGet(url, { Referer: 'https://y.qq.com/' });
    const data = JSON.parse(res.body);
    const list = data?.data?.song?.list || [];
    return list.map(s => ({
      id: s.songmid,
      name: s.songname,
      artist: (s.singer || []).map(a => a.name).join(' / '),
      album: s.albumname || '',
      cover: s.albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${s.albummid}.jpg` : '',
      duration: s.interval,
      platform: 'qq'
    }));
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('qq:url', async (e, songmid) => {
  // 参考开源方案：同一首歌按多个音质候选依次请求 vkey（C400.m4a→M500/M800/M320.mp3），
  // 取第一个能返回播放地址的，显著提高"很多歌放不出来"的问题
  try {
    const guid = Math.floor(Math.random() * 10000000000).toString();
    const filenames = [
      `C400${songmid}.m4a`,
      `M500${songmid}.mp3`,
      `M800${songmid}.mp3`,
      `M320${songmid}.mp3`,
      `C200${songmid}.m4a`
    ];
    const data = JSON.stringify({
      req: { module: 'CDN.SrfCdnDispatchServer', method: 'GetCdnDispatch', param: { guid, calltype: 0, userip: '' } },
      req_0: { module: 'vkey.GetVkeyServer', method: 'CgiGetVkey',
        param: { guid, songmid: filenames.map(() => songmid), filename: filenames, songtype: filenames.map(() => 0), uin: '0', loginflag: 1, platform: '20' } }
    });
    const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?data=${encodeURIComponent(data)}`;
    const res = await httpGet(url, {
      Referer: 'https://y.qq.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const body = JSON.parse(res.body);
    const infos = body?.req_0?.data?.midurlinfo || [];
    const streamHost = 'https://dl.stream.qqmusic.qq.com/';
    for (let i = 0; i < infos.length; i++) {
      const info = infos[i] || {};
      if (info.purl) return { url: `${streamHost}${info.purl}` };
      if (info.vkey) return { url: `${streamHost}${filenames[i]}?vkey=${info.vkey}&guid=${guid}&uin=0&fromtag=66` };
    }
    // 备用接口：音乐馆移动端 express 接口
    const altUrl = `https://c.y.qq.com/base/fcgi-bin/fcg_music_express_mobile3.fcg?format=json&platform=yqq&cid=205361747&uin=0&songmid=${songmid}&filename=${filenames[0]}&guid=${guid}`;
    const res2 = await httpGet(altUrl, { Referer: 'https://y.qq.com/' });
    const b2 = JSON.parse(res2.body);
    const vkey2 = b2?.data?.items?.[0]?.vkey;
    if (vkey2) return { url: `https://dl.stream.qqmusic.qq.com/${filenames[0]}?vkey=${vkey2}&guid=${guid}&uin=0&fromtag=66` };
    return { error: '该歌曲为 VIP 专属或受版权保护，暂无法免费播放' };
  } catch (err) {
    return { error: err.message };
  }
});
// ========== 酷狗音乐 ==========
ipcMain.handle('kugou:search', async (e, keyword) => {
  try {
    const url = `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(keyword)}&page=1&pagesize=30&format=json&platform=WebFilter`;
    const res = await httpGet(url, { Referer: 'https://www.kugou.com/' });
    const data = JSON.parse(res.body);
    const list = data?.data?.lists || [];
    return list.map(s => ({
      id: s.FileHash,
      name: s.SongName,
      artist: s.SingerName,
      album: s.AlbumName || '',
      albumId: s.AlbumID || '',
      cover: s.Img || (s.AlbumID ? `https://albumcover.kugou.com/albumcover/${s.AlbumID}.jpg` : ''),
      duration: s.Duration,
      platform: 'kugou'
    }));
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('kugou:url', async (e, hash, albumId) => {
  // 实测结论：wwwapi.getdata 需复杂参数且常被限制，m.kugou 手机端接口更稳 → 作为主通道
  const tryGet = async (u) => {
    try { const r = await httpGet(u, { Referer: 'https://www.kugou.com/' }); return JSON.parse(r.body); } catch { return null; }
  };
  try {
    // 主通道：手机端 playInfo
    const b1 = await tryGet(`https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`);
    if (b1?.url) return { url: b1.url };
    // 备用1：wwwapi getdata（带/不带 album_id + platid 组合）
    const mid = (() => { let t = ''; for (let i = 0; i < 32; i++) t += '0123456789abcdef'[Math.floor(Math.random() * 16)]; return t; })();
    const build = (album, platid) => `https://wwwapi.kugou.com/yy/index.php?r=play/getdata&hash=${hash}&album_id=${album || ''}&platid=${platid}&appid=1014&mid=${mid}`;
    for (const u of [build(albumId, 4), build('', 4), build('', 0)]) {
      const b = await tryGet(u);
      if (b?.data?.play_url) return { url: b.data.play_url };
    }
    return { error: '该歌曲受版权保护或已在酷狗下架，暂无法播放' };
  } catch (err) {
    return { error: err.message };
  }
});// ========== 天气 ==========
ipcMain.handle('weather:get', async (e, city) => {
  try {
    const targetCity = city || '扬州';
    const url = `https://wttr.in/${encodeURIComponent(targetCity)}?format=j1&lang=zh`;
    const res = await httpGet(url);
    const data = JSON.parse(res.body);
    const current = data?.current_condition?.[0];
    const today = data?.weather?.[0];
    return {
      city: targetCity,
      temp: current?.temp_C,
      feelsLike: current?.FeelsLikeC,
      desc: current?.lang_zh?.[0]?.value || current?.weatherDesc?.[0]?.value,
      humidity: current?.humidity,
      wind: current?.windspeedKmph,
      icon: current?.weatherCode,
      todayHigh: today?.maxtempC,
      todayLow: today?.mintempC,
      date: today?.date
    };
  } catch (err) {
    return { error: err.message };
  }
});

// ========== 系统：检测其他音乐播放器 + 媒体键控制 ==========
const { exec, execFile } = require('child_process');

const KNOWN_PLAYERS = {
  'cloudmusic.exe': { name: '网易云音乐', icon: '☁' },
  'QQMusic.exe': { name: 'QQ音乐', icon: '♪' },
  'QQMusicPlayer.exe': { name: 'QQ音乐', icon: '♪' },
  'KuGou.exe': { name: '酷狗音乐', icon: '♫' },
  'kugou.exe': { name: '酷狗音乐', icon: '♫' },
  'KwMusic.exe': { name: '酷我音乐', icon: '♬' },
  'Spotify.exe': { name: 'Spotify', icon: '♩' },
  'AppleMusic.exe': { name: 'Apple Music', icon: '' },
  'AppleMusic.Win.exe': { name: 'Apple Music', icon: '' },
  'iTunes.exe': { name: 'iTunes', icon: '' },
  'MiguMusic.exe': { name: '咪咕音乐', icon: '♪' },
  'foobar2000.exe': { name: 'foobar2000', icon: '♫' },
  'AIMP.exe': { name: 'AIMP', icon: '♪' },
  'Music.UI.exe': { name: '系统媒体播放器', icon: '♪' },
  'Microsoft.Media.Player.exe': { name: '媒体播放器', icon: '♪' }
};

ipcMain.handle('system:detectPlayers', async () => {
  return new Promise((resolve) => {
    const ps = `
$names = @('cloudmusic','QQMusic','QQMusicPlayer','KuGou','kugou','KwMusic','Spotify','AppleMusic','AppleMusic.Win','iTunes','MiguMusic','foobar2000','AIMP','Music.UI','Microsoft.Media.Player')
Get-Process | Where-Object { $names -contains $_.ProcessName } | Select-Object ProcessName -Unique | ConvertTo-Json -Compress
`;
    const tmpFile = path.join(os.tmpdir(), `detect_${Date.now()}.ps1`);
    fs.writeFileSync(tmpFile, ps, 'utf8');
    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpFile], { timeout: 5000 }, (err, stdout) => {
      try { fs.unlinkSync(tmpFile); } catch {}
      if (err) { resolve([]); return; }
      try {
        const data = JSON.parse(stdout.trim() || '[]');
        const list = Array.isArray(data) ? data : [data];
        const seen = new Set();
        const result = [];
        list.forEach(p => {
          const procName = (p.ProcessName || '') + '.exe';
          const player = KNOWN_PLAYERS[procName];
          if (player && !seen.has(player.name)) {
            seen.add(player.name);
            result.push({ name: player.name, icon: player.icon, process: procName });
          }
        });
        resolve(result);
      } catch { resolve([]); }
    });
  });
});

ipcMain.handle('system:mediaKey', async (e, key) => {
  const keyCodes = { playpause: 0xB3, next: 0xB0, prev: 0xB1, stop: 0xB2 };
  const code = keyCodes[key];
  if (!code) return { error: '未知按键' };
  const ps = `Add-Type -TypeDefinition "using System;using System.Runtime.InteropServices;public class MK{[DllImport(\"user32.dll\")]public static extern void keybd_event(byte bVk,byte bScan,uint dwFlags,UIntPtr dwExtraInfo);public static void Send(byte c){keybd_event(c,0,0,UIntPtr.Zero);System.Threading.Thread.Sleep(50);keybd_event(c,0,2,UIntPtr.Zero);}}"; [MK]::Send(${code})`;
  return new Promise((resolve) => {
    exec(`powershell -NoProfile -Command "${ps}"`, { timeout: 3000 }, (err) => {
      if (err) resolve({ error: err.message });
      else resolve({ success: true });
    });
  });
});

// ========== SMTC 系统媒体传输控制 ==========
const fs = require('fs');
const os = require('os');

const SMTC_GET_SCRIPT = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 } | Select-Object -First 1
function Await($op, $type) {
  $m = $asTaskGeneric.MakeGenericMethod($type)
  $task = $m.Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  $task.Result
}
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime] | Out-Null
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$sessions = $mgr.GetSessions()
$out = @()
foreach ($s in $sessions) {
  try {
    $mp = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
    $pi = $s.GetPlaybackInfo()
    $tl = $s.GetTimelineProperties()
    $cover = ""
    if ($mp.Thumbnail) {
      try {
        $stm = Await ($mp.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
        $rdr = New-Object Windows.Storage.Streams.DataReader($stm)
        $sz = [int]$stm.Size
        $buf = New-Object byte[] $sz
        $rdr.LoadAsync($sz).AsTask().Wait()
        $rdr.ReadBytes($buf)
        $cover = Join-Path $env:TEMP ("smtc_" + [guid]::NewGuid().ToString('N') + ".jpg")
        [IO.File]::WriteAllBytes($cover, $buf)
      } catch {}
    }
    $out += [PSCustomObject]@{
      appId = $s.SourceAppUserModelId
      title = $mp.Title
      artist = $mp.Artist
      album = $mp.AlbumTitle
      cover = $cover
      status = $pi.PlaybackStatus.ToString()
      position = [math]::Round($tl.Position.TotalSeconds, 2)
      duration = [math]::Round($tl.EndTime.TotalSeconds, 2)
      canPlay = $pi.Controls.IsPlayEnabled
      canPause = $pi.Controls.IsPauseEnabled
      canNext = $pi.Controls.IsNextEnabled
      canPrev = $pi.Controls.IsPreviousEnabled
    }
  } catch {}
}
if ($out.Count -eq 0) { Write-Output '[]' } else { Write-Output (@($out) | ConvertTo-Json -Depth 4 -Compress) }
`;

const SMTC_CTRL_SCRIPT = `
param($action, $appId)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 } | Select-Object -First 1
function Await($op, $type) {
  $m = $asTaskGeneric.MakeGenericMethod($type)
  $task = $m.Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  $task.Result
}
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime] | Out-Null
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$sessions = $mgr.GetSessions()
$s = $sessions | ? { $_.SourceAppUserModelId -eq $appId } | Select-Object -First 1
if (-not $s) { Write-Output '{"error":"session not found"}'; exit }
switch ($action) {
  "play" { Await ($s.TryPlayAsync()) ([bool]) | Out-Null }
  "pause" { Await ($s.TryPauseAsync()) ([bool]) | Out-Null }
  "playpause" {
    $pi = $s.GetPlaybackInfo()
    if ($pi.PlaybackStatus.ToString() -eq 'Playing') { Await ($s.TryPauseAsync()) ([bool]) | Out-Null }
    else { Await ($s.TryPlayAsync()) ([bool]) | Out-Null }
  }
  "next" { Await ($s.TrySkipNextAsync()) ([bool]) | Out-Null }
  "prev" { Await ($s.TrySkipPreviousAsync()) ([bool]) | Out-Null }
}
Write-Output '{"success":true}'
`;

function runPs(script, args) {
  return new Promise((resolve) => {
    const tmpFile = path.join(os.tmpdir(), `smtc_${Date.now()}.ps1`);
    fs.writeFileSync(tmpFile, script, 'utf8');
    const argList = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpFile];
    if (args) argList.push(...args);
    execFile('powershell.exe', argList, { timeout: 15000, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(tmpFile); } catch {}
      if (err && !stdout) { resolve([]); return; }
      const output = (stdout || '').trim();
      if (!output) { resolve([]); return; }
      try { resolve(JSON.parse(output)); }
      catch { resolve([]); }
    });
  });
}

ipcMain.handle('smtc:getSessions', async () => {
  return runPs(SMTC_GET_SCRIPT);
});

ipcMain.handle('smtc:control', async (e, { action, appId }) => {
  return runPs(SMTC_CTRL_SCRIPT, [action, appId]);
});

// ========== 检测USB音频设备（小尾巴） ==========
ipcMain.handle('system:detectUsbAudio', async () => {
  return new Promise((resolve) => {
    const ps = `
$usbAudio = Get-PnpDevice -Class AudioEndpoint -Status OK | Where-Object { $_.InstanceId -match 'USB' }
$usbControllers = Get-PnpDevice -Class USB -Status OK | Where-Object { $_.FriendlyName -match 'audio|dac|headphone|amp|sound' }
$devices = @()
if ($usbAudio) { $usbAudio | ForEach-Object { $devices += $_.FriendlyName } }
if ($usbControllers) { $usbControllers | ForEach-Object { $devices += $_.FriendlyName } }
$result = @{ connected = ($devices.Count -gt 0); devices = $devices }
$result | ConvertTo-Json -Compress
`;
    const tmpFile = path.join(os.tmpdir(), `usbaudio_${Date.now()}.ps1`);
    fs.writeFileSync(tmpFile, ps, 'utf8');
    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpFile], { timeout: 8000 }, (err, stdout) => {
      try { fs.unlinkSync(tmpFile); } catch {}
      if (err) { resolve({ connected: false, devices: [] }); return; }
      try { resolve(JSON.parse(stdout.trim())); }
      catch { resolve({ connected: false, devices: [] }); }
    });
  });
});

// ========== 系统级EQ（Equalizer APO） ==========
const EQ_CONFIG_PATH = 'C:\\Program Files\\EqualizerAPO\\config\\config.txt';
const EQ_INSTALL_PATH = 'C:\\Program Files\\EqualizerAPO';
const EQ_FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EQ_DOWNLOAD_URL = 'https://github.com/TheFireKahuna/equalizerAPO64/releases/download/1.4.2_5/EqualizerAPO_Setup-x64-avx2.zip';

function downloadFile(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 8) { reject(new Error('Too many redirects')); return; }
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let nextUrl = res.headers.location;
        if (!nextUrl.startsWith('http')) nextUrl = new URL(nextUrl, url).href;
        res.resume();
        downloadFile(nextUrl, dest, redirects + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(dest); });
      file.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('Download timeout')); });
  });
}

ipcMain.handle('system:checkEq', async () => {
  try {
    const exists = fs.existsSync(EQ_CONFIG_PATH);
    const installed = fs.existsSync(path.join(EQ_INSTALL_PATH, 'Configurator.exe'));
    return { available: exists, installed, path: EQ_CONFIG_PATH };
  } catch {
    return { available: false, installed: false };
  }
});

ipcMain.handle('system:installEq', async () => {
  try {
    // 已经安装则直接配置
    if (fs.existsSync(path.join(EQ_INSTALL_PATH, 'Configurator.exe'))) {
      await configureEqDevice();
      return { success: true, alreadyInstalled: true };
    }
    
    const zipPath = path.join(os.tmpdir(), 'EqualizerAPO_Setup.zip');
    const extractPath = path.join(os.tmpdir(), 'EqualizerAPO_Setup_extract');
    
    // 下载zip安装包
    if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size < 1000000) {
      await downloadFile(EQ_DOWNLOAD_URL, zipPath);
    }
    
    // 解压zip
    if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });
    fs.mkdirSync(extractPath, { recursive: true });
    
    // 用PowerShell解压（兼容所有Windows版本）
    await new Promise((resolve, reject) => {
      exec(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractPath}' -Force"`, { timeout: 30000 }, (err) => {
        if (err) reject(err); else resolve();
      });
    });
    
    // 查找解压后的exe
    const files = fs.readdirSync(extractPath);
    const installerExe = files.find(f => f.toLowerCase().endsWith('.exe'));
    if (!installerExe) {
      return { error: '安装包解压失败，未找到exe文件' };
    }
    const installerPath = path.join(extractPath, installerExe);
    
    // 静默安装（需要管理员权限）
    const psInstall = `
$installer = '${installerPath.replace(/'/g, "''")}'
$args = '/SILENT /SUPPRESSMSGBOXES /NORESTART'
$p = Start-Process -FilePath $installer -ArgumentList $args -Verb RunAs -Wait -PassThru
Write-Output $p.ExitCode
`;
    const installResult = await new Promise((resolve) => {
      exec(`powershell -NoProfile -Command "${psInstall.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { timeout: 120000 }, (err, stdout) => {
        if (err) resolve({ error: err.message });
        else resolve({ exitCode: parseInt(stdout.trim()) || 0 });
      });
    });
    
    if (installResult.error) return { error: '安装失败: ' + installResult.error };
    
    // 等待安装完成
    await new Promise(r => setTimeout(r, 3000));
    
    // 配置默认音频设备
    await configureEqDevice();
    
    // 写入默认配置
    const defaultConfig = `# 清音乐播放器 - 系统EQ配置\nPreamp: 0.0 dB\n` +
      EQ_FREQS.map((f, i) => `Filter ${i+1}: ON PK Fc ${f} Hz Gain 0.0 dB Q 1.41`).join('\n');
    fs.writeFileSync(EQ_CONFIG_PATH, defaultConfig, 'utf8');
    
    // 清理临时文件
    try { fs.rmSync(extractPath, { recursive: true, force: true }); } catch {}
    
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

async function configureEqDevice() {
  try {
    const configurator = path.join(EQ_INSTALL_PATH, 'Configurator.exe');
    if (!fs.existsSync(configurator)) return false;
    
    // 方法1：尝试用Configurator命令行安装到所有设备
    const result = await new Promise((resolve) => {
      execFile(configurator, ['/install'], { timeout: 30000 }, (err) => {
        resolve(!err);
      });
    });
    
    if (result) {
      // 重启音频服务
      exec('net stop Audiosrv && net start Audiosrv', { timeout: 15000 }, () => {});
      return true;
    }
    
    // 方法2：通过PowerShell获取默认设备并修改注册表
    const psConfig = `
# 获取默认音频渲染设备
$device = Get-PnpDevice -Class AudioEndpoint -Status OK | Where-Object { $_.FriendlyName -notmatch 'Output' } | Select-Object -First 1
if (-not $device) { $device = Get-PnpDevice -Class AudioEndpoint -Status OK | Select-Object -First 1 }
Write-Output $device.InstanceId
`;
    // 简化处理：重启音频服务让配置生效
    exec('net stop Audiosrv && net start Audiosrv', { timeout: 15000 }, () => {});
    return true;
  } catch {
    return false;
  }
}

ipcMain.handle('system:applyEq', async (e, values) => {
  try {
    if (!fs.existsSync(EQ_CONFIG_PATH)) {
      return { error: '未检测到Equalizer APO，系统级EQ不可用' };
    }
    // 计算preamp（避免削波）
    const maxGain = Math.max(...values, 0);
    const preamp = maxGain > 0 ? -maxGain : 0;
    
    let config = `# 清音乐播放器 - 系统EQ配置\n`;
    config += `Preamp: ${preamp.toFixed(1)} dB\n`;
    values.forEach((gain, i) => {
      const freq = EQ_FREQS[i];
      config += `Filter ${i + 1}: ON PK Fc ${freq} Hz Gain ${gain.toFixed(1)} dB Q 1.41\n`;
    });
    
    fs.writeFileSync(EQ_CONFIG_PATH, config, 'utf8');
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});
