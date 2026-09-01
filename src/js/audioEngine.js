/**
 * audioEngine.js — 音频引擎
 * 职责：
 *  1. Web Audio EQ（10 段 peaking filter）
 *  2. 磁带效果（饱和 / 高频衰减 / 低频提升 / Wow&Flutter / 底噪）
 *  3. USB 音频设备（小尾巴）检测并自动启用磁带模式
 * 通过事件总线对外广播状态变更。
 */
import { eventBus } from './eventBus.js';
import { store } from './store.js';
import { apiClient } from './apiClient.js';

export const EQ_FREQS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_PRESETS = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [6, 5, 4, 2, 0, -1, -1, 0, 1, 2],
  vocal: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1],
  rock: [5, 3, 0, -2, -1, 1, 3, 4, 3, 2],
  pop: [1, 2, 3, 4, 3, 1, -1, -1, 1, 2],
  jazz: [3, 2, 1, 2, -1, -1, 0, 2, 3, 4],
  classical: [4, 3, 2, 0, -1, -1, 0, 2, 3, 4],
  treble: [0, 0, 0, 0, 0, 1, 3, 5, 6, 7]
};

// ===== 内部状态 =====
let audioCtx = null;
let sourceNode = null;
const eqFilters = [];
let tapeNodes = {};
let usbCheckTimer = null;
let analyserNode = null;
let masterComp = null;   // 响度均衡压缩器
let masterGain = null;   // 主增益（淡入淡出）

/**
 * 主输出总线：analyser → 压缩器(响度均衡) → 主增益 → destination
 * 压缩器温和压平动态，避免不同音源忽大忽小；主增益用于切歌淡入。
 */
function ensureMasterBus() {
  if (!audioCtx) return null;
  if (!masterComp) {
    masterComp = audioCtx.createDynamicsCompressor();
    masterComp.threshold.value = -18;
    masterComp.knee.value = 20;
    masterComp.ratio.value = 3;
    masterComp.attack.value = 0.004;
    masterComp.release.value = 0.25;
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 1;
    masterComp.connect(masterGain);
    masterGain.connect(audioCtx.destination);
  }
  return masterComp;
}

/** 切歌淡入：主增益 0 → 1 */
export function fadeIn(duration = 0.45) {
  if (!audioCtx || !masterGain) return;
  const now = audioCtx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.exponentialRampToValueAtTime(1, now + duration);
}

/** 淡出（暂停/切出可选） */
export function fadeOut(duration = 0.25) {
  if (!audioCtx || !masterGain) return;
  const now = audioCtx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterGain.gain.value, now);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
}

/** 开关响度均衡 */
export function setLoudness(on) {
  if (masterComp) masterComp.ratio.value = on ? 3 : 1;
}

/**
 * 频谱分析器（懒创建，供可视化使用）
 * @returns {AnalyserNode|null}
 */
function ensureAnalyser() {
  if (!audioCtx) return null;
  if (!analyserNode) {
    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.82;
  }
  return analyserNode;
}

export function getAnalyser() {
  return analyserNode;
}

/**
 * 初始化 AudioContext 与 EQ 链（懒加载，首次播放/调 EQ 时创建）
 * @param {HTMLAudioElement} audio
 */
export function initAudioCtx(audio) {
  if (audioCtx) return audioCtx;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  sourceNode = audioCtx.createMediaElementSource(audio);
  let prev = sourceNode;
  EQ_FREQS.forEach((f) => {
    const eq = audioCtx.createBiquadFilter();
    eq.type = 'peaking';
    eq.frequency.value = f;
    eq.Q.value = 1.2;
    eq.gain.value = 0;
    eqFilters.push(eq);
    prev.connect(eq);
    prev = eq;
  });
  prev.connect(audioCtx.destination);
  // 频谱分析器挂在 EQ 链末端（不改变信号），再进入主总线
  const an = ensureAnalyser();
  if (an) {
    try { prev.disconnect(audioCtx.destination); } catch (e) { /* ignore */ }
    prev.connect(an);
    an.connect(ensureMasterBus());
  }
  return audioCtx;
}

export function getAudioCtx() {
  return audioCtx;
}

export function getEqFilters() {
  return eqFilters;
}

export function setEqGain(idx, value) {
  if (eqFilters[idx]) eqFilters[idx].gain.value = value;
}

export function resetEqGains() {
  eqFilters.forEach((eq) => { eq.gain.value = 0; });
}

export function resumeAudioCtx() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

// ===== 磁带效果 =====
function createNoiseBuffer(ctx, duration = 2) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function createSaturationCurve(amount = 0.5) {
  const samples = 1024;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    // 软削波：tanh 曲线，模拟磁带饱和
    curve[i] = Math.tanh(x * (1 + amount * 3)) / Math.tanh(1 + amount * 3);
  }
  return curve;
}

