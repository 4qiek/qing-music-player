/**
 * app.js — 应用入口
 * 负责模块装配与初始化、视图切换入口、启动流程编排。
 */
import { store } from './store.js';
import { eventBus } from './eventBus.js';
import { switchView, initNavigation } from './view.js';
import * as player from './player.js';
import { initSearch } from './search.js';
import { initLocalLibrary, renderLocalList } from './localLibrary.js';
import { initEq } from './eq.js';
import { initWeather } from './weather.js';
import { initLogin } from './login.js';
import { initCityPoem } from './cityPoem.js';
import {
  initTheme,
  initKeyboardShortcuts,
  initGlobalErrorHandler,
  showShortcutHint,
  toast
} from './ui.js';
import * as audioEngine from './audioEngine.js';
import { initDiscover } from './discover.js';
import { initFavorites } from './favorites.js';
import { initHistory } from './history.js';
import { initQueue } from './queue.js';
import { initSleepTimer } from './sleepTimer.js';
import { initMini } from './mini.js';
import { initDesktopLyric, toggleDesktopLyric } from './desktopLyric.js';
import * as visualizer from './visualizer.js';
import { initVideo } from './video.js';
import { initBrowser } from './browser.js';

export { switchView };

export function initApp() {
  // 1. 基础设施
  initGlobalErrorHandler();
  initTheme();
  initKeyboardShortcuts();
  showShortcutHint();

  // 2. 音频引擎
  const audio = document.getElementById('audio');
  audioEngine.startUsbAudioWatch(audio);

  // 3. 各功能模块
  initNavigation();
  initSearch();
  initLocalLibrary();
  initEq();
  initWeather();
  initCityPoem();
  initLogin();
  player.initAudioEvents();

  // 4. 新功能模块
  player.loadFavorites();
  player.loadHistory();
  player.renderPlayMode();
  initDiscover();
  initFavorites();
  initHistory();
  initQueue();
  initSleepTimer();
  initMini();
  initDesktopLyric();
  initVideo();
  initBrowser();

  // 播放模式切换
  const modeBtn = document.getElementById('playModeBtn');
  if (modeBtn) modeBtn.addEventListener('click', player.cyclePlayMode);

  // 收藏按钮（主面板 + 详情页）
  const favBtn = document.getElementById('favBtn');
  if (favBtn) favBtn.addEventListener('click', () => player.toggleFavorite(store.get('currentTrack')));
  const pdFavBtn = document.getElementById('pdFavBtn');
  if (pdFavBtn) pdFavBtn.addEventListener('click', () => player.toggleFavorite(store.get('currentTrack')));

  // 相似歌曲推荐
  const simiBtn = document.getElementById('simiBtn');
  if (simiBtn) simiBtn.addEventListener('click', () => player.addSimilar(store.get('currentTrack')));

  // 频谱可视化：播放详情页开关时启停
  const detail = document.getElementById('playerDetail');
  if (detail && typeof MutationObserver !== 'undefined') {
    new MutationObserver(() => {
      if (detail.classList.contains('show')) visualizer.startVisualizer();
      else visualizer.stopVisualizer();
    }).observe(detail, { attributes: true, attributeFilter: ['class'] });
  }

  // 系统托盘动作
  if (window.qingAPI && window.qingAPI.onTrayAction) {
    window.qingAPI.onTrayAction((action) => {
      if (action === 'playpause') player.togglePlay();
      else if (action === 'next') player.nextTrack();
      else if (action === 'prev') player.prevTrack();
      else if (action === 'lyric') toggleDesktopLyric();
    });
  }

  // 5. 状态订阅：播放状态 → 通知
  store.subscribe('isPlaying', ({ value }) => {
    eventBus.emit('playing:change', value);
  });

  // 6. 初始渲染
  renderLocalList();
  switchView('local');

  // 7. 磁带模式开关
  const tapeToggle = document.getElementById('tapeToggle');
  if (tapeToggle) {
    tapeToggle.addEventListener('click', () => {
      audioEngine.toggleTapeEffect(audio);
    });
  }
  store.subscribe('tapeEnabled', ({ value }) => {
    document.querySelectorAll('.tape-indicator').forEach((el) => {
      el.classList.toggle('active', value);
      el.textContent = value ? '磁带模式' : '';
    });
    if (tapeToggle) tapeToggle.classList.toggle('active', value);
  });

  // 8. 音质菜单
  initQualityMenu();

  // 启动就绪
  console.log('[app] 清·音乐播放器 初始化完成');
}

function initQualityMenu() {
  const qualityBtn = document.getElementById('qualityBtn');
  const qualityMenu = document.getElementById('qualityMenu');
  qualityBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    qualityMenu.classList.toggle('show');
  });
  document.addEventListener('click', () => qualityMenu.classList.remove('show'));
  qualityMenu.querySelectorAll('.q-item').forEach((item) => {
    item.addEventListener('click', async () => {
      qualityMenu.querySelectorAll('.q-item').forEach((i) => i.classList.remove('active'));
      item.classList.add('active');
      qualityBtn.innerHTML = item.textContent + ' <span style="font-size:8px">▼</span>';
      await player.switchQuality(item.dataset.level);
      qualityMenu.classList.remove('show');
    });
  });
}

// 启动
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});
