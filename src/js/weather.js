/**
 * weather.js — 天气模块
 * 负责天气拉取、城市→省份映射、省份地标背景渲染、天气动画场景、城市切换模态框、3日预报、雨雪粒子系统。
 */
import { store } from './store.js';
import { eventBus } from './eventBus.js';
import { apiClient } from './apiClient.js';

const $ = (id) => document.getElementById(id);
const CITY_STORAGE_KEY = 'qing:weatherCity';
const HOT_CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '重庆', '武汉', '南京'];

// 城市→省份映射
const CITY_PROVINCE = {
  '北京': '北京', '上海': '上海', '天津': '天津', '重庆': '重庆',
  '广州': '广东', '深圳': '广东', '东莞': '广东', '佛山': '广东', '珠海': '广东', '中山': '广东',
  '杭州': '浙江', '宁波': '浙江', '温州': '浙江', '绍兴': '浙江', '嘉兴': '浙江', '金华': '浙江',
  '南京': '江苏', '苏州': '江苏', '无锡': '江苏', '常州': '江苏', '扬州': '江苏', '南通': '江苏', '徐州': '江苏', '盐城': '江苏', '镇江': '江苏', '泰州': '江苏',
  '成都': '四川', '绵阳': '四川', '乐山': '四川', '宜宾': '四川',
  '武汉': '湖北', '宜昌': '湖北', '襄阳': '湖北', '黄冈': '湖北',
  '西安': '陕西', '咸阳': '陕西', '宝鸡': '陕西',
  '长沙': '湖南', '株洲': '湖南', '湘潭': '湖南', '岳阳': '湖南',
  '郑州': '河南', '洛阳': '河南', '开封': '河南', '安阳': '河南',
  '济南': '山东', '青岛': '山东', '烟台': '山东', '威海': '山东', '潍坊': '山东',
  '沈阳': '辽宁', '大连': '辽宁', '鞍山': '辽宁',
  '长春': '吉林', '吉林': '吉林', '延边': '吉林',
  '哈尔滨': '黑龙江', '大庆': '黑龙江', '齐齐哈尔': '黑龙江',
  '合肥': '安徽', '芜湖': '安徽', '黄山': '安徽',
  '福州': '福建', '厦门': '福建', '泉州': '福建', '漳州': '福建',
  '南昌': '江西', '九江': '江西', '赣州': '江西',
  '昆明': '云南', '大理': '云南', '丽江': '云南', '西双版纳': '云南',
  '贵阳': '贵州', '遵义': '贵州', '安顺': '贵州',
  '兰州': '甘肃', '敦煌': '甘肃', '嘉峪关': '甘肃',
  '西宁': '青海', '格尔木': '青海',
  '呼和浩特': '内蒙古', '包头': '内蒙古', '鄂尔多斯': '内蒙古',
  '南宁': '广西', '桂林': '广西', '柳州': '广西', '北海': '广西',
  '拉萨': '西藏', '日喀则': '西藏', '林芝': '西藏',
  '银川': '宁夏', '石嘴山': '宁夏',
  '乌鲁木齐': '新疆', '喀什': '新疆', '吐鲁番': '新疆', '伊犁': '新疆',
  '海口': '海南', '三亚': '海南', '三沙': '海南',
  '太原': '山西', '大同': '山西', '平遥': '山西',
  '石家庄': '河北', '保定': '河北', '唐山': '河北', '承德': '河北', '秦皇岛': '河北',
  '香港': '香港', '澳门': '澳门', '台北': '台湾', '高雄': '台湾', '台中': '台湾'
};

