/**
 * eq.js — 均衡器模块
 * 职责：主播放器 10 段 EQ 面板、预设、重置。
 */
import { store } from './store.js';
import { eventBus } from './eventBus.js';
import { apiClient } from './apiClient.js';
import { EQ_FREQS, EQ_PRESETS, initAudioCtx, setEqGain } from './audioEngine.js';

const $ = (id) => document.getElementById(id);

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
      // 手动调整后，预设下拉显示「自定义」
      const sel = $('eqPresets');
      if (sel) sel.value = 'custom';
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

export default { initEq };
