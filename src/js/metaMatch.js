/**
 * metaMatch.js — 本地书籍 / 影视的在线元数据匹配工具
 * 负责把杂乱的本地文件名清洗成可搜索关键词，并从豆瓣 suggest
 * 结果中挑选最合适的条目。
 */

/** 通用：压缩空白、分隔符归一 */
function normalize(str) {
  return String(str || '')
    .replace(/[._·]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 书籍文件名 → 搜索关键词 */
export function cleanBookKeyword(name) {
  let s = String(name || '').replace(/\.[^.]+$/, ''); // 去扩展名
  // 去掉括号内的版本/来源说明
  s = s.replace(/[\(（\[【][^\)）\]】]*(?:全集|精校|完本|完结|全本|校对|珍藏版|简体|繁体|TXT|EPUB|MOBI|AZW3|扫描|电子版|下载|www\.|http)[^\)）\]】]*[\)）\]】]/gi, ' ');
  // 去掉“作者：xxx”“作者-xxx”这类前缀标记，但保留可能的人名（豆瓣可容错搜索）
  s = s.replace(/作者[:：\-\s]+/g, ' ');
  return normalize(s);
}

/** 视频文件名 → 搜索关键词（去分辨率/编码/来源/集数/压制组） */
export function cleanVideoKeyword(name) {
  let s = String(name || '').replace(/\.[^.]+$/, ''); // 去扩展名
  // 集数 / 季（S01E02、EP02、第02集、第二季）
  s = s.replace(/\bS\d{1,2}\s*E\d{1,3}\b/gi, ' ');
  s = s.replace(/\b(EP|E)\d{1,3}\b/gi, ' ');
  s = s.replace(/第\s*\d{1,3}\s*集/g, ' ');
  s = s.replace(/第\s*[一二三四五六七八九十百千0-9]+\s*季/g, ' ');
  s = s.replace(/\bSeason\s*\d+\b/gi, ' ');
  // 分辨率 / 编码 / 音源 / 来源
  s = s.replace(/\b(2160p|1080p|720p|480p|360p|4k|8k|uhd|fhd|hd)\b/gi, ' ');
  s = s.replace(/\b(x264|x265|h\.?264|h\.?265|hevc|avc|av1|aac|ac3|dts(?:-hd)?|truehd|flac|10bit|8bit)\b/gi, ' ');
  s = s.replace(/\b(blu-?ray|bluray|web-?dl|web-?rip|hd-?tv|hd-?rip|dvd-?rip|bd-?rip|remux|hdr|dolby|atmos)\b/gi, ' ');
  // 括号内的压制组 / 字幕 / 网址等
  s = s.replace(/[\(（\[【][^\)）\]】]*(?:压制|字幕|双语|中英|字幕组|影视|www\.|http|@|公众号|破解|内嵌|官中)[^\)）\]】]*[\)）\]】]/gi, ' ');
  // 常见尾缀标记
  s = s.replace(/\b(完整版|未删减|删减版|国语|粤语|普通话|高清|超清|枪版|TS版|TC版)\b/g, ' ');
  return normalize(s);
}

/**
 * 从 suggest 结果中取最合适条目（豆瓣已按端点分类型，默认取相关度最高的第一条）。
 * @param {Array} list 豆瓣结果
 */
export function pickResult(list) {
  if (!Array.isArray(list) || !list.length) return null;
  return list[0];
}

/**
 * 豆瓣图床有防盗链，浏览器直接加载会被拒；经主进程代理下载转 dataURL。
 * 失败时保留原 URL（列表 img 的 onerror 会回退为类型图标）。
 */
async function coverToDataUrl(url) {
  if (!url || !/^https?:\/\//.test(url)) return url;
  const api = typeof window !== 'undefined' ? window.qingAPI : null;
  if (!api || !api.metaCover) return url;
  try {
    const r = await api.metaCover(url);
    if (r && r.dataUrl) return r.dataUrl;
  } catch (e) { /* 保留原 url */ }
  return url;
}

/**
 * 执行一次匹配
 * @param {object} apiClient 已实例化的 apiClient
 * @param {string} keyword 清洗后的关键词
 * @param {string} kind 'book' 书籍 / 'movie' 影视
 */
export async function fetchMatch(apiClient, keyword, kind) {
  if (!keyword) return null;
  const res = await apiClient.metaSuggest(keyword, kind);
  if (!res || res.error || !Array.isArray(res)) return null;
  const hit = pickResult(res);
  if (hit && hit.cover) hit.cover = await coverToDataUrl(hit.cover);
  return hit;
}

/**
 * 封面图加载失败时回退为类型图标占位，避免出现裂图。
 * @param {HTMLElement} container 列表容器
 * @param {string} iconHref 占位 SVG symbol，如 '#i-book'
 */
export function bindCoverFallback(container, iconHref) {
  if (!container) return;
  container.querySelectorAll('img.s-cover').forEach((img) => {
    img.addEventListener('error', () => {
      const d = document.createElement('div');
      d.className = 's-cover';
      d.style.cssText = 'background:var(--hover);display:flex;align-items:center;justify-content:center;';
      d.innerHTML = `<svg style="width:16px;height:16px;color:var(--text2)"><use href="${iconHref}"/></svg>`;
      img.replaceWith(d);
    }, { once: true });
  });
}

export default { cleanBookKeyword, cleanVideoKeyword, pickResult, fetchMatch, bindCoverFallback };