// 省份地标建筑 SVG（极简线条风格）
const PROVINCE_LANDMARKS = {
  '北京': [
    '<svg viewBox="0 0 120 100" fill="none" stroke="#333" stroke-width="1.5"><rect x="20" y="55" width="80" height="35"/><rect x="35" y="40" width="50" height="20"/><path d="M30 55 L30 35 L90 35 L90 55"/><line x1="45" y1="65" x2="45" y2="90"/><line x1="60" y1="65" x2="60" y2="90"/><line x1="75" y1="65" x2="75" y2="90"/><path d="M25 35 L60 15 L95 35"/></svg>',
    '<svg viewBox="0 0 80 100" fill="none" stroke="#333" stroke-width="1.5"><circle cx="40" cy="30" r="18"/><rect x="32" y="48" width="16" height="40"/><line x1="40" y1="12" x2="40" y2="5"/><line x1="22" y1="30" x2="15" y2="30"/><line x1="58" y1="30" x2="65" y2="30"/></svg>'
  ],
  '上海': [
    '<svg viewBox="0 0 60 120" fill="none" stroke="#333" stroke-width="1.5"><circle cx="30" cy="25" r="12"/><circle cx="30" cy="50" r="8"/><circle cx="30" cy="70" r="5"/><line x1="30" y1="37" x2="30" y2="110"/><line x1="15" y1="110" x2="45" y2="110"/></svg>',
    '<svg viewBox="0 0 80 120" fill="none" stroke="#333" stroke-width="1.5"><rect x="25" y="20" width="30" height="90"/><line x1="25" y1="40" x2="55" y2="40"/><line x1="25" y1="60" x2="55" y2="60"/><line x1="25" y1="80" x2="55" y2="80"/><path d="M20 20 L40 5 L60 20"/></svg>'
  ],
  '天津': [
    '<svg viewBox="0 0 100 100" fill="none" stroke="#333" stroke-width="1.5"><circle cx="50" cy="50" r="35"/><circle cx="50" cy="50" r="25"/><line x1="50" y1="15" x2="50" y2="85"/><line x1="15" y1="50" x2="85" y2="50"/><rect x="45" y="85" width="10" height="10"/></svg>'
  ],
  '重庆': [
    '<svg viewBox="0 0 120 100" fill="none" stroke="#333" stroke-width="1.5"><path d="M10 90 L10 50 L30 40 L30 90"/><path d="M30 90 L30 35 L55 25 L55 90"/><path d="M55 90 L55 45 L80 35 L80 90"/><path d="M80 90 L80 55 L105 50 L105 90"/><line x1="5" y1="90" x2="115" y2="90"/></svg>'
  ],
  '广东': [
    '<svg viewBox="0 0 60 120" fill="none" stroke="#333" stroke-width="1.5"><line x1="30" y1="110" x2="30" y2="20"/><ellipse cx="30" cy="20" rx="15" ry="8"/><ellipse cx="30" cy="35" rx="12" ry="6"/><ellipse cx="30" cy="48" rx="9" ry="5"/><ellipse cx="30" cy="60" rx="7" ry="4"/></svg>'
  ],
  '浙江': [
    '<svg viewBox="0 0 80 120" fill="none" stroke="#333" stroke-width="1.5"><path d="M40 110 L40 50"/><path d="M20 60 L40 30 L60 60"/><path d="M25 60 L40 40 L55 60"/><rect x="35" y="70" width="10" height="40"/><path d="M15 60 Q40 50 65 60"/></svg>'
  ],
  '江苏': [
    '<svg viewBox="0 0 100 80" fill="none" stroke="#333" stroke-width="1.5"><path d="M20 70 L20 40 L50 25 L80 40 L80 70"/><path d="M35 70 L35 50 L50 42 L65 50 L65 70"/><line x1="50" y1="25" x2="50" y2="15"/><circle cx="50" cy="12" r="3"/></svg>'
  ],
  '四川': [
    '<svg viewBox="0 0 100 80" fill="none" stroke="#333" stroke-width="1.5"><ellipse cx="35" cy="50" rx="20" ry="25"/><circle cx="28" cy="42" r="4"/><circle cx="42" cy="42" r="4"/><ellipse cx="35" cy="55" rx="6" ry="4"/><path d="M55 60 Q70 40 85 55 Q75 65 60 62"/><ellipse cx="80" cy="50" rx="8" ry="12"/></svg>'
  ],
  '湖北': [
    '<svg viewBox="0 0 100 100" fill="none" stroke="#333" stroke-width="1.5"><path d="M20 90 L20 50 L50 20 L80 50 L80 90"/><path d="M30 90 L30 55 L50 38 L70 55 L70 90"/><line x1="50" y1="20" x2="50" y2="10"/><line x1="15" y1="90" x2="85" y2="90"/></svg>'
  ],
  '陕西': [
    '<svg viewBox="0 0 80 120" fill="none" stroke="#333" stroke-width="1.5"><rect x="25" y="60" width="30" height="50"/><path d="M20 60 L40 30 L60 60"/><path d="M28 60 L40 42 L52 60"/><line x1="40" y1="30" x2="40" y2="15"/><circle cx="40" cy="12" r="3"/></svg>'
  ],
  '湖南': [
    '<svg viewBox="0 0 100 90" fill="none" stroke="#333" stroke-width="1.5"><path d="M15 80 L15 50 L50 20 L85 50 L85 80"/><path d="M25 80 L25 55 L50 35 L75 55 L75 80"/><line x1="50" y1="20" x2="50" y2="10"/><line x1="10" y1="80" x2="90" y2="80"/></svg>'
  ],
  '河南': [
    '<svg viewBox="0 0 60 100" fill="none" stroke="#333" stroke-width="1.5"><rect x="20" y="60" width="20" height="35"/><path d="M15 60 L30 35 L45 60"/><path d="M18 60 L30 45 L42 60"/><line x1="30" y1="35" x2="30" y2="20"/><path d="M25 20 L30 10 L35 20"/></svg>'
  ],
  '山东': [
    '<svg viewBox="0 0 100 80" fill="none" stroke="#333" stroke-width="1.5"><path d="M10 75 L35 25 L55 55 L75 35 L95 75"/><line x1="5" y1="75" x2="100" y2="75"/><circle cx="80" cy="20" r="8"/></svg>'
  ],
  '福建': [
    '<svg viewBox="0 0 100 80" fill="none" stroke="#333" stroke-width="1.5"><circle cx="30" cy="50" r="20"/><circle cx="30" cy="50" r="12"/><circle cx="70" cy="55" r="18"/><circle cx="70" cy="55" r="10"/><line x1="5" y1="75" x2="95" y2="75"/></svg>'
  ],
  '云南': [
    '<svg viewBox="0 0 100 100" fill="none" stroke="#333" stroke-width="1.5"><path d="M20 90 L20 40 L30 30 L30 90"/><path d="M42 90 L42 35 L52 25 L52 90"/><path d="M64 90 L64 42 L74 32 L74 90"/><line x1="15" y1="90" x2="85" y2="90"/></svg>'
  ],
  '西藏': [
    '<svg viewBox="0 0 120 100" fill="none" stroke="#333" stroke-width="1.5"><path d="M10 90 L10 50 L30 35 L30 90"/><path d="M30 90 L30 30 L60 15 L90 30 L90 90"/><path d="M90 90 L90 45 L110 35 L110 90"/><rect x="50" y="50" width="20" height="40"/><path d="M55 50 L60 40 L65 50"/></svg>'
  ],
  '新疆': [
    '<svg viewBox="0 0 80 100" fill="none" stroke="#333" stroke-width="1.5"><path d="M40 95 L40 30"/><path d="M20 40 L40 20 L60 40"/><path d="M25 40 L40 28 L55 40"/><rect x="35" y="50" width="10" height="45"/><circle cx="40" cy="15" r="5"/></svg>'
  ],
  '内蒙古': [
    '<svg viewBox="0 0 100 80" fill="none" stroke="#333" stroke-width="1.5"><path d="M20 70 Q20 40 50 40 Q80 40 80 70"/><line x1="50" y1="40" x2="50" y2="25"/><path d="M40 25 L50 15 L60 25"/><line x1="35" y1="70" x2="35" y2="75"/><line x1="65" y1="70" x2="65" y2="75"/></svg>'
  ],
  '广西': [
    '<svg viewBox="0 0 120 80" fill="none" stroke="#333" stroke-width="1.5"><path d="M10 75 L30 30 L50 55 L70 25 L90 50 L110 35 L110 75"/><line x1="5" y1="75" x2="115" y2="75"/></svg>'
  ],
  '海南': [
    '<svg viewBox="0 0 80 100" fill="none" stroke="#333" stroke-width="1.5"><line x1="40" y1="90" x2="40" y2="40"/><path d="M40 40 Q25 25 20 35 Q30 30 40 40"/><path d="M40 40 Q55 25 60 35 Q50 30 40 40"/><path d="M40 55 Q28 48 25 55 Q35 52 40 55"/><path d="M40 55 Q52 48 55 55 Q45 52 40 55"/><circle cx="40" cy="35" r="3"/></svg>'
  ],
  '黑龙江': [
    '<svg viewBox="0 0 80 100" fill="none" stroke="#333" stroke-width="1.5"><rect x="20" y="35" width="40" height="55"/><path d="M15 35 L40 15 L65 35"/><line x1="40" y1="15" x2="40" y2="5"/><circle cx="40" cy="55" r="8"/><line x1="30" y1="70" x2="50" y2="70"/></svg>'
  ],
  '吉林': [
    '<svg viewBox="0 0 100 80" fill="none" stroke="#333" stroke-width="1.5"><path d="M10 75 L35 20 L55 50 L75 30 L95 75"/><line x1="5" y1="75" x2="100" y2="75"/></svg>'
  ],
  '辽宁': [
    '<svg viewBox="0 0 100 90" fill="none" stroke="#333" stroke-width="1.5"><path d="M15 80 L15 45 L50 20 L85 45 L85 80"/><rect x="40" y="50" width="20" height="30"/><path d="M25 45 L50 28 L75 45"/></svg>'
  ],
  '河北': [
    '<svg viewBox="0 0 100 80" fill="none" stroke="#333" stroke-width="1.5"><rect x="20" y="40" width="60" height="35"/><path d="M15 40 L50 15 L85 40"/><line x1="35" y1="50" x2="35" y2="75"/><line x1="50" y1="50" x2="50" y2="75"/><line x1="65" y1="50" x2="65" y2="75"/></svg>'
  ],
  '山西': [
    '<svg viewBox="0 0 60 110" fill="none" stroke="#333" stroke-width="1.5"><rect x="20" y="70" width="20" height="35"/><path d="M15 70 L30 45 L45 70"/><path d="M18 70 L30 55 L42 70"/><line x1="30" y1="45" x2="30" y2="25"/><path d="M22 25 L30 10 L38 25"/><path d="M25 25 L30 18 L35 25"/></svg>'
  ],
  '安徽': [
    '<svg viewBox="0 0 100 80" fill="none" stroke="#333" stroke-width="1.5"><path d="M10 75 L30 25 L50 55 L70 20 L90 75"/><line x1="5" y1="75" x2="95" y2="75"/></svg>'
  ],
  '江西': [
    '<svg viewBox="0 0 100 90" fill="none" stroke="#333" stroke-width="1.5"><path d="M15 80 L15 50 L50 20 L85 50 L85 80"/><path d="M25 80 L25 55 L50 35 L75 55 L75 80"/><line x1="50" y1="20" x2="50" y2="10"/></svg>'
  ],
  '贵州': [
    '<svg viewBox="0 0 120 80" fill="none" stroke="#333" stroke-width="1.5"><path d="M10 70 Q30 30 50 50 Q70 70 90 40 Q105 25 115 50"/><line x1="5" y1="75" x2="115" y2="75"/></svg>'
  ],
  '甘肃': [
    '<svg viewBox="0 0 100 80" fill="none" stroke="#333" stroke-width="1.5"><rect x="15" y="30" width="70" height="45"/><path d="M10 30 L50 10 L90 30"/><line x1="30" y1="40" x2="30" y2="75"/><line x1="50" y1="40" x2="50" y2="75"/><line x1="70" y1="40" x2="70" y2="75"/></svg>'
  ],
  '青海': [
    '<svg viewBox="0 0 80 100" fill="none" stroke="#333" stroke-width="1.5"><rect x="25" y="50" width="30" height="45"/><path d="M20 50 L40 25 L60 50"/><path d="M28 50 L40 38 L52 50"/><line x1="40" y1="25" x2="40" y2="10"/><circle cx="40" cy="8" r="3"/></svg>'
  ],
  '宁夏': [
    '<svg viewBox="0 0 100 80" fill="none" stroke="#333" stroke-width="1.5"><path d="M20 70 L20 40 L35 30 L35 70"/><path d="M45 70 L45 35 L60 25 L60 70"/><path d="M70 70 L70 42 L85 32 L85 70"/><line x1="15" y1="70" x2="90" y2="70"/></svg>'
  ],
  '香港': [
    '<svg viewBox="0 0 60 120" fill="none" stroke="#333" stroke-width="1.5"><path d="M30 115 L30 15"/><path d="M15 30 L30 15 L45 30"/><path d="M18 45 L30 32 L42 45"/><path d="M21 60 L30 50 L39 60"/><path d="M24 75 L30 68 L36 75"/></svg>'
  ],
  '澳门': [
    '<svg viewBox="0 0 80 100" fill="none" stroke="#333" stroke-width="1.5"><rect x="20" y="40" width="40" height="55"/><path d="M15 40 L40 20 L65 40"/><line x1="30" y1="55" x2="30" y2="95"/><line x1="45" y1="55" x2="45" y2="95"/><path d="M35 20 L40 10 L45 20"/></svg>'
  ],
  '台湾': [
    '<svg viewBox="0 0 50 120" fill="none" stroke="#333" stroke-width="1.5"><rect x="15" y="25" width="20" height="85"/><line x1="15" y1="45" x2="35" y2="45"/><line x1="15" y1="65" x2="35" y2="65"/><line x1="15" y1="85" x2="35" y2="85"/><path d="M10 25 L25 5 L40 25"/></svg>'
  ]
};

