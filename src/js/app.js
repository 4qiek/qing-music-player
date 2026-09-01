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

  // 4. 状态订阅：播放状态 → 通知
  store.subscribe('isPlaying', ({ value }) => {
    eventBus.emit('playing:change', value);
  });

  // 5. 初始渲染
  renderLocalList();
  switchView('local');

  // 6. 磁带模式开关（底部/左栏）
  const tapeToggle = document.getElementById('tapeToggle');
  if (tapeToggle) {
    tapeToggle.addEventListener('click', () => {
      audioEngine.toggleTapeEffect(audio);
    });
  }
  // 磁带状态同步 UI
  store.subscribe('tapeEnabled', ({ value }) => {
    document.querySelectorAll('.tape-indicator').forEach((el) => {
      el.classList.toggle('active', value);
      el.textContent = value ? '磁带模式' : '';
    });
    if (tapeToggle) tapeToggle.classList.toggle('active', value);
  });

  // 7. 音质菜单
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
