/**
 * utils.js — 通用工具函数
 */

/** 平台短标签（用于列表角标） */
export const PLATFORM_LABEL = { netease: '网易', qq: 'QQ', kugou: '酷狗', local: '本地' };

/** 平台全称（用于标题/提示） */
export const PLATFORM_NAME = { netease: '网易云音乐', qq: 'QQ音乐', kugou: '酷狗音乐', local: '本地音乐' };

/**
 * 秒 → mm:ss
 * @param {number} s 秒
 * @returns {string}
 */
export function formatTime(s) {
  if (!s || isNaN(s)) return '00:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

/**
 * 防抖函数
 * @param {Function} fn
 * @param {number} wait 毫秒
 * @returns {Function}
 */
export function debounce(fn, wait = 300) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * 节流函数
 * @param {Function} fn
 * @param {number} limit 毫秒
 * @returns {Function}
 */
export function throttle(fn, limit = 100) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= limit) {
      last = now;
      fn.apply(this, args);
    }
  };
}

/**
 * 网络请求自动重试（最多 maxRetries 次，指数退避）
 * @param {Function} fn 返回 Promise 的函数
 * @param {object} options
 * @param {number} options.maxRetries 最大重试次数
 * @param {number} options.baseDelay 基础延迟(ms)
 * @param {Function} options.shouldRetry 判断是否值得重试
 * @returns {Promise<*>}
 */
export async function retry(fn, { maxRetries = 3, baseDelay = 600, shouldRetry = () => true } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt === maxRetries || !shouldRetry(err)) break;
      const delay = baseDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
  throw lastErr;
}

/**
 * 等待
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 数字格式化（万/亿）
 * @param {number} n
 * @returns {string}
 */
export function formatNum(n) {
  if (!n && n !== 0) return '0';
  if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '亿';
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
  return String(n);
}

/**
 * HTML 转义，防止 XSS
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 保存值到 sessionStorage（带过期时间，单位 ms）
 * @param {string} key
 * @param {*} value
 * @param {number} ttl 毫秒，默认 10 分钟
 */
export function cacheSet(key, value, ttl = 10 * 60 * 1000) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ v: value, exp: Date.now() + ttl }));
  } catch (e) {
    /* 存储不可用时静默降级 */
  }
}

/**
 * 读取 sessionStorage 缓存（过期返回 null）
 * @param {string} key
 * @returns {*|null}
 */
export function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { v, exp } = JSON.parse(raw);
    if (Date.now() > exp) {
      sessionStorage.removeItem(key);
      return null;
    }
    return v;
  } catch (e) {
    return null;
  }
}

/**
 * 全局 Promise 异常安全包装：记录并触发全局错误事件
 * @param {Promise} p
 * @returns {Promise}
 */
export function safePromise(p) {
  return Promise.resolve(p).catch((err) => {
    window.dispatchEvent(new CustomEvent('app:error', { detail: err }));
    throw err;
  });
}
