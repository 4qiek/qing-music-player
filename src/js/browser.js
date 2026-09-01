/**
 * browser.js — 内嵌浏览器模式控制
 * 职责：浏览器工具条交互、地址栏导航、前进/后退/刷新/主页、
 * 无痕模式开关、下载状态提示、与主进程 BrowserView 联动。
 */
import { toast } from './ui.js';

const $ = (id) => document.getElementById(id);

let active = false;          // 浏览器模式是否开启
let incognito = true;        // 当前无痕状态（默认无痕）
let addrTimer = null;

function send(cb) {
  if (window.qingAPI && typeof cb === 'function') cb();
}

export function initBrowser() {
  // 侧边栏「浏览器」入口
  $('browserNav').addEventListener('click', () => openBrowser());

  // 工具条按钮
  $('browserBack').addEventListener('click', () => send(() => window.qingAPI.browserGo('back')));
  $('browserFwd').addEventListener('click', () => send(() => window.qingAPI.browserGo('forward')));
  $('browserReload').addEventListener('click', () => send(() => window.qingAPI.browserGo('reload')));
  $('browserHome').addEventListener('click', () => send(() => window.qingAPI.browserGo('home')));

  // 地址栏：回车导航
  const addr = $('browserAddr');
  addr.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const kw = addr.value.trim();
      if (!kw) return;
      // 不是网址则当作搜索关键词
      const url = /^https?:\/\//i.test(kw) || /^[\w-]+(\.[\w-]+)+/.test(kw)
        ? kw
        : 'https://www.baidu.com/s?wd=' + encodeURIComponent(kw);
      send(() => window.qingAPI.browserNavigate(url));
      addr.blur();
    }
  });

  // 无痕模式开关
  $('browserIncognito').addEventListener('click', () => {
    incognito = !incognito;
    renderIncognitoBtn();
    send(() => window.qingAPI.browserSetIncognito(incognito));
    toast({ message: incognito ? '已开启无痕模式：不保存记录和 Cookie' : '已关闭无痕模式（将使用持久会话）' });
  });

  // 关闭浏览器
  $('browserClose').addEventListener('click', () => closeBrowser());

  // 主进程事件
  send(() => {
    window.qingAPI.onBrowserEvent((data) => {
      if (!data) return;
      if (data.type === 'nav') {
        if (addrTimer) clearTimeout(addrTimer);
        addrTimer = setTimeout(() => { addr.value = data.url || ''; }, 300);
      } else if (data.type === 'download:start') {
        toast({ message: '开始下载：' + data.filename });
      } else if (data.type === 'download:done') {
        toast({
          message: data.state === 'completed' ? '下载完成：' + data.filename : '下载已取消',
          type: data.state === 'completed' ? 'success' : 'error'
        });
      } else if (data.type === 'closed') {
        setActive(false);
      } else if (data.type === 'ready') {
        setActive(true);
      }
    });
  });

  // 切到其他视图时自动关闭浏览器
  document.addEventListener('view:switched', () => {
    if (active) closeBrowser();
  });
}

function renderIncognitoBtn() {
  const btn = $('browserIncognito');
  btn.classList.toggle('active', incognito);
  btn.title = incognito
    ? '无痕模式：不保存浏览记录和 Cookie，关闭即清除（点击关闭）'
    : '普通模式：会保存浏览记录（点击开启无痕）';
}

/** 打开浏览器模式 */
export function openBrowser(url) {
  // 先即时显示工具条（UI 反馈），主进程 ready 事件只作地址栏等补充
  setActive(true);
  send(() => window.qingAPI.browserOpen({ url, incognito }));
  renderIncognitoBtn();
}

/** 关闭浏览器模式 */
export function closeBrowser() {
  if (!active) {
    // 即使未 ready 也清理工具条
    $('browserBar').style.display = 'none';
    return;
  }
  send(() => window.qingAPI.browserClose());
  setActive(false);
}

function setActive(on) {
  active = on;
  $('browserBar').style.display = on ? 'flex' : 'none';
  // 侧边栏高亮还原
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
  if (on) $('browserNav').classList.add('active');
}

export default { initBrowser, openBrowser, closeBrowser };
