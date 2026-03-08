import { FC, useEffect, useMemo, useRef } from "react";
import "./SmokeText.css";

interface IProps {
  color?: number;
  text?: string;
}

type Particle = {
  x: number;
  y: number;
  r: number;
  a: number;
  rot: number;
  vr: number;
  vx: number;
  vy: number;
  phase: number;
  speed: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function colorToCssHex(input: number) {
  const v = input >>> 0;
  return `#${v.toString(16).padStart(6, "0").slice(-6)}`;
}

const SmokeText: FC<IProps> = ({ color = 0x0a6b5e, text = "Дофамин" }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const cssColor = useMemo(() => colorToCssHex(color), [color]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduceMotion) return;

    let disposed = false;
    let raf = 0;
    let lastT = performance.now();
    let width = 0;
    let height = 0;
    let dpr = 1;

    // Рендерим на пониженном внутреннем разрешении (дешевле CPU/GPU), но растягиваем CSS-ом.
    const internalScale = 0.7;

    const makeSmokeSprite = (size: number) => {
      const off = document.createElement("canvas");
      off.width = size;
      off.height = size;
      const octx = off.getContext("2d");
      if (!octx) return off;

      const g = octx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2
      );
      // Мягкая “дымка” без картинки: меньше декодинга/памяти.
      g.addColorStop(0, "rgba(255,255,255,0.70)");
      g.addColorStop(0.35, "rgba(255,255,255,0.22)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      octx.fillStyle = g;
      octx.fillRect(0, 0, size, size);
      return off;
    };

    const sprite = makeSmokeSprite(128);

    const particleCount = 26;
    const particles: Particle[] = Array.from({ length: particleCount }).map(() => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.18 + Math.random() * 0.22,
      a: 0.22 + Math.random() * 0.18,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.25,
      vx: (Math.random() - 0.5) * 0.015,
      vy: (Math.random() - 0.5) * 0.012,
      phase: Math.random() * Math.PI * 2,
      speed: 0.35 + Math.random() * 0.55,
    }));

    const resize = () => {
      const rect = root.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      dpr = clamp(window.devicePixelRatio || 1, 1, 1.8);
      const cw = Math.max(1, Math.floor(width * dpr * internalScale));
      const ch = Math.max(1, Math.floor(height * dpr * internalScale));
      if (canvas.width !== cw) canvas.width = cw;
      if (canvas.height !== ch) canvas.height = ch;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // Рисуем в координатах CSS-пикселей
      ctx.scale((cw / width) / dpr, (ch / height) / dpr);
    };

    const ro = new ResizeObserver(() => resize());
    ro.observe(root);
    resize();

    const draw = (now: number) => {
      if (disposed) return;

      const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
      lastT = now;

      // Полная пауза при скрытой вкладке (без пустых RAF-циклов).
      if (document.hidden) {
        raf = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Лёгкий “туман” фоном.
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillRect(0, 0, width, height);

      // Дым: tinted + screen blend
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = cssColor;
      ctx.globalAlpha = 1;
      ctx.fillRect(0, 0, 1, 1); // прогрев пайплайна; почти бесплатно

      for (const p of particles) {
        p.phase += dt * p.speed;
        const driftX = Math.sin(p.phase) * 0.012 + Math.cos(p.phase * 0.7) * 0.008;
        const driftY = Math.cos(p.phase * 0.9) * 0.010 + Math.sin(p.phase * 0.5) * 0.006;

        p.x = (p.x + (p.vx + driftX) * dt * 60 + 1) % 1;
        p.y = (p.y + (p.vy + driftY) * dt * 60 + 1) % 1;
        p.rot += p.vr * dt;

        const px = (p.x - 0.5) * width;
        const py = (p.y - 0.5) * height;
        const size = Math.min(width, height) * p.r * 1.25;

        ctx.save();
        ctx.translate(width / 2 + px, height / 2 + py);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.a;

        // Тонируем дым цветом через fillRect + multiply
        ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = cssColor;
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.restore();

        ctx.globalCompositeOperation = "screen";
      }

      // Небольшая “вуаль”, чтобы эффект был мягче и не мерцал.
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    const onVisibility = () => {
      // При возврате во вкладку — сбрасываем дельту, чтобы не “прыгало”.
      lastT = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      ro.disconnect();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [cssColor]);

  return (
    <div className="smoke" ref={rootRef} aria-hidden>
      <canvas className="smoke__canvas" ref={canvasRef} />
      {text ? <div className="smoke__text">{text}</div> : null}
    </div>
  );
};

export default SmokeText;
