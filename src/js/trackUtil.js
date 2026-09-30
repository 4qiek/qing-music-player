/**
 * trackUtil.js — 曲目判定通用工具
 * 只放无依赖的纯函数，供 player / lyric / playlists / queue 等模块共享，
 * 避免这些模块之间互相 import 形成循环依赖。
 */

/**
 * 判断是否为「本地曲目」。
 *
 * 背景：目录扫描 / 下载归库入库的条目历史上没有写入 platform 字段，
 * 只按 platform === 'local' 判断会把它们误判成在线曲目，
 * 进而走在线接口请求导致播放失败、歌词与平台标签显示异常。
 * 这里同时按 platform、origin、URL 协议三重识别，兼容历史落盘数据。
 *
 * @param {object} t 曲目对象，可为 null / undefined
 * @returns {boolean} 是否为本地曲目
 */
export function isLocalTrack(t) {
  if (!t) return false;
  if (t.platform === 'local') return true;
  if (t.origin === 'path' || t.origin === 'file') return true;
  const u = String(t.url || '');
  return u.startsWith('qing-file:') || u.startsWith('blob:');
}

export default { isLocalTrack };
