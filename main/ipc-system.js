/**
 * main/ipc-system.js — 系统相关 IPC（天气 / 媒体键 / SMTC / USB音频 / 系统EQ）
 */
const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec, execFile } = require('child_process');
const { httpGet } = require('./shared');

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

// ========== SMTC PowerShell 脚本 ==========
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
      try { resolve(JSON.parse(output)); } catch { resolve([]); }
    });
  });
}

// ========== 系统 EQ 常量 ==========
const EQ_CONFIG_PATH = 'C:\\Program Files\\EqualizerAPO\\config\\config.txt';
const EQ_INSTALL_PATH = 'C:\\Program Files\\EqualizerAPO';
const EQ_FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EQ_DOWNLOAD_URL = 'https://github.com/TheFireKahuna/equalizerAPO64/releases/download/1.4.2_5/EqualizerAPO_Setup-x64-avx2.zip';

function downloadFile(url, dest, redirects = 0) {
  const https = require('https');
  const http = require('http');
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

async function configureEqDevice() {
  try {
    const configurator = path.join(EQ_INSTALL_PATH, 'Configurator.exe');
    if (!fs.existsSync(configurator)) return false;
    const result = await new Promise((resolve) => {
      execFile(configurator, ['/install'], { timeout: 30000 }, (err) => { resolve(!err); });
    });
    if (result) { exec('net stop Audiosrv && net start Audiosrv', { timeout: 15000 }, () => {}); return true; }
    exec('net stop Audiosrv && net start Audiosrv', { timeout: 15000 }, () => {});
    return true;
  } catch { return false; }
}

module.exports = function initSystemIpc(state) {
  // ========== 天气 ==========
  ipcMain.handle('weather:get', async (e, city) => {
    try {
      const targetCity = city || '扬州';
      const url = `https://wttr.in/${encodeURIComponent(targetCity)}?format=j1&lang=zh`;
      const res = await httpGet(url);
      const data = JSON.parse(res.body);
      const current = data?.current_condition?.[0];
      const today = data?.weather?.[0];
      const forecast = (data?.weather || []).slice(0, 3).map(d => ({
        date: d.date,
        maxTemp: d.maxtempC,
        minTemp: d.mintempC,
        desc: d?.hourly?.[4]?.lang_zh?.[0]?.value || d?.hourly?.[4]?.weatherDesc?.[0]?.value || ''
      }));
      return {
        city: targetCity, temp: current?.temp_C, feelsLike: current?.FeelsLikeC,
        desc: current?.lang_zh?.[0]?.value || current?.weatherDesc?.[0]?.value,
        humidity: current?.humidity, wind: current?.windspeedKmph, icon: current?.weatherCode,
        todayHigh: today?.maxtempC, todayLow: today?.mintempC, date: today?.date,
        forecast
      };
    } catch (err) { return { error: err.message }; }
  });

  // ========== 在线诗词（今日诗词） ==========
  ipcMain.handle('poem:get', async (e, category) => {
    try {
      const base = 'https://v1.jinrishici.com/all.json';
      const url = category ? `${base}?category=${encodeURIComponent(category)}` : base;
      const res = await httpGet(url);
      const data = JSON.parse(res.body);
      return { content: data.content, origin: data.origin, author: data.author };
    } catch (err) { return { error: err.message }; }
  });
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
            if (player && !seen.has(player.name)) { seen.add(player.name); result.push({ name: player.name, icon: player.icon, process: procName }); }
          });
          resolve(result);
        } catch { resolve([]); }
      });
    });
  });

  // ========== 媒体键 ==========
  ipcMain.handle('system:mediaKey', async (e, key) => {
    const keyCodes = { playpause: 0xB3, next: 0xB0, prev: 0xB1, stop: 0xB2 };
    const code = keyCodes[key];
    if (!code) return { error: '未知按键' };
    const ps = `Add-Type -TypeDefinition "using System;using System.Runtime.InteropServices;public class MK{[DllImport(\"user32.dll\")]public static extern void keybd_event(byte bVk,byte bScan,uint dwFlags,UIntPtr dwExtraInfo);public static void Send(byte c){keybd_event(c,0,0,UIntPtr.Zero);System.Threading.Thread.Sleep(50);keybd_event(c,0,2,UIntPtr.Zero);}}"; [MK]::Send(${code})`;
    return new Promise((resolve) => {
      exec(`powershell -NoProfile -Command "${ps}"`, { timeout: 3000 }, (err) => {
        if (err) resolve({ error: err.message }); else resolve({ success: true });
      });
    });
  });

  // ========== SMTC ==========
  ipcMain.handle('smtc:getSessions', async () => runPs(SMTC_GET_SCRIPT));
  ipcMain.handle('smtc:control', async (e, { action, appId }) => runPs(SMTC_CTRL_SCRIPT, [action, appId]));

  // ========== USB 音频检测 ==========
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
        try { resolve(JSON.parse(stdout.trim())); } catch { resolve({ connected: false, devices: [] }); }
      });
    });
  });

  // ========== 系统级 EQ ==========
  ipcMain.handle('system:checkEq', async () => {
    try {
      return { available: fs.existsSync(EQ_CONFIG_PATH), installed: fs.existsSync(path.join(EQ_INSTALL_PATH, 'Configurator.exe')), path: EQ_CONFIG_PATH };
    } catch { return { available: false, installed: false }; }
  });

  ipcMain.handle('system:installEq', async () => {
    try {
      if (fs.existsSync(path.join(EQ_INSTALL_PATH, 'Configurator.exe'))) {
        await configureEqDevice();
        return { success: true, alreadyInstalled: true };
      }
      // 安装前显式征求用户同意
      const { response } = await dialog.showMessageBox(state.mainWindow, {
        type: 'question',
        buttons: ['确认安装', '取消'],
        defaultId: 1,
        cancelId: 1,
        title: '安装系统级 EQ',
        message: '即将下载并安装 Equalizer APO（系统级音频均衡器）',
        detail: '该软件需要管理员权限，安装后会修改系统音频配置并重启音频服务。是否继续？'
      });
      if (response !== 0) return { error: '用户取消安装' };
      const zipPath = path.join(os.tmpdir(), 'EqualizerAPO_Setup.zip');
      const extractPath = path.join(os.tmpdir(), 'EqualizerAPO_Setup_extract');
      if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size < 1000000) { await downloadFile(EQ_DOWNLOAD_URL, zipPath); }
      if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true });
      fs.mkdirSync(extractPath, { recursive: true });
      await new Promise((resolve, reject) => {
        exec(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractPath}' -Force"`, { timeout: 30000 }, (err) => { if (err) reject(err); else resolve(); });
      });
      const installerExe = fs.readdirSync(extractPath).find(f => f.toLowerCase().endsWith('.exe'));
      if (!installerExe) return { error: '安装包解压失败，未找到exe文件' };
      const installerPath = path.join(extractPath, installerExe);
      const psInstall = `
$installer = '${installerPath.replace(/'/g, "''")}'
$args = '/SILENT /SUPPRESSMSGBOXES /NORESTART'
$p = Start-Process -FilePath $installer -ArgumentList $args -Verb RunAs -Wait -PassThru
Write-Output $p.ExitCode
`;
      const installResult = await new Promise((resolve) => {
        exec(`powershell -NoProfile -Command "${psInstall.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { timeout: 120000 }, (err, stdout) => {
          if (err) resolve({ error: err.message }); else resolve({ exitCode: parseInt(stdout.trim()) || 0 });
        });
      });
      if (installResult.error) return { error: '安装失败: ' + installResult.error };
      await new Promise(r => setTimeout(r, 3000));
      await configureEqDevice();
      const defaultConfig = `# 清 - 系统EQ配置\nPreamp: 0.0 dB\n` + EQ_FREQS.map((f, i) => `Filter ${i+1}: ON PK Fc ${f} Hz Gain 0.0 dB Q 1.41`).join('\n');
      fs.writeFileSync(EQ_CONFIG_PATH, defaultConfig, 'utf8');
      try { fs.rmSync(extractPath, { recursive: true, force: true }); } catch {}
      return { success: true };
    } catch (err) { return { error: err.message }; }
  });

  ipcMain.handle('system:applyEq', async (e, values) => {
    try {
      if (!fs.existsSync(EQ_CONFIG_PATH)) return { error: '未检测到Equalizer APO，系统级EQ不可用' };
      const maxGain = Math.max(...values, 0);
      const preamp = maxGain > 0 ? -maxGain : 0;
      let config = `# 清 - 系统EQ配置\n`;
      config += `Preamp: ${preamp.toFixed(1)} dB\n`;
      values.forEach((gain, i) => {
        config += `Filter ${i + 1}: ON PK Fc ${EQ_FREQS[i]} Hz Gain ${gain.toFixed(1)} dB Q 1.41\n`;
      });
      fs.writeFileSync(EQ_CONFIG_PATH, config, 'utf8');
      return { success: true };
    } catch (err) { return { error: err.message }; }
  });
};
