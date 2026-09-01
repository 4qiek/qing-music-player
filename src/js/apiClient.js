/**
 * apiClient.js — 网络请求统一封装
 * 职责：
 *  1. 统一调用 window.qingAPI（preload 暴露的 IPC 桥）
 *  2. 对读类请求做 sessionStorage 本地缓存，避免重复请求
 *  3. 网络失败自动重试（最多 3 次）
 */
import { cacheGet, cacheSet, retry, sleep } from './utils.js';

const api = window.qingAPI;

/** 读类请求的缓存 TTL（毫秒） */
const CACHE_TTL = {
  search: 5 * 60 * 1000,      // 搜索 5 分钟
  lyric: 30 * 60 * 1000,      // 歌词 30 分钟
  detail: 10 * 60 * 1000,
  playlist: 10 * 60 * 1000,
  playlistDetail: 10 * 60 * 1000,
  weather: 15 * 60 * 1000,    // 天气 15 分钟
  hot: 10 * 60 * 1000
};

/**
 * 带重试地调用 IPC 方法
 * @param {Function} invoke 返回 Promise 的调用
 * @param {object} opts
 */
async function withRetry(invoke, opts = {}) {
  const { maxRetries = 3 } = opts;
  return retry(invoke, {
    maxRetries,
    baseDelay: 500,
    // 明确返回 error 字段的业务失败不重试；网络/系统异常才重试
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
  neteaseSearch(keyword, opts = {}) {
    const key = `cache:netease:search:${keyword}`;
    return cachedRequest(key, () => api.neteaseSearch(keyword), 'search', opts);
  },

  neteaseUrl(data, opts = {}) {
    // 播放地址带时效性，不缓存
    return withRetry(() => api.neteaseUrl(data), opts);
  },

  neteaseDetail(ids, opts = {}) {
    const key = `cache:netease:detail:${Array.isArray(ids) ? ids.join(',') : ids}`;
    return cachedRequest(key, () => api.neteaseDetail(ids), 'detail', opts);
  },

  neteaseLyric(id, opts = {}) {
    const key = `cache:netease:lyric:${id}`;
    return cachedRequest(key, () => api.neteaseLyric(id), 'lyric', opts);
  },

  neteaseLogin(data) {
    return withRetry(() => api.neteaseLogin(data), { maxRetries: 1 });
  },

  neteasePlaylist(uid, opts = {}) {
    const key = `cache:netease:playlist:${uid}`;
    return cachedRequest(key, () => api.neteasePlaylist(uid), 'playlist', opts);
  },

  neteasePlaylistDetail(id, opts = {}) {
    const key = `cache:netease:playlistDetail:${id}`;
    return cachedRequest(key, () => api.neteasePlaylistDetail(id), 'playlistDetail', opts);
  },

  // ========== QQ音乐 ==========
  qqSearch(keyword, opts = {}) {
    const key = `cache:qq:search:${keyword}`;
    return cachedRequest(key, () => api.qqSearch(keyword), 'search', opts);
  },

  qqUrl(songmid, opts = {}) {
    return withRetry(() => api.qqUrl(songmid), opts);
  },

  // ========== 酷狗 ==========
  kugouSearch(keyword, opts = {}) {
    const key = `cache:kugou:search:${keyword}`;
    return cachedRequest(key, () => api.kugouSearch(keyword), 'search', opts);
  },

  kugouUrl(hash, albumId, opts = {}) {
    return withRetry(() => api.kugouUrl(hash, albumId), opts);
  },

  // ========== 天气 ==========
  getWeather(city, opts = {}) {
    const target = city || '扬州';
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
