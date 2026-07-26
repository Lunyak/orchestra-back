import { Suspense, useEffect, useMemo, useState } from "react";
import {
  CanvasTexture,
  FrontSide,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";
import type { SiteEvent } from "../../shared/model/siteContent";
import { createChalkTexture, ensureChalkFont } from "./createChalkTexture";
import { PlayerControls, ROOM } from "./PlayerControls";
import { SuitcaseWall } from "./SuitcaseWall";

const ROOM_W = 12;
const ROOM_D = 18;
const ROOM_H = 3.6;

type TheaterSceneProps = {
  events: SiteEvent[];
  onFacingChange?: (facing: string) => void;
};

export function TheaterScene({ events, onFacingChange }: TheaterSceneProps) {
  return (
    <>
      <color attach="background" args={["#050405"]} />
      <fog attach="fog" args={["#050405", 10, 24]} />
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 2.5, 5]} intensity={22} color="#ffd7b0" distance={14} decay={2} />
      <pointLight position={[0, 2.5, -3]} intensity={14} color="#c9d4ff" distance={12} decay={2} />
      <pointLight position={[-4, 2.2, 1]} intensity={12} color="#fff1d6" distance={9} decay={2} />

      <ProceduralHall />

      <Suspense fallback={null}>
        <ChalkPlaybill events={events} />
        <SuitcaseWall />
      </Suspense>

      <PlayerControls onFacingChange={onFacingChange} />
    </>
  );
}

function createFloorGridTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new CanvasTexture(canvas);

  ctx.fillStyle = "#141116";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 2;
  const step = 32;
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(184,53,74,0.35)";
  ctx.strokeRect(2, 2, size - 4, size - 4);

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(ROOM_W / 2, ROOM_D / 2);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function ProceduralHall() {
  const floorMap = useMemo(() => createFloorGridTexture(), []);

  useEffect(() => {
    return () => floorMap.dispose();
  }, [floorMap]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial map={floorMap} roughness={0.92} metalness={0} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ROOM_H, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color="#070608" roughness={1} />
      </mesh>

      <mesh position={[-ROOM_W / 2, ROOM_H / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[ROOM_D, ROOM_H]} />
        <meshStandardMaterial color="#0a090b" roughness={0.96} side={FrontSide} />
      </mesh>
      <mesh position={[ROOM_W / 2, ROOM_H / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[ROOM_D, ROOM_H]} />
        <meshStandardMaterial color="#0a090b" roughness={0.96} side={FrontSide} />
      </mesh>
      <mesh position={[0, ROOM_H / 2, -ROOM_D / 2]}>
        <planeGeometry args={[ROOM_W, ROOM_H]} />
        <meshStandardMaterial color="#0a090b" roughness={0.96} side={FrontSide} />
      </mesh>
      <mesh position={[0, ROOM_H / 2, ROOM_D / 2]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_H]} />
        <meshStandardMaterial color="#0a090b" roughness={0.96} side={FrontSide} />
      </mesh>

      {/* Orientation strips on walls */}
      <mesh position={[-ROOM_W / 2 + 0.01, 0.2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[ROOM_D, 0.12]} />
        <meshStandardMaterial color="#b8354a" roughness={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ROOM.spawnX, 0.02, ROOM.spawnZ]}>
        <circleGeometry args={[0.4, 28]} />
        <meshStandardMaterial color="#b8354a" roughness={0.8} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function ChalkPlaybill({ events }: { events: SiteEvent[] }) {
  const [texture, setTexture] = useState<CanvasTexture | null>(null);

  useEffect(() => {
    let alive = true;
    let created: CanvasTexture | null = null;

    ensureChalkFont().then(() => {
      if (!alive) return;
      created = createChalkTexture(events);
      setTexture((prev) => {
        prev?.dispose();
        return created;
      });
    });

    return () => {
      alive = false;
      created?.dispose();
    };
  }, [events]);

  if (!texture) return null;

  return (
    <group position={[-ROOM_W / 2 + 0.02, 1.75, 0.2]} rotation={[0, Math.PI / 2, 0]}>
      <mesh>
        <planeGeometry args={[5.6, 3.1]} />
        <meshBasicMaterial map={texture} side={FrontSide} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0.2, 1.4]} intensity={8} color="#f0ebe0" distance={5.5} />
    </group>
  );
}
