/**
 * cityPoem.js — 诗句卡片
 * 以城市为主：根据当前城市的地域特征映射到诗词地理分类，
 * 在线获取诗句（今日诗词 API）；城市无法判断时再参考天气，最后随机兜底。
 * 每 20 秒自动刷新，点击卡片也可手动刷新。
 */
import { store } from './store.js';

const REFRESH_INTERVAL = 20000;
let timer = null;
let loading = false;
let lastContent = '';

/** 城市关键词 → 今日诗词地理分类（以城市为主） */
const CITY_CATEGORY_RULES = [
  { cat: '古诗文-地理-江南', keys: ['扬州','南京','苏州','杭州','上海','无锡','常州','镇江','绍兴','嘉兴','湖州','宁波','温州','金华','芜湖','合肥','黄山','南通','泰州','盐城','淮安','徐州','宿迁','连云港','马鞍山','铜陵','池州','宣城','上饶','景德镇'] },
  { cat: '古诗文-地理-楼', keys: ['武汉','岳阳','南昌','永济','黄鹤楼','岳阳楼','滕王阁','鹳雀楼'] },
  { cat: '古诗文-地理-山', keys: ['泰安','泰山','华阴','华山','九江','庐山','衡阳','衡山','登封','嵩山','乐山','峨眉','池州','九华','舟山','普陀','忻州','五台','十堰','武当','张家界','桂林','黄山','武夷','泰安'] },
  { cat: '古诗文-地理-江', keys: ['重庆','宜昌','荆州','泸州','宜宾','哈尔滨','吉林','长沙','宜昌','万州','涪陵','九江','芜湖','南京','镇江'] },
  { cat: '古诗文-地理-关塞', keys: ['西安','长安','兰州','敦煌','酒泉','张掖','武威','银川','乌鲁木齐','呼和浩特','大同','包头','咸阳','宝鸡','天水','西宁','嘉峪关','榆林','延安','汉中'] },
  { cat: '古诗文-地理-名胜', keys: ['北京','洛阳','开封','成都','广州','深圳','天津','青岛','厦门','泉州','大理','丽江','苏州','杭州','承德','保定'] }
];

/** 天气描述 → 诗词分类（城市无法判断时的辅助） */
function categoryByWeather(desc) {
  if (!desc) return '';
  const d = desc.toLowerCase();
  if (desc.includes('雷') || desc.includes('雨') || d.includes('rain') || d.includes('thunder') || d.includes('drizzle') || d.includes('shower')) return '古诗文-景物-天气-雨';
  if (desc.includes('雪') || d.includes('snow') || d.includes('sleet')) return '古诗文-四季-冬天';
  if (desc.includes('云') || desc.includes('阴') || d.includes('cloud') || d.includes('overcast')) return '古诗文-景物-天气-云';
  if (desc.includes('风') || d.includes('wind') || d.includes('breeze')) return '古诗文-景物-天气-风';
  if (desc.includes('晴') || d.includes('sun') || d.includes('clear')) return '古诗文-四季-秋天';
  return '';
}

function getCity() {
  const w = store.get('currentWeather');
  return (w && w.city) || '扬州';
}

/** 以城市为主决定分类 */
function categoryByCity(city) {
  if (!city) return '';
  for (const rule of CITY_CATEGORY_RULES) {
    if (rule.keys.some((k) => city.includes(k) || k.includes(city))) return rule.cat;
  }
  return '古诗文-地理-城市';
}

async function fetchPoem(textEl, fromEl) {
  if (loading) return;
  loading = true;
  const w = store.get('currentWeather');
  const city = (w && w.city) || '扬州';
  // 以城市为主，天气为辅
  const category = categoryByCity(city) || categoryByWeather(w && w.desc) || '';
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
  const textEl = el.querySelector('.cp-text');
  const fromEl = el.querySelector('.cp-from');

  function refresh() { fetchPoem(textEl, fromEl); }

  refresh();

  // 点击卡片刷新
  el.addEventListener('click', refresh);

  // 每 20 秒自动刷新
  if (timer) clearInterval(timer);
  timer = setInterval(refresh, REFRESH_INTERVAL);

  // 天气城市变化时立即按新城市刷新
  store.subscribe('currentWeather', refresh);
}

export default { initCityPoem };