function getProvince(city) {
  return CITY_PROVINCE[city] || null;
}

function getSavedCity() {
  try { return localStorage.getItem(CITY_STORAGE_KEY) || '扬州'; }
  catch { return '扬州'; }
}
function saveCity(city) {
  try { localStorage.setItem(CITY_STORAGE_KEY, city); } catch {}
}

function weekdayOf(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return names[d.getDay()];
}

export async function loadWeather(city) {
  const target = city || getSavedCity();
  const w = await apiClient.getWeather(target);
  if (!w || w.error || w.temp == null) {
    $('wTemp').textContent = '--°';
    $('wDesc').textContent = '天气获取失败';
    return;
  }
  saveCity(w.city || target);
  store.set('currentWeather', w);
  $('wTemp').textContent = w.temp + '°';
  $('wCity').textContent = w.city || target;
  $('wDesc').textContent = w.desc
    ? `${w.desc}${(w.todayLow != null && w.todayHigh != null) ? ' ' + w.todayLow + '°~' + w.todayHigh + '°' : ''}`
    : '';
}

/* ========== 雨雪 Canvas 粒子系统 ========== */
let particleRaf = null;
function stopParticles() {
  if (particleRaf) { cancelAnimationFrame(particleRaf); particleRaf = null; }
}
function startParticles(scene, type) {
  stopParticles();
  const canvas = document.createElement('canvas');
  canvas.className = 'particle-canvas';
  const rect = scene.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  scene.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;
  const count = 150 + Math.floor(Math.random() * 50);
  const particles = [];
  if (type === 'rain') {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        len: 12 + Math.random() * 10,
        speed: 8 + Math.random() * 6,
        opacity: 0.3 + Math.random() * 0.5
      });
    }
  } else {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 1.5 + Math.random() * 2.5,
        speed: 1 + Math.random() * 1.5,
        drift: (Math.random() - 0.5) * 1.2,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.05,
        opacity: 0.5 + Math.random() * 0.5
      });
    }
  }
  function frame() {
    ctx.clearRect(0, 0, W, H);
    if (type === 'rain') {
      ctx.strokeStyle = 'rgba(120,160,220,0.7)';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      for (const p of particles) {
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 1, p.y + p.len);
        ctx.stroke();
        p.y += p.speed;
        p.x -= 0.5;
        if (p.y > H) { p.y = -p.len; p.x = Math.random() * W; }
      }
    } else {
      ctx.fillStyle = '#fff';
      for (const p of particles) {
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        p.y += p.speed;
        p.x += p.drift + Math.sin(p.angle) * 0.5;
        p.angle += p.spin;
        if (p.y > H) { p.y = -5; p.x = Math.random() * W; }
        if (p.x > W) p.x = 0;
        if (p.x < 0) p.x = W;
      }
    }
    ctx.globalAlpha = 1;
    particleRaf = requestAnimationFrame(frame);
  }
  frame();
}

