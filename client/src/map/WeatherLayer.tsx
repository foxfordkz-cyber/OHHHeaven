// Weather over the map: rain and snow particles on a canvas, tints for heat, clouds and storms.
import { useEffect, useRef } from 'react';
import type { WeatherCondition } from '@ohh/shared/types';

interface Drop { x: number; y: number; v: number; len: number; drift: number; r: number }

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function WeatherLayer({ condition }: { condition?: WeatherCondition }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particles = condition === 'rain' || condition === 'storm' ? 'rain' : condition === 'snow' ? 'snow' : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !particles || reducedMotion()) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0, h = 0, raf = 0, last = performance.now();
    let drops: Drop[] = [];
    const seed = (i: number) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(particles === 'rain' ? 220 : 140, Math.round((w * h) / (particles === 'rain' ? 5200 : 7000)));
      drops = Array.from({ length: count }, (_, i) => ({
        x: seed(i) * w, y: seed(i + 99) * h,
        v: particles === 'rain' ? 650 + seed(i + 7) * 450 : 28 + seed(i + 7) * 40,
        len: 10 + seed(i + 3) * 14, drift: particles === 'rain' ? 120 : 16 + seed(i + 5) * 20, r: 1 + seed(i + 11) * 2.2,
      }));
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      if (particles === 'rain') {
        ctx.strokeStyle = 'rgba(170, 200, 255, 0.38)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (const d of drops) {
          d.y += d.v * dt; d.x += d.drift * dt * 0.25;
          if (d.y > h + 20) { d.y = -20; d.x = Math.random() * w; }
          if (d.x > w + 10) d.x = -10;
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - d.len * 0.18, d.y - d.len);
        }
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(235, 242, 255, 0.85)';
        for (const d of drops) {
          d.y += d.v * dt; d.x += Math.sin((now / 1000) * 0.8 + d.r * 3) * d.drift * dt;
          if (d.y > h + 6) { d.y = -6; d.x = Math.random() * w; }
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = document.hidden ? 0 : requestAnimationFrame(frame);
    };
    const onVisible = () => { if (!document.hidden && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    document.addEventListener('visibilitychange', onVisible);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', onVisible); };
  }, [particles]);

  if (!condition || condition === 'clear') return null;
  return (
    <div className={`cm-weather cm-weather--${condition}`} aria-hidden="true">
      {particles && <canvas ref={canvasRef} className="cm-weather__canvas" />}
    </div>
  );
}
