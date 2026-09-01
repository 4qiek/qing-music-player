/**
 * history.js — 播放历史视图
 * 职责：渲染最近播放（localStorage 持久化，最多 60 条），支持清空。
 */
import { store } from './store.js';
import { renderSongList } from './search.js';
import { clearHistory } from './player.js';
import { formatTime } from './utils.js';

const $ = (id) => document.getElementById(id);

function renderHistory() {
  const list = $('historyList');
  const hist = store.get('history') || [];
  $('historySub').textContent = hist.length ? `最近播放 ${hist.length} 首` : '最近播放的歌曲会显示在这里';
  if (!hist.length) {
    list.innerHTML = '<div class="empty-state"><div class="big-icon"><svg style="width:48px;height:48px"><use href="#i-clock"/></svg></div><p>还没有播放记录</p></div>';
    return;
  }
  store.set('searchResults', hist);
  store.set('currentQueue', hist);
  renderSongList(list, hist);
  // 每行显示播放时间
  list.querySelectorAll('.song-row').forEach((row, i) => {
    const t = hist[i];
    if (t && t.playedAt) {
      const el = document.createElement('span');
      el.className = 'row-time';
      el.textContent = new Date(t.playedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      row.appendChild(el);
    }
  });
}

export function initHistory() {
  document.addEventListener('view:history', renderHistory);
  const clearBtn = $('historyClear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearHistory();
      renderHistory();
    });
  }
  store.subscribe('history', () => {
    if (store.get('view') === 'history') renderHistory();
  });
}

export default { initHistory, renderHistory };
