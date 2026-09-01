/**
 * visualizer.js — 频谱可视化
 * 职责：在播放详情页用 canvas 绘制实时频谱（rAF 驱动）。
 */
import * as audioEngine from './audioEngine.js';

let running = false;

export function startVisualizer() {
  const canvas = document.getElementById('visualizer');
  if (!canvas || running) return;
  running = true;
  const ctx = canvas.getContext('2d');
  const barCount = 48;
  const BAR_W = canvas.width / barCount;

  function draw() {
    if (!running) return;
    requestAnimationFrame(draw);
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const an = audioEngine.getAnalyser();
    if (an) {
      const data = new Uint8Array(an.frequencyBinCount);
      an.getByteFrequencyData(data);
      for (let i = 0; i < barCount; i++) {
        // 指数映射：低频更密，覆盖主要频段
        const idx = Math.floor(Math.pow(i / barCount, 1.4) * data.length * 0.85);
        const v = (data[idx] || 0) / 255;
        const bh = Math.max(3, v * (h - 6));
        ctx.fillStyle = `rgba(28, 28, 30, ${0.22 + v * 0.65})`;
        ctx.beginPath();
        ctx.roundRect(i * BAR_W + 2, h - bh, BAR_W - 4, bh, 3);
        ctx.fill();
      }
    } else {
      // 无分析器：静态占位条
      ctx.fillStyle = 'rgba(28, 28, 30, 0.14)';
      for (let i = 0; i < barCount; i++) {
        const bh = 6 + (i % 6) * 4;
        ctx.beginPath();
        ctx.roundRect(i * BAR_W + 2, h - bh, BAR_W - 4, bh, 3);
        ctx.fill();
      }
    }
  }
  draw();
}

export function stopVisualizer() {
  running = false;
}

export default { startVisualizer, stopVisualizer };