export function renderWeatherScene() {
  stopParticles();
  const scene = $('wpScene');
  const landmarksEl = $('wpLandmarks');
  const provinceLabel = $('wpProvinceLabel');
  const currentWeather = store.get('currentWeather');
  if (!currentWeather) {
    scene.innerHTML = '';
    landmarksEl.innerHTML = '';
    provinceLabel.textContent = '';
    return;
  }

  // 省份背景：大号淡色汉字
  const province = getProvince(currentWeather.city);
  if (province) {
    landmarksEl.innerHTML = `<div class="province-bg-char">${province.charAt(0)}</div>`;
    provinceLabel.textContent = province;
  } else {
    landmarksEl.innerHTML = '';
    provinceLabel.textContent = '';
  }

  const desc = currentWeather.desc || '';
  const descLower = desc.toLowerCase();
  const isRain = desc.includes('雷') || desc.includes('雨') || descLower.includes('rain') || descLower.includes('thunder') || descLower.includes('drizzle') || descLower.includes('shower');
  const isSnow = desc.includes('雪') || descLower.includes('snow') || descLower.includes('sleet');
  const cloudSvg = (cls) => `<div class="doodle-cloud ${cls || 'cloud-float'}">
      <div class="cloud-body c1"></div><div class="cloud-body c2"></div><div class="cloud-body c3"></div>
    </div>`;
  const sunSvg = () => `<div class="doodle-sun">
      <div class="sun-core"></div>
      ${Array.from({ length: 8 }, (_, i) => `<div class="sun-ray" style="transform:rotate(${i * 45}deg);animation-delay:${i * 0.1}s;"></div>`).join('')}
    </div>`;

  let html = '';
  let particleType = null;
  if (desc.includes('雷') || descLower.includes('thunder')) {
    html = cloudSvg('cloud-float') + '<div class="doodle-lightning" style="top:110px;left:140px;">⚡</div>';
    particleType = 'rain';
  } else if (isSnow) {
    html = cloudSvg('cloud-float');
    particleType = 'snow';
  } else if (isRain) {
    html = cloudSvg('cloud-float');
    particleType = 'rain';
  } else if (desc.includes('多云') || desc.includes('转晴') || descLower.includes('cloud') || descLower.includes('partly')) {
    html = `<div class="scene-partly" style="position:relative;width:200px;height:160px;">
      <div class="doodle-sun">
        <div class="sun-core"></div>
        ${Array.from({ length: 8 }, (_, i) => `<div class="sun-ray" style="transform:rotate(${i * 45}deg);animation-delay:${i * 0.1}s;"></div>`).join('')}
      </div>
      ${cloudSvg('cloud-float')}
    </div>`;
  } else if (desc.includes('阴') || descLower.includes('overcast') || descLower.includes('cloudy')) {
    html = `<div class="doodle-cloud cloud-float" style="position:absolute;top:30px;left:20px;">
      <div class="cloud-body c1"></div><div class="cloud-body c2"></div><div class="cloud-body c3"></div>
    </div>
    <div class="doodle-cloud cloud-float-slow" style="position:absolute;top:90px;left:80px;transform:scale(0.8);">
      <div class="cloud-body c1"></div><div class="cloud-body c2"></div><div class="cloud-body c3"></div>
    </div>`;
  } else {
    html = sunSvg();
  }
  scene.innerHTML = html;
  if (particleType) {
    // 等一帧让云朵 div 布局完成再创建 Canvas
    requestAnimationFrame(() => startParticles(scene, particleType));
  }

  $('wpCity').textContent = currentWeather.city;
  $('wpTemp').textContent = currentWeather.temp + '°';
  $('wpDesc').textContent = currentWeather.desc;
  $('wpRange').textContent = `${currentWeather.todayLow}° ~ ${currentWeather.todayHigh}°  湿度 ${currentWeather.humidity}%`;

  // 3日预报
  renderForecast(currentWeather.forecast);
}

