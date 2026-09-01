/**
 * store.js — 集中式状态管理
 * 统一管理播放状态、播放列表、EQ 参数、用户信息等，
 * 支持按 key 订阅变更，便于调试与状态同步。
 */
import { eventBus } from './eventBus.js';

const initialState = {
  // 播放相关
  localTracks: [],
  localVideos: [],
  localImages: [],
  localBooks: [],
  searchResults: [],
  currentQueue: [],
  currentIndex: -1,
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  quality: 'standard',
  // 播放模式：list 列表循环 / single 单曲循环 / shuffle 随机 / smart 心动
  playMode: 'list',
  // 收藏夹 / 播放历史
  favorites: [],
  history: [],
  // 睡眠定时（剩余毫秒）
  sleepTimerRemaining: 0,
  // 桌面歌词 / 迷你模式
  lyricDesktopOn: false,
  miniMode: false,
  // 队列面板可见
  queueVisible: false,

  // 界面
  platform: 'netease',
  view: 'local',
  userInfo: null,

  // 歌词
  lyricData: [],
  currentLyricIndex: -1,

  // EQ
  eqValues: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  tapeEnabled: false,
  usbAudioConnected: false,

  // 天气
  currentWeather: null,

  // 其他播放器（SMTC）
  smtcSessions: [],
  currentSmtcSession: null,
  systemEqAvailable: false,
  opdEqValues: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
};

class Store {
  constructor() {
    this.state = {};
    Object.keys(initialState).forEach((key) => {
      this.state[key] = Array.isArray(initialState[key])
        ? [...initialState[key]]
        : (initialState[key] && typeof initialState[key] === 'object')
          ? { ...initialState[key] }
          : initialState[key];
    });
  }

  /**
   * 读取状态
   * @param {string} key
   * @returns {*}
   */
  get(key) {
    return this.state[key];
  }

  /**
   * 设置状态并广播变更事件
   * @param {string} key 状态键
   * @param {*} value 新值
   * @returns {*} 传入的新值
   */
  set(key, value) {
    const old = this.state[key];
    this.state[key] = value;
    if (old !== value) {
      eventBus.emit(`store:${key}`, { value, old });
      eventBus.emit('store:change', { key, value, old });
    }
    return value;
  }

  /**
   * 订阅指定状态变更
   * @param {string} key 状态键
   * @param {Function} handler (payload) => void
   * @returns {Function} 取消订阅
   */
  subscribe(key, handler) {
    return eventBus.on(`store:${key}`, handler);
  }
}

export const store = new Store();
export default store;
