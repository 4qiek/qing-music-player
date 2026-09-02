/**
 * cityPoem.js — 城市诗句卡片
 * 联网获取诗词（今日诗词 API），根据当前天气描述匹配诗词分类。
 * 每 20 秒自动刷新，点击卡片也可手动刷新。
 */
import { store } from './store.js';

const REFRESH_INTERVAL = 20000;
let timer = null;
let loading = false;
let lastContent = '';

/** 天气描述 → 诗词分类 */
function categoryByWeather(desc) {
  if (!desc) return '';
  const d = desc.toLowerCase();
  if (desc.includes('雷') || desc.includes('雨') || d.includes('rain') || d.includes('thunder') || d.includes('drizzle') || d.includes('shower')) {
    return '古诗文-景物-天气-雨';
  }
  if (desc.includes('雪') || d.includes('snow') || d.includes('sleet')) {
    return '古诗文-四季-冬天';
  }
  if (desc.includes('云') || desc.includes('阴') || d.includes('cloud') || d.includes('overcast')) {
    return '古诗文-景物-天气-云';
  }
  if (desc.includes('风') || d.includes('wind') || d.includes('breeze')) {
    return '古诗文-景物-天气-风';
  }
  if (desc.includes('晴') || d.includes('sun') || d.includes('clear')) {
    return '古诗文-四季-秋天';
  }
  return '';
}

function getCity() {
  const w = store.get('currentWeather');
  return (w && w.city) || '扬州';
}

async function fetchPoem(textEl, fromEl, cityEl) {
  if (loading) return;
  loading = true;
  const w = store.get('currentWeather');
  const category = categoryByWeather(w && w.desc);
  try {
    const res = await window.qingAPI.getPoem(category);
    if (!res || res.error || !res.content) {
      if (!lastContent) textEl.textContent = '诗句获取失败，点击重试';
    } else if (res.content !== lastContent) {
      lastContent = res.content;
      textEl.textContent = res.content;
      const from = [res.author, res.origin].filter(Boolean).join(' · ');
      fromEl.textContent = from ? `—— ${from}` : '';
    }
  } catch {
    if (!lastContent) textEl.textContent = '诗句获取失败，点击重试';
  } finally {
    loading = false;
  }
}

export function initCityPoem() {
  const el = document.getElementById('cityPoem');
  if (!el) return;
  const cityEl = el.querySelector('.cp-city');
  const textEl = el.querySelector('.cp-text');
  const fromEl = el.querySelector('.cp-from');

  function syncCity() {
    cityEl.textContent = getCity();
  }
  function refresh() {
    syncCity();
    fetchPoem(textEl, fromEl, cityEl);
  }

  refresh();

  // 点击卡片刷新
  el.addEventListener('click', refresh);

  // 每 20 秒自动刷新
  if (timer) clearInterval(timer);
  timer = setInterval(refresh, REFRESH_INTERVAL);

  // 天气城市/描述变化时立即刷新
  store.subscribe('currentWeather', refresh);
}

export default { initCityPoem };