function renderForecast(forecast) {
  let container = $('wpForecast');
  if (!container) {
    container = document.createElement('div');
    container.id = 'wpForecast';
    container.className = 'wp-forecast';
    $('wpRange').after(container);
  }
  if (!Array.isArray(forecast) || forecast.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = forecast.slice(0, 3).map((d, i) => {
    const label = i === 0 ? '今天' : weekdayOf(d.date);
    const icon = d.desc || '--';
    return `<div class="fc-card">
      <div class="fc-day">${label}</div>
      <div class="fc-icon">${icon}</div>
      <div class="fc-temp"><span class="fc-high">${d.maxTemp}°</span> / <span class="fc-low">${d.minTemp}°</span></div>
    </div>`;
  }).join('');
}

/* ========== 城市切换模态框 ========== */
let cityModal = null;
function openCityModal() {
  if (cityModal) { cityModal.classList.add('show'); return; }
  const overlay = document.createElement('div');
  overlay.className = 'city-modal-overlay';
  overlay.innerHTML = `
    <div class="city-modal" role="dialog" aria-label="切换城市">
      <div class="cm-title">切换城市</div>
      <div class="cm-search">
        <input type="text" id="cmInput" placeholder="输入城市名，回车确认" aria-label="输入城市名">
      </div>
      <div class="cm-hot-label">热门城市</div>
      <div class="cm-hot-grid" id="cmHotGrid"></div>
      <button class="cm-close" id="cmClose" aria-label="关闭">×</button>
    </div>`;
  document.body.appendChild(overlay);
  cityModal = overlay;
  const grid = $('cmHotGrid');
  HOT_CITIES.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'cm-city-btn';
    btn.type = 'button';
    btn.textContent = c;
    btn.addEventListener('click', () => selectCity(c));
    grid.appendChild(btn);
  });
  $('cmClose').addEventListener('click', closeCityModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCityModal(); });
  const input = $('cmInput');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const v = input.value.trim(); if (v) selectCity(v); }
    if (e.key === 'Escape') closeCityModal();
  });
  requestAnimationFrame(() => { overlay.classList.add('show'); input.focus(); });
}
function closeCityModal() {
  if (!cityModal) return;
  cityModal.classList.remove('show');
  setTimeout(() => { if (cityModal) { cityModal.remove(); cityModal = null; } }, 250);
}
function selectCity(city) {
  closeCityModal();
  loadWeather(city);
}

export function initWeather() {
  const weatherPage = $('weatherPage');
  const savedCity = getSavedCity();

  $('weatherWidget').addEventListener('click', async () => {
    if (!store.get('currentWeather')) await loadWeather(savedCity);
    renderWeatherScene();
    weatherPage.classList.add('show');
  });

  $('wpClose').addEventListener('click', () => {
    stopParticles();
    weatherPage.classList.remove('show');
  });

  $('wpCitySwitch').addEventListener('click', () => openCityModal());

  loadWeather(savedCity);
}

export default { initWeather, loadWeather, renderWeatherScene };