function initTapeNodes() {
  if (!audioCtx || tapeNodes.saturation) return;

  // 磁带饱和（软削波）
  tapeNodes.saturation = audioCtx.createWaveShaper();
  tapeNodes.saturation.curve = createSaturationCurve(0.4);
  tapeNodes.saturation.oversample = '4x';

  // 磁带高频衰减（低通 ~16kHz）
  tapeNodes.lowpass = audioCtx.createBiquadFilter();
  tapeNodes.lowpass.type = 'lowpass';
  tapeNodes.lowpass.frequency.value = 16000;
  tapeNodes.lowpass.Q.value = 0.7;

  // 磁带低频提升（搁架 +2dB @ 120Hz）
  tapeNodes.lowshelf = audioCtx.createBiquadFilter();
  tapeNodes.lowshelf.type = 'lowshelf';
  tapeNodes.lowshelf.frequency.value = 120;
  tapeNodes.lowshelf.gain.value = 2;

  // Wow & Flutter（短延迟 + LFO 调制）
  tapeNodes.delay = audioCtx.createDelay(0.02);
  tapeNodes.delay.delayTime.value = 0.005;

  tapeNodes.lfo = audioCtx.createOscillator();
  tapeNodes.lfo.type = 'sine';
  tapeNodes.lfo.frequency.value = 0.6;

  tapeNodes.lfoGain = audioCtx.createGain();
  tapeNodes.lfoGain.gain.value = 0.0008;

  tapeNodes.lfo.connect(tapeNodes.lfoGain);
  tapeNodes.lfoGain.connect(tapeNodes.delay.delayTime);
  tapeNodes.lfo.start();

  // 磁带底噪（嘶嘶声）
  tapeNodes.noise = audioCtx.createBufferSource();
  tapeNodes.noise.buffer = createNoiseBuffer(audioCtx, 3);
  tapeNodes.noise.loop = true;

  tapeNodes.noiseFilter = audioCtx.createBiquadFilter();
  tapeNodes.noiseFilter.type = 'bandpass';
  tapeNodes.noiseFilter.frequency.value = 6000;
  tapeNodes.noiseFilter.Q.value = 0.5;

  tapeNodes.noiseGain = audioCtx.createGain();
  tapeNodes.noiseGain.gain.value = 0.008;

  tapeNodes.noise.connect(tapeNodes.noiseFilter);
  tapeNodes.noiseFilter.connect(tapeNodes.noiseGain);
  tapeNodes.noiseGain.connect(audioCtx.destination);
  tapeNodes.noise.start();
}

function connectTapeChain() {
  if (!audioCtx || !tapeNodes.saturation) return;
  try { sourceNode.disconnect(); } catch (e) { /* ignore */ }
  // 新链：source → saturation → lowpass → lowshelf → delay → EQ → analyser → destination
  sourceNode.connect(tapeNodes.saturation);
  tapeNodes.saturation.connect(tapeNodes.lowpass);
  tapeNodes.lowpass.connect(tapeNodes.lowshelf);
  tapeNodes.lowshelf.connect(tapeNodes.delay);
  let prev = tapeNodes.delay;
  eqFilters.forEach((eq) => { prev.connect(eq); prev = eq; });
  const an = ensureAnalyser();
  if (an) { prev.connect(an); an.connect(ensureMasterBus()); }
  else prev.connect(ensureMasterBus() || audioCtx.destination);
}

function disconnectTapeChain() {
  if (!audioCtx) return;
  try { sourceNode.disconnect(); } catch (e) { /* ignore */ }
  let prev = sourceNode;
  eqFilters.forEach((eq) => { prev.connect(eq); prev = eq; });
  const an = ensureAnalyser();
  if (an) { prev.connect(an); an.connect(ensureMasterBus()); }
  else prev.connect(ensureMasterBus() || audioCtx.destination);
}

export function enableTapeEffect(audio) {
  if (store.get('tapeEnabled')) return;
  initAudioCtx(audio);
  initTapeNodes();
  connectTapeChain();
  store.set('tapeEnabled', true);
}

export function disableTapeEffect() {
  if (!store.get('tapeEnabled')) return;
  disconnectTapeChain();
  store.set('tapeEnabled', false);
}

export function toggleTapeEffect(audio) {
  if (store.get('tapeEnabled')) disableTapeEffect();
  else enableTapeEffect(audio);
}

// ===== USB 音频检测（小尾巴） =====
export async function checkUsbAudio() {
  try {
    const result = await apiClient.detectUsbAudio();
    const connected = !!(result && result.connected);
    store.set('usbAudioConnected', connected);
    return connected;
  } catch (e) {
    return false;
  }
}

export function startUsbAudioWatch(audio, intervalMs = 10000) {
  if (usbCheckTimer) clearInterval(usbCheckTimer);
  checkUsbAudio();
  usbCheckTimer = setInterval(() => checkUsbAudio(), intervalMs);
  // USB 小尾巴接入时自动启用磁带模式
  store.subscribe('usbAudioConnected', ({ value }) => {
    if (value && !store.get('tapeEnabled')) enableTapeEffect(audio);
  });
}

export function stopUsbAudioWatch() {
  if (usbCheckTimer) {
    clearInterval(usbCheckTimer);
    usbCheckTimer = null;
  }
}

export default {
  EQ_FREQS,
  EQ_PRESETS,
  initAudioCtx,
  getAudioCtx,
  getAnalyser,
  getEqFilters,
  setEqGain,
  resetEqGains,
  resumeAudioCtx,
  fadeIn,
  fadeOut,
  setLoudness,
  enableTapeEffect,
  disableTapeEffect,
  toggleTapeEffect,
  checkUsbAudio,
  startUsbAudioWatch,
  stopUsbAudioWatch
};
