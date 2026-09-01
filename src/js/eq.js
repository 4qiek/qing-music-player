/**
 * eq.js — 均衡器模块
 * 职责：主播放器 10 段 EQ 面板、预设、重置；
 *       其他播放器系统级 EQ（Equalizer APO）面板与安装引导。
 */
import { store } from './store.js';
import { eventBus } from './eventBus.js';
import { apiClient } from './apiClient.js';
import { EQ_FREQS, EQ_PRESETS, initAudioCtx, setEqGain } from './audioEngine.js';

const $ = (id) => document.getElementById(id);

export const OPD_EQ_FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const OPD_EQ_PRESETS = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  pop: [-1, 2, 4, 4, 2, 0, -1, -1, 2, 3],
  rock: [5, 4, 3, 1, -1, -1, 2, 4, 5, 5],
  jazz: [3, 2, 1, 2, -1, -1, 0, 2, 3, 4],
  classical: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4],
  vocal: [-2, -1, 0, 2, 4, 4, 3, 2, 0, -1],
  bass: [6, 5, 4, 3, 1, 0, 0, 0, 0, 0],
  treble: [0, 0, 0, 0, 0, 1, 3, 5, 6, 7]
};

function freqLabel(f) {
  return f >= 1000 ? f / 1000 + 'k' : String(f);
}

function buildBands(container, freqs, onInput) {
  container.innerHTML = freqs.map((f, i) => `
    <div class="eq-band">
      <div class="eq-val" data-val="${i}">0</div>
      <input type="range" class="eq-slider" min="-12" max="12" step="1" value="0" data-index="${i}"
             aria-label="均衡器 ${freqLabel(f)}Hz 增益">
      <div class="eq-freq">${freqLabel(f)}</div>
    </div>`).join('');

  container.querySelectorAll('.eq-slider').forEach((slider) => {
    slider.addEventListener('input', () => {
      const i = parseInt(slider.dataset.index, 10);
      const val = parseInt(slider.value, 10);
      const valEl = container.querySelector(`[data-val="${i}"]`);
      if (valEl) valEl.textContent = val > 0 ? '+' + val : val;
      onInput(i, val);
    });
  });
}

function setBandValues(container, values) {
  container.querySelectorAll('.eq-slider').forEach((slider, i) => {
    slider.value = values[i] || 0;
    const valEl = container.querySelector(`[data-val="${i}"]`);
    if (valEl) valEl.textContent = (values[i] > 0 ? '+' : '') + (values[i] || 0);
  });
}

// ===== 主播放器 EQ =====
export function initEq() {
  const bands = $('eqBands');
  buildBands(bands, EQ_FREQS, (i, val) => {
    initAudioCtx($('audio'));
    setEqGain(i, val);
    const values = [...store.get('eqValues')];
    values[i] = val;
    store.set('eqValues', values);
  });

  $('eqPresets').addEventListener('change', (e) => {
    const vals = EQ_PRESETS[e.target.value];
    if (vals) {
      setBandValues(bands, vals);
      store.set('eqValues', [...vals]);
      initAudioCtx($('audio'));
      vals.forEach((v, i) => setEqGain(i, v));
    }
  });

  $('eqReset').addEventListener('click', () => {
    setBandValues(bands, EQ_PRESETS.flat);
    store.set('eqValues', [...EQ_PRESETS.flat]);
    initAudioCtx($('audio'));
    EQ_FREQS.forEach((_, i) => setEqGain(i, 0));
    $('eqPresets').value = 'flat';
  });

  $('eqToggle').addEventListener('click', () => {
    $('eqPanel').classList.toggle('show');
    $('eqToggle').classList.toggle('active');
  });
}

// ===== 其他播放器系统 EQ =====
export function initOpdEq() {
  const bands = $('opdEqBands');
  buildBands(bands, OPD_EQ_FREQS, (i, val) => {
    const values = [...store.get('opdEqValues')];
    values[i] = val;
    store.set('opdEqValues', values);
    applyOpdEq();
  });

  $('opdEqBtn').addEventListener('click', () => {
    $('opdEqPanel').classList.toggle('show');
  });

  $('opdEqPresets').addEventListener('change', (e) => {
    const preset = OPD_EQ_PRESETS[e.target.value];
    if (preset) {
      store.set('opdEqValues', [...preset]);
      setBandValues(bands, preset);
      applyOpdEq();
    }
  });

  $('opdInstallEqBtn').addEventListener('click', installSystemEq);

  checkSystemEq();
}

function applyOpdEq() {
  if (apiClient.applySystemEq) {
    apiClient.applySystemEq(store.get('opdEqValues')).then((r) => {
      if (r && r.error) console.log('系统EQ:', r.error);
    });
  }
}

async function checkSystemEq() {
  if (!apiClient.checkEqAvailable) return;
  try {
    const r = await apiClient.checkEqAvailable();
    store.set('systemEqAvailable', !!(r && r.available));
    const notice = $('opdEqInstallNotice');
    if (notice) notice.style.display = store.get('systemEqAvailable') ? 'none' : 'block';
  } catch (e) { /* ignore */ }
}

async function installSystemEq() {
  const btn = $('opdInstallEqBtn');
  const status = $('opdEqInstallStatus');
  btn.disabled = true;
  btn.textContent = '安装中...';
  status.textContent = '正在下载 Equalizer APO 安装包...';
  try {
    const result = await apiClient.installSystemEq();
    if (result.error) {
      status.textContent = '安装失败: ' + result.error;
      btn.disabled = false;
      btn.textContent = '重试安装';
    } else {
      status.textContent = '安装成功！系统级EQ已启用。';
      $('opdEqInstallNotice').style.display = 'none';
      store.set('systemEqAvailable', true);
      applyOpdEq();
    }
  } catch (err) {
    status.textContent = '安装出错: ' + err.message;
    btn.disabled = false;
    btn.textContent = '重试安装';
  }
}

export default { initEq, initOpdEq, OPD_EQ_FREQS, OPD_EQ_PRESETS };
