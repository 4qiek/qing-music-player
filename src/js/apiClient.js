/**
 * apiClient.js — 网络请求统一封装
 * 职责：
 *  1. 统一调用 window.qingAPI（preload 暴露的 IPC 桥）
 *  2. 对读类请求做 sessionStorage 本地缓存，避免重复请求
 *  3. 网络失败自动重试（最多 3 次）
 */
import { cacheGet, cacheSet, retry, sleep } from './utils.js';
import { store } from './store.js';

const api = window.qingAPI;

/** 读类请求的缓存 TTL（毫秒） */
const CACHE_TTL = {
  search: 5 * 60 * 1000,      // 匹配搜索 5 分钟
  lyric: 30 * 60 * 1000,      // 歌词 30 分钟
  weather: 15 * 60 * 1000     // 天气 15 分钟
};

/**
 * 带重试地调用 IPC 方法
 * @param {Function} invoke 返回 Promise 的调用
 * @param {object} opts
 */
async function withRetry(invoke, opts = {}) {
  const { maxRetries = 3, timeout = 15000 } = opts;
  return retry(() => Promise.race([
    invoke(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('请求超时，请检查网络连接')), timeout))
  ]), {
    maxRetries,
    baseDelay: 500,
    shouldRetry: (err) => !(err && err.message && err.message.startsWith('业务'))
  });
}

/**
 * 读取带缓存的请求结果
 * @param {string} cacheKey 缓存键
 * @param {Function} fetcher 实际请求函数（返回 Promise<结果对象>）
 * @param {string} kind 缓存类型（决定 TTL）
 * @param {object} opts { force, maxRetries }
 */
async function cachedRequest(cacheKey, fetcher, kind = 'search', opts = {}) {
  const { force = false, maxRetries = 3 } = opts;
  if (!force) {
    const hit = cacheGet(cacheKey);
    if (hit !== null) return hit;
  }

  const result = await withRetry(() => fetcher(), { maxRetries });

  // 只有成功（无 error 字段）的结果才缓存
  if (result && !result.error) {
    cacheSet(cacheKey, result, CACHE_TTL[kind] || CACHE_TTL.search);
  }
  return result;
}

export const apiClient = {
  // ========== 网易云 ==========
  // 在线音乐功能已移除，这里只保留两个「本地增强」能力：
  //  1) 搜索：本地曲目按歌名匹配歌手 / 专辑 / 封面（localLibrary.matchLocal / matchAllLocal）
  neteaseSearch(keyword, opts = {}) {
    const key = `cache:netease:search:${keyword}`;
    return cachedRequest(key, () => api.neteaseSearch(keyword), 'search', opts);
  },

  //  2) 歌词：本地曲目匹配到 matchedId 后拉取在线歌词（lyric.loadLyric）
  neteaseLyric(id, opts = {}) {
    const key = `cache:netease:lyric:${id}`;
    return cachedRequest(key, () => api.neteaseLyric(id), 'lyric', opts);
  },

  // ========== 通用元数据（豆瓣：kind=book 书籍 / movie 影视） ==========
  metaSuggest(keyword, kind = 'movie', opts = {}) {
    const key = `cache:meta:suggest:${kind}:${keyword}`;
    return cachedRequest(key, () => api.metaSuggest(keyword, kind), 'search', opts);
  },

  // ========== 天气 ==========
  getWeather(city, opts = {}) {
    const target = city || store.get('weatherCity') || '扬州';
    const key = `cache:weather:${target}`;
    return cachedRequest(key, () => api.getWeather(target), 'weather', opts);
  },

  // ========== 系统控制 ==========
  detectPlayers() {
    return withRetry(() => api.detectPlayers(), { maxRetries: 1 });
  },
  mediaKey(key) {
    return api.mediaKey(key);
  },
  detectUsbAudio() {
    return withRetry(() => api.detectUsbAudio(), { maxRetries: 1 });
  },
  getSmtcSessions() {
    return withRetry(() => api.getSmtcSessions(), { maxRetries: 1 });
  },
  smtcControl(action, appId) {
    return api.smtcControl(action, appId);
  },
  applySystemEq(values) {
    return api.applySystemEq(values);
  },
  checkEqAvailable() {
    return withRetry(() => api.checkEqAvailable(), { maxRetries: 1 });
  },
  installSystemEq() {
    return api.installSystemEq();
  },

  /** 缓存清理 */
  clearCache() {
    try {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith('cache:'))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch (e) { /* ignore */ }
  }
};

export default apiClient;
