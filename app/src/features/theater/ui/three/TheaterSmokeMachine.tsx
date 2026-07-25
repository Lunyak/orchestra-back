import { TransformControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { TheaterLayout } from "../../../../shared/types/script";
import { resolveStageGeometry } from "../../model/theater-stage-geometry";
import type { TheaterSmokePosition } from "../../model/theater-smoke-settings";
import { theaterSmokeEmitFactor } from "../../model/theater-smoke-settings";

const PARTICLE_COUNT = 260;
const EMIT_BASE_PER_SEC = 64;
const LIFE_MIN = 2.8;
const LIFE_MAX = 6.5;

type TheaterSmokeMachineProps = {
  layout: TheaterLayout;
  enabled: boolean;
  position: TheaterSmokePosition;
  intensity: number;
  saturation: number;
  size: number;
  draggable?: boolean;
  onPositionChange?: (position: TheaterSmokePosition) => void;
  onDraggingChange?: (dragging: boolean) => void;
};

function createSoftSmokeTexture() {
  const canvasSize = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(
    canvasSize * 0.5,
    canvasSize * 0.5,
    0,
    canvasSize * 0.5,
    canvasSize * 0.5,
    canvasSize * 0.5,
  );
  gradient.addColorStop(0, "rgba(255,255,255,0.85)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.35)");
  gradient.addColorStop(0.7, "rgba(255,255,255,0.08)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

type ParticleState = {
  life: Float32Array;
  maxLife: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  vz: Float32Array;
  size: Float32Array;
};

function spawnParticle(
  index: number,
  positions: Float32Array,
  state: ParticleState,
  emitter: THREE.Vector3,
  towardAudience: number,
  intensity: number,
) {
  const angle = Math.random() * Math.PI * 2;
  const jetSpread = 0.1 + Math.random() * (0.18 + intensity * 0.22);
  positions[index * 3] = emitter.x + Math.cos(angle) * jetSpread * 0.15;
  positions[index * 3 + 1] = emitter.y + Math.random() * 0.08;
  positions[index * 3 + 2] = emitter.z + Math.sin(angle) * jetSpread * 0.1;

  const speed = (0.4 + Math.random() * 0.7) * (0.55 + intensity * 0.9);
  state.vx[index] = Math.cos(angle) * jetSpread * speed * 0.55;
  state.vy[index] = (0.28 + Math.random() * 0.5) * (0.7 + intensity * 0.6);
  state.vz[index] =
    towardAudience * (0.35 + Math.random() * 0.65) * (0.65 + intensity * 0.7) +
    (Math.random() - 0.5) * 0.25;

  const life = LIFE_MIN + Math.random() * (LIFE_MAX - LIFE_MIN);
  state.life[index] = life;
  state.maxLife[index] = life;
  state.size[index] = 0.55 + Math.random() * 1.1;
}

/** Сценическая дым-машина: струя мягких спрайтов + корпус прибора. */
export function TheaterSmokeMachine({
  layout,
  enabled,
  position,
  intensity,
  saturation,
  size,
  draggable = false,
  onPositionChange,
  onDraggingChange,
}: TheaterSmokeMachineProps) {
  const fixtureRef = useRef<THREE.Group>(null);
  const emitAccRef = useRef(0);
  const dragGestureRef = useRef(false);
  const [dragPreview, setDragPreview] = useState<TheaterSmokePosition | null>(null);
  const texture = useMemo(() => createSoftSmokeTexture(), []);
  const geom = useMemo(() => resolveStageGeometry(layout), [layout]);
  const towardAudience = Math.sign(geom.prosceniumZ - geom.backZ) || 1;
  const displayPosition = dragPreview ?? position;
  const emitterPos = useMemo(
    () => new THREE.Vector3(...displayPosition),
    [displayPosition],
  );
  const emitFactor = theaterSmokeEmitFactor(intensity);
  const emitRate = EMIT_BASE_PER_SEC * emitFactor;
  const alphaScale = 0.18 + Math.max(0, saturation) * 0.55;
  const sizeScale = Math.max(0.05, size);

  const { geometry, state } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const alphas = new Float32Array(PARTICLE_COUNT);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const life = new Float32Array(PARTICLE_COUNT);
    const maxLife = new Float32Array(PARTICLE_COUNT);
    const vx = new Float32Array(PARTICLE_COUNT);
    const vy = new Float32Array(PARTICLE_COUNT);
    const vz = new Float32Array(PARTICLE_COUNT);
    const particleSize = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      life[i] = -1;
      alphas[i] = 0;
      sizes[i] = 0;
      positions[i * 3 + 1] = -99;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    return {
      geometry,
      state: { life, maxLife, vx, vy, vz, size: particleSize } satisfies ParticleState,
    };
  }, []);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      fog: false,
      uniforms: {
        uMap: { value: texture },
        uColor: { value: new THREE.Color("#d8dde3") },
      },
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        attribute float aSize;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (320.0 / max(0.1, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec4 texel = texture2D(uMap, gl_PointCoord);
          float alpha = texel.a * vAlpha;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });
  }, [texture]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
      texture?.dispose();
    };
  }, [geometry, material, texture]);

  useEffect(() => {
    if (enabled) return;
    const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
    const alphas = geometry.getAttribute("aAlpha") as THREE.BufferAttribute;
    const sizes = geometry.getAttribute("aSize") as THREE.BufferAttribute;
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      state.life[i] = -1;
      alphas.setX(i, 0);
      sizes.setX(i, 0);
      positions.setY(i, -99);
    }
    positions.needsUpdate = true;
    alphas.needsUpdate = true;
    sizes.needsUpdate = true;
    emitAccRef.current = 0;
    setDragPreview(null);
    dragGestureRef.current = false;
  }, [enabled, geometry, state]);

  useEffect(() => {
    if (!fixtureRef.current || dragGestureRef.current) return;
    fixtureRef.current.position.set(...displayPosition);
  }, [displayPosition]);

  useFrame((_, delta) => {
    if (!enabled) return;
    const dt = Math.min(0.05, delta);
    const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
    const alphas = geometry.getAttribute("aAlpha") as THREE.BufferAttribute;
    const sizes = geometry.getAttribute("aSize") as THREE.BufferAttribute;
    const posArray = positions.array as Float32Array;

    if (emitRate > 0.001) {
      emitAccRef.current += dt * emitRate;
      while (emitAccRef.current >= 1) {
        emitAccRef.current -= 1;
        let slot = -1;
        for (let i = 0; i < PARTICLE_COUNT; i += 1) {
          if (state.life[i] < 0) {
            slot = i;
            break;
          }
        }
        if (slot < 0) break;
        spawnParticle(slot, posArray, state, emitterPos, towardAudience, emitFactor);
      }
    }

    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      if (state.life[i] < 0) continue;
      state.life[i] -= dt;
      if (state.life[i] <= 0) {
        state.life[i] = -1;
        alphas.setX(i, 0);
        sizes.setX(i, 0);
        positions.setY(i, -99);
        continue;
      }

      state.vx[i] *= 0.992;
      state.vy[i] = state.vy[i] * 0.995 + 0.02 * dt;
      state.vz[i] *= 0.994;
      state.vx[i] += (Math.random() - 0.5) * 0.08 * dt;
      state.vz[i] += (Math.random() - 0.5) * 0.08 * dt;

      posArray[i * 3] += state.vx[i] * dt;
      posArray[i * 3 + 1] += state.vy[i] * dt;
      posArray[i * 3 + 2] += state.vz[i] * dt;

      const age = 1 - state.life[i] / state.maxLife[i];
      const fadeIn = Math.min(1, age / 0.12);
      const fadeOut = Math.min(1, state.life[i] / (state.maxLife[i] * 0.45));
      const alpha = alphaScale * fadeIn * fadeOut;
      const grow = state.size[i] * (0.7 + age * 2.2) * sizeScale;
      alphas.setX(i, alpha);
      sizes.setX(i, grow * 52);
    }

    positions.needsUpdate = true;
    alphas.needsUpdate = true;
    sizes.needsUpdate = true;
  });

  if (!enabled || !texture) return null;

  return (
    <group>
      <group ref={fixtureRef} position={displayPosition}>
        <mesh
          position={[0, 0.05, 0]}
          castShadow={false}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <boxGeometry args={[0.42, 0.22, 0.28]} />
          <meshStandardMaterial color="#3a3f46" roughness={0.85} metalness={0.2} />
        </mesh>
        <mesh
          position={[0, 0.12, towardAudience * 0.14]}
          rotation={[towardAudience > 0 ? Math.PI / 2 : -Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.05, 0.06, 0.1, 12]} />
          <meshStandardMaterial color="#2a2e34" roughness={0.7} metalness={0.35} />
        </mesh>
      </group>
      {draggable && fixtureRef.current ? (
        <TransformControls
          mode="translate"
          object={fixtureRef.current}
          onMouseDown={() => {
            dragGestureRef.current = true;
            onDraggingChange?.(true);
          }}
          onMouseUp={() => {
            dragGestureRef.current = false;
            const pending = dragPreview;
            setDragPreview(null);
            if (pending) onPositionChange?.(pending);
            onDraggingChange?.(false);
          }}
          onObjectChange={() => {
            if (!fixtureRef.current) return;
            if (!dragGestureRef.current) {
              dragGestureRef.current = true;
              onDraggingChange?.(true);
            }
            const { x, y, z } = fixtureRef.current.position;
            setDragPreview([x, Math.max(0.05, y), z]);
          }}
        />
      ) : null}
      <points geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}
