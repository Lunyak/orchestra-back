import { useGLTF, useTexture } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import {
  DoubleSide,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
  Texture,
} from "three";
const WALL_URL = "/theater/suitcase-wall.glb";

/** Local copies under public/ — reliable in 3D scene without MinIO */
const ACTORS = [
  { name: "Анастасия Рябых", img: "/theater/actors/nastya.JPG" },
  { name: "Виктория Юркова", img: "/theater/actors/vica-2.JPG" },
  { name: "Алексей Филатов", img: "/theater/actors/lesha.jpg" },
  { name: "Антон Васильев", img: "/theater/actors/anton.jpg" },
  { name: "Ксения", img: "/theater/actors/ksysha-2.JPG" },
  { name: "Григорий Найдёнов", img: "/theater/actors/grisha.jpg" },
  { name: "Алена Паршина", img: "/theater/actors/alena.JPG" },
  { name: "Екатерина Слыххановская", img: "/theater/actors/katya.JPG" },
  { name: "Полина Смолкина", img: "/theater/actors/polina.jpg" },
  { name: "Вероника Атушева", img: "/theater/actors/nika.JPG" },
  { name: "Сергей Луняка", img: "/theater/actors/ya.JPG" },
  { name: "Лера Буракова", img: "/theater/actors/lera.jpg" },
] as const;

const ACTOR_URLS = ACTORS.map((a) => a.img);

/** Local wall space: X along wall, Y up, +Z into the hall */
const PORTRAIT_SLOTS: { x: number; y: number; w: number; h: number }[] = [
  { x: -4.2, y: 2.55, w: 0.95, h: 1.15 },
  { x: -2.7, y: 2.4, w: 0.85, h: 1.05 },
  { x: -1.2, y: 2.6, w: 1.05, h: 1.2 },
  { x: 0.4, y: 2.35, w: 0.9, h: 1.1 },
  { x: 2.0, y: 2.55, w: 0.95, h: 1.15 },
  { x: 3.6, y: 2.4, w: 0.85, h: 1.05 },
  { x: -3.5, y: 1.25, w: 1.0, h: 1.15 },
  { x: -1.8, y: 1.15, w: 0.9, h: 1.05 },
  { x: -0.2, y: 1.3, w: 1.05, h: 1.2 },
  { x: 1.5, y: 1.2, w: 0.95, h: 1.1 },
  { x: 3.1, y: 1.25, w: 0.9, h: 1.05 },
  { x: 4.4, y: 1.15, w: 0.8, h: 0.95 },
];

function hideBrokenGlbPortraits(root: Object3D) {
  root.traverse((obj) => {
    if ((obj.name || "").startsWith("Portrait_")) {
      obj.visible = false;
    }
  });
}

function PortraitPlane({
  map,
  width,
  height,
}: {
  map: Texture;
  width: number;
  height: number;
}) {
  const material = useMemo(() => {
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 8;
    map.needsUpdate = true;
    return new MeshStandardMaterial({
      map,
      color: "#c8c4bc",
      roughness: 0.88,
      metalness: 0,
      side: DoubleSide,
      emissiveMap: map,
      emissive: "#333028",
      emissiveIntensity: 0.5,
    });
  }, [map]);

  return (
    <group>
      <mesh position={[0, 0, -0.012]}>
        <planeGeometry args={[width * 1.1, height * 1.1]} />
        <meshStandardMaterial color="#120e0c" roughness={0.95} />
      </mesh>
      <mesh material={material}>
        <planeGeometry args={[width, height]} />
      </mesh>
    </group>
  );
}

function PortraitLayer() {
  const textures = useTexture(ACTOR_URLS) as Texture[];

  return (
    <>
      {PORTRAIT_SLOTS.map((slot, index) => {
        const map = textures[index];
        if (!map) return null;
        return (
          <group key={ACTORS[index].name} position={[slot.x, slot.y, 0.58]}>
            <PortraitPlane map={map} width={slot.w} height={slot.h} />
          </group>
        );
      })}
    </>
  );
}

/**
 * Suitcase bodies from Blender + portrait photos as Three.js planes facing the room.
 */
export function SuitcaseWall() {
  const { scene } = useGLTF(WALL_URL);

  const wallMesh = useMemo(() => {
    const root = scene.clone(true);
    hideBrokenGlbPortraits(root);
    return root;
  }, [scene]);

  return (
    <group position={[5.25, 0, 0.1]} rotation={[0, -Math.PI / 2, 0]}>
      <spotLight
        position={[0, 2.8, 3.2]}
        angle={0.9}
        penumbra={0.45}
        intensity={60}
        color="#f2e6cc"
        distance={16}
      />
      <pointLight position={[0, 1.8, 2.2]} intensity={24} color="#ffe7c8" distance={10} />

      <primitive object={wallMesh} />

      <Suspense fallback={null}>
        <PortraitLayer />
      </Suspense>
    </group>
  );
}

useGLTF.preload(WALL_URL);
