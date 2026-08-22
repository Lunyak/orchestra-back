import { FC, useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import "./neon-smoke.css";

type NeonSmokeProps = {
  className?: string;
  variant?: "spotlight" | "stage";
};

type Wisp = {
  x: number;
  y: number;
  z: number;
  r: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  phase: number;
  kind: "fog" | "dust";
};

/** Ширина конуса на высоте y (0 сверху → 1 снизу) */
function coneHalfWidth(width: number, depth: number) {
  const top = width * 0.035;
  const bottom = width * 0.34;
  return top + (bottom - top) * depth;
}

function spawnSpotlightWisp(width: number, height: number, kind: "fog" | "dust"): Wisp {
  const depth = kind === "fog" ? 0.55 + Math.random() * 0.42 : Math.random();
  const y = height * (0.08 + depth * 0.88);
  const half = coneHalfWidth(width, depth);
  const x = width * 0.5 + (Math.random() - 0.5) * half * 2 * (0.35 + Math.random() * 0.65);

  if (kind === "dust") {
    return {
      x,
      y,
      z: depth,
      r: 1.2 + Math.random() * 2.8,
      vx: (Math.random() - 0.5) * 0.12,
      vy: 0.08 + Math.random() * 0.22,
      life: 0,
      maxLife: 3 + Math.random() * 5,
      phase: Math.random() * Math.PI * 2,
      kind,
    };
  }

  return {
    x,
    y: height * (0.58 + Math.random() * 0.4),
    z: 0.75 + Math.random() * 0.2,
    r: 36 + Math.random() * 90,
    vx: (Math.random() - 0.5) * 0.2,
    vy: -0.12 - Math.random() * 0.2,
    life: 0,
    maxLife: 4 + Math.random() * 5,
    phase: Math.random() * Math.PI * 2,
    kind,
  };
}

function spawnStageWisp(width: number, height: number, side: 0 | 1): Wisp {
  const edgePad = width * 0.01;
  const band = width * 0.28;
  const x =
    side === 0
      ? edgePad + Math.random() * band
      : width - edgePad - Math.random() * band;

  return {
    x,
    y: height * (0.55 + Math.random() * 0.55),
    z: 0.5,
    r: 48 + Math.random() * 110,
    vx: (side === 0 ? 1 : -1) * (0.04 + Math.random() * 0.14),
    vy: -0.22 - Math.random() * 0.38,
    life: 0,
    maxLife: 5.5 + Math.random() * 6.5,
    phase: Math.random() * Math.PI * 2,
    kind: "fog",
  };
}

export const NeonSmoke: FC<NeonSmokeProps> = ({
  className,
  variant = "spotlight",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [motionOk, setMotionOk] = useState(false);
  const isSpotlight = variant === "spotlight";

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotionOk(!reduceMotion.matches);
    update();
    reduceMotion.addEventListener("change", update);
    return () => reduceMotion.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!motionOk) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let alive = true;
    let last = performance.now();
    const wisps: Wisp[] = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const fogCount = isSpotlight ? (w < 720 ? 12 : 20) : w < 720 ? 32 : 56;
      const dustCount = isSpotlight ? (w < 720 ? 45 : 90) : 0;

      wisps.length = 0;
      for (let i = 0; i < fogCount; i++) {
        wisps.push(
          isSpotlight
            ? spawnSpotlightWisp(w, h, "fog")
            : spawnStageWisp(w, h, (i % 2) as 0 | 1)
        );
      }
      for (let i = 0; i < dustCount; i++) {
        wisps.push(spawnSpotlightWisp(w, h, "dust"));
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const tick = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      for (let i = 0; i < wisps.length; i++) {
        const p = wisps[i];
        p.life += dt;
        p.phase += dt * (p.kind === "dust" ? 1.4 : 0.85);

        if (p.kind === "dust") {
          p.x += p.vx + Math.sin(p.phase) * 0.25;
          p.y += p.vy;
          p.z = Math.min(1, Math.max(0, (p.y / h - 0.08) / 0.88));
        } else {
          p.x += p.vx + Math.sin(p.phase) * 0.4;
          p.y += p.vy + Math.cos(p.phase * 0.55) * 0.08;
        }

        const t = p.life / p.maxLife;
        const fade = t < 0.12 ? t / 0.12 : t > 0.75 ? (1 - t) / 0.25 : 1;

        if (p.kind === "dust") {
          const depthFade = 0.35 + p.z * 0.65;
          const alpha = fade * depthFade * 0.55;
          const size = p.r * (0.7 + p.z * 0.9);
          ctx.fillStyle = `rgba(200, 255, 255, ${alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(0, 251, 255, ${alpha * 0.35})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size * 2.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const floorBoost = isSpotlight
            ? Math.max(0.3, 1 - Math.abs(p.y - h * 0.8) / (h * 0.35))
            : Math.max(0.25, 1 - ((h - p.y) / h) * 0.35);
          const alpha = (0.06 + fade * 0.16) * floorBoost;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          g.addColorStop(0, `rgba(0, 251, 255, ${alpha})`);
          g.addColorStop(0.45, `rgba(0, 180, 200, ${alpha * 0.35})`);
          g.addColorStop(1, "rgba(0, 251, 255, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }

        const depth = Math.min(1, Math.max(0, (p.y / h - 0.05) / 0.9));
        const half = coneHalfWidth(w, depth);
        const outOfCone =
          isSpotlight && Math.abs(p.x - w * 0.5) > half * 1.15;
        const outY = p.kind === "dust" ? p.y > h * 0.96 || p.y < h * 0.04 : p.y < h * 0.3;

        if (p.life >= p.maxLife || outOfCone || outY) {
          if (isSpotlight) {
            wisps[i] = spawnSpotlightWisp(w, h, p.kind);
            if (p.kind === "dust") wisps[i].y = h * 0.06;
            else wisps[i].y = h + wisps[i].r * 0.12;
          } else {
            wisps[i] = spawnStageWisp(w, h, i % 2 === 0 ? 0 : 1);
          }
        }
      }

      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [motionOk, isSpotlight]);

  return (
    <div
      className={cn(
        "neon-smoke",
        isSpotlight ? "neon-smoke--spotlight" : "neon-smoke--stage",
        className
      )}
      aria-hidden
    >
      <div className="neon-smoke__veil" />
      <div className="neon-smoke__volume">
        <div className="neon-smoke__beam neon-smoke__beam--outer" />
        <div className="neon-smoke__beam neon-smoke__beam--mid" />
        <div className="neon-smoke__beam neon-smoke__beam--core" />
        <div className="neon-smoke__lamp" />
      </div>
      {motionOk && <canvas ref={canvasRef} className="neon-smoke__canvas" />}
      <div className="neon-smoke__floor">
        <div className="neon-smoke__floor-pool" />
        <div className="neon-smoke__floor-ring" />
        <svg
          className="neon-smoke__floor-triangle"
          viewBox="0 0 64 56"
          fill="none"
          aria-hidden
        >
          <path
            d="M32 4 L60 52 H4 Z"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinejoin="miter"
          />
        </svg>
      </div>
      <div className="neon-smoke__grain" />
    </div>
  );
};
