import {
  Billboard,
  OrbitControls,
  Text,
  TransformControls,
  useAnimations,
  useGLTF,
  useTexture,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Dispatch,
  SetStateAction,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import grassTexture from "../../assets/grass.jpg";
import {
  ScriptStep,
  TheaterLayout,
  TheaterModel,
  TheaterSpotlight,
} from "../../types/script";
import "./style.css";

const TheaterChair = ({ position }: { position: [number, number, number] }) => (
  <group position={position} rotation={[0, Math.PI, 0]}>
    <mesh position={[0, 0.18, 0]} castShadow>
      <boxGeometry args={[0.7, 0.12, 0.6]} />
      <meshStandardMaterial color="#334155" />
    </mesh>
    <mesh position={[0, 0.48, -0.22]} castShadow>
      <boxGeometry args={[0.7, 0.6, 0.1]} />
      <meshStandardMaterial color="#1e293b" />
    </mesh>
    <mesh position={[-0.26, 0.09, -0.18]} castShadow>
      <boxGeometry args={[0.08, 0.18, 0.08]} />
      <meshStandardMaterial color="#0f172a" />
    </mesh>
    <mesh position={[0.26, 0.09, -0.18]} castShadow>
      <boxGeometry args={[0.08, 0.18, 0.08]} />
      <meshStandardMaterial color="#0f172a" />
    </mesh>
    <mesh position={[-0.26, 0.09, 0.22]} castShadow>
      <boxGeometry args={[0.08, 0.18, 0.08]} />
      <meshStandardMaterial color="#0f172a" />
    </mesh>
    <mesh position={[0.26, 0.09, 0.22]} castShadow>
      <boxGeometry args={[0.08, 0.18, 0.08]} />
      <meshStandardMaterial color="#0f172a" />
    </mesh>
  </group>
);

const SeatRow = ({
  row,
  layout,
}: {
  row: number;
  layout: TheaterLayout;
}) => {
  const offset = (layout.seatsPerRow - 1) * layout.seatSpacing * 0.5;
  const aisleLeft = layout.aisleCenterX - layout.aisleWidth / 2;
  const aisleRight = layout.aisleCenterX + layout.aisleWidth / 2;
  const z = layout.audienceStartZ + row * layout.rowSpacing;
  const y = 0.35 + row * layout.rowRise;

  return (
    <>
      {Array.from({ length: layout.seatsPerRow }).map((_, index) => {
        const x = index * layout.seatSpacing - offset;
        if (x >= aisleLeft && x <= aisleRight) return null;
        return <TheaterChair key={`${row}-${index}`} position={[x, y, z]} />;
      })}
    </>
  );
};

const StrawGridModel = ({
  size = 6,
}: {
  size?: number;
}) => {
  const grassMap = useTexture(grassTexture);

  useEffect(() => {
    grassMap.wrapS = THREE.RepeatWrapping;
    grassMap.wrapT = THREE.RepeatWrapping;
    grassMap.repeat.set(size / 2, size / 2);
    grassMap.anisotropy = 4;
    grassMap.colorSpace = THREE.SRGBColorSpace;
    grassMap.needsUpdate = true;
  }, [grassMap, size]);

  const ignoreRaycast = useCallback(() => null, []);

  return (
    <group raycast={ignoreRaycast}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
        receiveShadow
        raycast={ignoreRaycast}
      >
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial
          map={grassMap}
          color="#8a9b86"
          roughness={1}
          metalness={0}
        />
      </mesh>
    </group>
  );
};

const DancerModel = ({ tone }: { tone?: string | null }) => {
  const rootRef = useRef<THREE.Group | null>(null);
  const leftArmRef = useRef<THREE.Group | null>(null);
  const rightArmRef = useRef<THREE.Group | null>(null);
  const leftLegRef = useRef<THREE.Group | null>(null);
  const rightLegRef = useRef<THREE.Group | null>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (rootRef.current) {
      rootRef.current.rotation.y = Math.sin(t * 0.6) * 0.25;
      rootRef.current.rotation.z = Math.sin(t * 2.4) * 0.12;
      rootRef.current.position.y = Math.abs(Math.sin(t * 2.6)) * 0.07;
    }
    const armWave = Math.sin(t * 4.2);
    const armSwing = Math.sin(t * 2.1);
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = armWave * 1.2 + 0.6;
      leftArmRef.current.rotation.z = 0.4 + armSwing * 0.3;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = -armWave * 1.2 + 0.6;
      rightArmRef.current.rotation.z = -0.4 - armSwing * 0.3;
    }
    const legKick = Math.sin(t * 3.4);
    if (leftLegRef.current) {
      leftLegRef.current.rotation.x = legKick * 0.6;
      leftLegRef.current.rotation.z = Math.sin(t * 2.7) * 0.2;
    }
    if (rightLegRef.current) {
      rightLegRef.current.rotation.x = -legKick * 0.6;
      rightLegRef.current.rotation.z = -Math.sin(t * 2.7) * 0.2;
    }
  });

  const skin = tone || "#cbd5f5";
  const cloth = tone || "#94a3b8";
  const dark = tone || "#64748b";

  return (
    <group ref={rootRef}>
      <mesh position={[0, 1.6, 0]} castShadow>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.28, 0.9, 18]} />
        <meshStandardMaterial color={cloth} />
      </mesh>
      <group ref={leftArmRef} position={[-0.38, 1.3, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.6, 12]} />
          <meshStandardMaterial color={dark} />
        </mesh>
      </group>
      <group ref={rightArmRef} position={[0.38, 1.3, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.6, 12]} />
          <meshStandardMaterial color={dark} />
        </mesh>
      </group>
      <group ref={leftLegRef} position={[-0.16, 0.9, 0]}>
        <mesh position={[0, -0.45, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.9, 12]} />
          <meshStandardMaterial color={dark} />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.16, 0.9, 0]}>
        <mesh position={[0, -0.45, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.9, 12]} />
          <meshStandardMaterial color={dark} />
        </mesh>
      </group>
    </group>
  );
};

const TheaterStage = ({ layout }: { layout: TheaterLayout }) => (
  <>
    <ambientLight intensity={0.45} />
    <directionalLight position={[6, 8, 4]} intensity={1.1} castShadow />

    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[layout.hallWidth, layout.hallDepth]} />
      <meshStandardMaterial color="#111827" />
    </mesh>

    <mesh position={[0, layout.wallHeight / 2, -layout.hallDepth / 2]} receiveShadow>
      <planeGeometry args={[layout.hallWidth, layout.wallHeight]} />
      <meshStandardMaterial color="#0f172a" side={THREE.FrontSide} />
    </mesh>

    <mesh
      position={[-layout.hallWidth / 2, layout.wallHeight / 2, 0]}
      rotation={[0, Math.PI / 2, 0]}
      receiveShadow
    >
      <planeGeometry args={[layout.hallDepth, layout.wallHeight]} />
      <meshStandardMaterial color="#111827" side={THREE.FrontSide} />
    </mesh>

    <mesh
      position={[layout.hallWidth / 2, layout.wallHeight / 2, 0]}
      rotation={[0, -Math.PI / 2, 0]}
      receiveShadow
    >
      <planeGeometry args={[layout.hallDepth, layout.wallHeight]} />
      <meshStandardMaterial color="#111827" side={THREE.FrontSide} />
    </mesh>

    <mesh
      position={[-layout.hallWidth / 2 + 0.02, layout.doorHeight / 2, layout.doorZ]}
      rotation={[0, Math.PI / 2, 0]}
    >
      <planeGeometry args={[layout.doorWidth, layout.doorHeight]} />
      <meshStandardMaterial color="#22c55e" side={THREE.FrontSide} />
    </mesh>

    {Array.from({ length: layout.seatRows }).map((_, row) => (
      <SeatRow key={row} row={row} layout={layout} />
    ))}
  </>
);

const DEFAULT_SPOTLIGHTS: TheaterSpotlight[] = [
  {
    id: 1,
    label: "Софит 1",
    position: [-4, 6, 6],
    target: [-2, 1, 2],
    angleDeg: 18,
    intensity: 1.1,
    color: "#fbbf24",
    enabled: true,
    channel: 1,
  },
  {
    id: 2,
    label: "Софит 2",
    position: [0, 6, 6],
    target: [0, 1, 2],
    angleDeg: 22,
    intensity: 1.2,
    color: "#f59e0b",
    enabled: true,
    channel: 2,
  },
  {
    id: 3,
    label: "Софит 3",
    position: [4, 6, 6],
    target: [2, 1, 2],
    angleDeg: 20,
    intensity: 1.0,
    color: "#f97316",
    enabled: true,
    channel: 3,
  },
];

const SpotlightCone = ({
  position,
  target,
  angleDeg,
  intensity,
  color,
}: {
  position: [number, number, number];
  target: [number, number, number];
  angleDeg: number;
  intensity: number;
  color?: string;
}) => {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const length = useMemo(() => {
    const start = new THREE.Vector3(...position);
    const end = new THREE.Vector3(...target);
    return Math.max(0.2, start.distanceTo(end));
  }, [position, target]);
  const radius = useMemo(() => {
    const angle = THREE.MathUtils.degToRad(angleDeg);
    return Math.max(0.08, length * Math.tan(angle));
  }, [angleDeg, length]);
  const geometry = useMemo(() => {
    const cone = new THREE.ConeGeometry(radius, length, 12, 1, true);
    cone.translate(0, -length / 2, 0);
    return cone;
  }, [length, radius]);
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(color || "#fbbf24") },
        uLength: { value: length },
        uAngle: { value: THREE.MathUtils.degToRad(angleDeg) },
        uIntensity: { value: intensity },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uLength;
        uniform float uAngle;
        uniform float uIntensity;
        varying vec3 vPos;
        void main() {
          float t = clamp(-vPos.y / uLength, 0.0, 1.0);
          float radius = tan(uAngle) * uLength * t;
          float dist = length(vPos.xz);
          float edge = smoothstep(radius, radius * 0.6, dist);
          float core = smoothstep(0.0, radius * 0.2, dist);
          float baseAlpha = (1.0 - edge) * (1.0 - t) * (1.0 - core * 0.4);
          float alpha = clamp(baseAlpha * (uIntensity / 2.0), 0.0, 0.6);
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });
  }, [angleDeg, color, intensity, length]);

  useEffect(() => {
    if (!meshRef.current) return;
    const start = new THREE.Vector3(...position);
    const end = new THREE.Vector3(...target);
    const direction = end.clone().sub(start);
    if (direction.length() < 0.001) return;
    direction.normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, -1, 0),
      direction
    );
    meshRef.current.position.copy(start);
    meshRef.current.quaternion.copy(quaternion);
  }, [position, target]);

  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uColor.value.set(color || "#fbbf24");
    materialRef.current.uniforms.uLength.value = length;
    materialRef.current.uniforms.uAngle.value = THREE.MathUtils.degToRad(angleDeg);
    materialRef.current.uniforms.uIntensity.value = intensity;
  }, [angleDeg, color, intensity, length]);

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </mesh>
  );
};

const BuiltinModel = ({
  kind,
  isSelected,
  isHovered,
}: {
  kind: TheaterModel["builtin"];
  isSelected?: boolean;
  isHovered?: boolean;
}) => {
  const tone = isSelected ? "#ef4444" : isHovered ? "#3b82f6" : null;
  if (kind === "roundTable") {
    return (
      <group>
        <mesh position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.8, 0.8, 0.08, 24]} />
          <meshStandardMaterial color={tone || "#8b5e34"} />
        </mesh>
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 0.5, 16]} />
          <meshStandardMaterial color={tone || "#6b4423"} />
        </mesh>
        <mesh position={[0, 0.05, 0]} castShadow>
          <cylinderGeometry args={[0.35, 0.35, 0.06, 20]} />
          <meshStandardMaterial color={tone || "#6b4423"} />
        </mesh>
      </group>
    );
  }
  if (kind === "chair") {
    return (
      <group>
        <mesh position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.5, 0.08, 0.5]} />
          <meshStandardMaterial color={tone || "#475569"} />
        </mesh>
        <mesh position={[0, 0.43, -0.2]} castShadow>
          <boxGeometry args={[0.5, 0.36, 0.08]} />
          <meshStandardMaterial color={tone || "#1f2937"} />
        </mesh>
        <mesh position={[-0.2, 0.04, -0.2]} castShadow>
          <boxGeometry args={[0.06, 0.24, 0.06]} />
          <meshStandardMaterial color={tone || "#0f172a"} />
        </mesh>
        <mesh position={[0.2, 0.04, -0.2]} castShadow>
          <boxGeometry args={[0.06, 0.24, 0.06]} />
          <meshStandardMaterial color={tone || "#0f172a"} />
        </mesh>
        <mesh position={[-0.2, 0.04, 0.2]} castShadow>
          <boxGeometry args={[0.06, 0.24, 0.06]} />
          <meshStandardMaterial color={tone || "#0f172a"} />
        </mesh>
        <mesh position={[0.2, 0.04, 0.2]} castShadow>
          <boxGeometry args={[0.06, 0.24, 0.06]} />
          <meshStandardMaterial color={tone || "#0f172a"} />
        </mesh>
      </group>
    );
  }
  if (kind === "bench") {
    return (
      <group>
        <mesh position={[0, 0.17, 0]} castShadow>
          <boxGeometry args={[1.2, 0.03, 0.20]} />
          <meshStandardMaterial color={tone || "#6b4f2b"} />
        </mesh>
        <mesh position={[-0.45, 0.08, 0]} castShadow>
          <boxGeometry args={[0.05, 0.16, 0.22]} />
          <meshStandardMaterial color={tone || "#3b2f1e"} />
        </mesh>
        <mesh position={[0.45, 0.08, 0]} castShadow>
          <boxGeometry args={[0.05, 0.16, 0.22]} />
          <meshStandardMaterial color={tone || "#3b2f1e"} />
        </mesh>
      </group>
    );
  }
  if (kind === "cabinet") {
    return (
      <group>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.9, 1.0, 0.4]} />
          <meshStandardMaterial color={tone || "#9f6b3d"} />
        </mesh>
        <mesh position={[0, 0.5, 0.21]} castShadow>
          <boxGeometry args={[0.85, 0.95, 0.02]} />
          <meshStandardMaterial color={tone || "#7c4f2a"} />
        </mesh>
        <mesh position={[0.25, 0.55, 0.23]} castShadow>
          <boxGeometry args={[0.05, 0.05, 0.03]} />
          <meshStandardMaterial color={tone || "#d1a05a"} />
        </mesh>
      </group>
    );
  }
  if (kind === "blackCube") {
    return (
      <group>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={tone || "#0b0b0b"} />
        </mesh>
      </group>
    );
  }
  if (kind === "strawGrid") {
    return <StrawGridModel />;
  }
  if (kind === "actor") {
    return (
      <group>
        <mesh position={[0, 1.6, 0]} castShadow>
          <sphereGeometry args={[0.22, 20, 20]} />
          <meshStandardMaterial color={tone || "#cbd5f5"} />
        </mesh>
        <mesh position={[0, 1.05, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.28, 0.9, 18]} />
          <meshStandardMaterial color={tone || "#94a3b8"} />
        </mesh>
        <mesh position={[-0.38, 1.08, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.6, 12]} />
          <meshStandardMaterial color={tone || "#64748b"} />
        </mesh>
        <mesh position={[0.38, 1.08, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.6, 12]} />
          <meshStandardMaterial color={tone || "#64748b"} />
        </mesh>
        <mesh position={[-0.16, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.9, 12]} />
          <meshStandardMaterial color={tone || "#475569"} />
        </mesh>
        <mesh position={[0.16, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.9, 12]} />
          <meshStandardMaterial color={tone || "#475569"} />
        </mesh>
      </group>
    );
  }
  if (kind === "dancer") {
    return <DancerModel tone={tone} />;
  }
  if (kind === "fence") {
    return (
      <group>
        <mesh position={[0, 0.6, 0]} castShadow>
          <boxGeometry args={[2.2, 0.18, 0.12]} />
          <meshStandardMaterial color={tone || "#a16207"} />
        </mesh>
        <mesh position={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[2.2, 0.18, 0.12]} />
          <meshStandardMaterial color={tone || "#8b5e34"} />
        </mesh>
        <mesh position={[-0.9, 0.65, 0]} castShadow>
          <boxGeometry args={[0.14, 1.3, 0.14]} />
          <meshStandardMaterial color={tone || "#7c4f2a"} />
        </mesh>
        <mesh position={[0.9, 0.65, 0]} castShadow>
          <boxGeometry args={[0.14, 1.3, 0.14]} />
          <meshStandardMaterial color={tone || "#7c4f2a"} />
        </mesh>
      </group>
    );
  }
  return null;
};

const BuiltinModelInstance = ({
  model,
  isActive,
  onActiveObjectChange,
  onObjectReady,
  onSelect,
  onActivate,
  isSelected,
  isHovered,
  onHoverChange,
}: {
  model: TheaterModel;
  isActive?: boolean;
  onActiveObjectChange?: (node: THREE.Group | null, id: number) => void;
  onObjectReady?: (node: THREE.Group | null, id: number) => void;
  onSelect?: () => void;
  onActivate?: () => void;
  isSelected?: boolean;
  isHovered?: boolean;
  onHoverChange?: (next: boolean) => void;
}) => {
  const groupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (!isActive || !onActiveObjectChange) return;
    onActiveObjectChange(groupRef.current, model.id);
    return () => onActiveObjectChange(null, model.id);
  }, [isActive, model.id, onActiveObjectChange]);

  useEffect(() => {
    if (!onObjectReady) return;
    onObjectReady(groupRef.current, model.id);
    return () => onObjectReady(null, model.id);
  }, [model.id, onObjectReady]);

  return (
    <group
      ref={groupRef}
      position={model.position}
      rotation={model.rotation}
      scale={model.scale}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onActivate?.();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHoverChange?.(true);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        onHoverChange?.(false);
      }}
    >
      <BuiltinModel kind={model.builtin} isSelected={isSelected} isHovered={isHovered} />
    </group>
  );
};

const FileModelInstance = ({
  model,
  url,
  isActive,
  onActiveObjectChange,
  onObjectReady,
  onSelect,
  onActivate,
  isSelected,
  isHovered,
  onHoverChange,
}: {
  model: TheaterModel;
  url: string;
  isActive?: boolean;
  onActiveObjectChange?: (node: THREE.Group | null, id: number) => void;
  onObjectReady?: (node: THREE.Group | null, id: number) => void;
  onSelect?: () => void;
  onActivate?: () => void;
  isSelected?: boolean;
  isHovered?: boolean;
  onHoverChange?: (next: boolean) => void;
}) => {
  const groupRef = useRef<THREE.Group | null>(null);
  const gltf = useGLTF(url);
  const scene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
  const { actions, names } = useAnimations(gltf.animations, scene);

  useEffect(() => {
    if (!isActive || !onActiveObjectChange) return;
    onActiveObjectChange(groupRef.current, model.id);
    return () => onActiveObjectChange(null, model.id);
  }, [isActive, model.id, onActiveObjectChange]);

  useEffect(() => {
    if (!onObjectReady) return;
    onObjectReady(groupRef.current, model.id);
    return () => onObjectReady(null, model.id);
  }, [model.id, onObjectReady]);

  useEffect(() => {
    if (!names.length) return;
    names.forEach((name) => actions[name]?.reset().play());
    return () => {
      names.forEach((name) => actions[name]?.stop());
    };
  }, [actions, names]);

  useEffect(() => {
    const root = groupRef.current;
    if (!root) return;
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      materials.forEach((material) => {
        const standard = material as THREE.MeshStandardMaterial;
        if (!standard?.color) return;
        const data = standard.userData || (standard.userData = {});
        if (!data.textureStripped) {
          const textureKeys: (keyof THREE.MeshStandardMaterial)[] = [
            "map",
            "normalMap",
            "roughnessMap",
            "metalnessMap",
            "aoMap",
            "emissiveMap",
            "bumpMap",
            "displacementMap",
            "alphaMap",
            "lightMap",
            "envMap",
          ];
          const textureCount = textureKeys.reduce((acc, key) => {
            return (standard as any)[key] ? acc + 1 : acc;
          }, 0);
          if (textureCount > 6) {
            standard.normalMap = null;
            standard.roughnessMap = null;
            standard.metalnessMap = null;
            standard.aoMap = null;
            standard.bumpMap = null;
            standard.displacementMap = null;
            standard.alphaMap = null;
            standard.lightMap = null;
            standard.envMap = null;
            standard.needsUpdate = true;
          }
          data.textureStripped = true;
        }
        if (!data.originalColor) {
          data.originalColor = standard.color.clone();
        }
        if (standard.emissive && !data.originalEmissive) {
          data.originalEmissive = standard.emissive.clone();
        }
        if (isSelected) {
          standard.color.set("#ef4444");
          if (standard.emissive) {
            standard.emissive.set("#7f1d1d");
            standard.emissiveIntensity = 0.4;
          }
        } else if (isHovered) {
          standard.color.set("#3b82f6");
          if (standard.emissive) {
            standard.emissive.set("#1d4ed8");
            standard.emissiveIntensity = 0.35;
          }
        } else {
          standard.color.copy(data.originalColor);
          if (standard.emissive && data.originalEmissive) {
            standard.emissive.copy(data.originalEmissive);
            standard.emissiveIntensity = 1;
          }
        }
      });
    });
  }, [isHovered, isSelected]);

  return (
    <group
      ref={groupRef}
      position={model.position}
      rotation={model.rotation}
      scale={model.scale}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onActivate?.();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHoverChange?.(true);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        onHoverChange?.(false);
      }}
    >
      <primitive object={scene} />
    </group>
  );
};

const SpotlightItem = ({
  config,
  isActive,
  dragMode,
  snapEnabled,
  snapStep,
  showHelpers,
  onTargetChange,
  onPositionChange,
  onDraggingChange,
}: {
  config: TheaterSpotlight;
  isActive: boolean;
  dragMode: "target" | "source";
  snapEnabled: boolean;
  snapStep: number;
  showHelpers: boolean;
  onTargetChange: (id: number, next: [number, number, number]) => void;
  onPositionChange: (id: number, next: [number, number, number]) => void;
  onDraggingChange: (value: boolean) => void;
}) => {
  const spotRef = useRef<THREE.SpotLight | null>(null);
  const targetRef = useRef<THREE.Mesh | null>(null);
  const sourceRef = useRef<THREE.Mesh | null>(null);
  const fixtureRef = useRef<THREE.Group | null>(null);
  const labelRef = useRef<THREE.Mesh | null>(null);
  const labelWorld = useRef(new THREE.Vector3());
  const { camera } = useThree();
  const angle = THREE.MathUtils.degToRad(config.angleDeg);
  const isEnabled = config.enabled ?? true;
  const channelLabel = config.channel ?? config.id;
  const isRgb = config.isRgb ?? false;

  useEffect(() => {
    if (spotRef.current && targetRef.current) {
      spotRef.current.target = targetRef.current;
    }
  }, []);

  useEffect(() => {
    if (!fixtureRef.current) return;
    const start = new THREE.Vector3(...config.position);
    const end = new THREE.Vector3(...config.target);
    fixtureRef.current.position.copy(start);
    fixtureRef.current.lookAt(end);
  }, [config.position, config.target]);

  useFrame(() => {
    if (!labelRef.current) return;
    labelRef.current.getWorldPosition(labelWorld.current);
    const distance = labelWorld.current.distanceTo(camera.position);
    const scale = THREE.MathUtils.clamp(distance / 12, 0.85, 1.6);
    labelRef.current.scale.setScalar(scale);
  });

  return (
    <>
      {isEnabled && (
        <spotLight
          ref={spotRef}
          position={config.position}
          angle={angle}
          penumbra={0.4}
          intensity={config.intensity}
          distance={30}
          decay={2}
          castShadow={!isRgb}
          color={config.color || "#fbbf24"}
        />
      )}
      {isEnabled && (
        <SpotlightCone
          position={config.position}
          target={config.target}
          angleDeg={config.angleDeg}
          intensity={config.intensity}
          color={config.color}
        />
      )}
      {showHelpers &&
        isActive &&
        ((dragMode === "target" && targetRef.current) ||
          (dragMode === "source" && sourceRef.current)) && (
          <TransformControls
            mode="translate"
            onMouseDown={() => onDraggingChange(true)}
            onMouseUp={() => onDraggingChange(false)}
            onObjectChange={() => {
              const applySnap = (x: number, y: number, z: number) => {
                if (!snapEnabled || snapStep <= 0) return [x, y, z] as const;
                const snap = (value: number) => Math.round(value / snapStep) * snapStep;
                return [snap(x), y, snap(z)] as const;
              };
              if (dragMode === "target" && targetRef.current) {
                const { x, y, z } = targetRef.current.position;
                const [sx, sy, sz] = applySnap(x, y, z);
                targetRef.current.position.set(sx, sy, sz);
                onTargetChange(config.id, [sx, sy, sz]);
              }
              if (dragMode === "source" && sourceRef.current) {
                const { x, y, z } = sourceRef.current.position;
                const [sx, sy, sz] = applySnap(x, y, z);
                sourceRef.current.position.set(sx, sy, sz);
                onPositionChange(config.id, [sx, sy, sz]);
              }
            }}
            showX
            showY
            showZ
            object={dragMode === "target" ? targetRef.current! : sourceRef.current!}
          />
        )}
      <mesh ref={sourceRef} position={config.position} castShadow visible={showHelpers}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color={config.color || "#fbbf24"} />
      </mesh>
      <group ref={fixtureRef} visible={showHelpers}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.24, isRgb ? 0.24 : 0.6, 20]} />
          <meshStandardMaterial color={isEnabled ? "#1f2937" : "#334155"} />
        </mesh>
        <mesh
          position={[0, 0, isRgb ? -0.2 : -0.45]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <coneGeometry args={[0.32, isRgb ? 0.18 : 0.35, 20]} />
          <meshStandardMaterial color={isEnabled ? "#0f172a" : "#475569"} />
        </mesh>
        <mesh position={[0, -0.2, 0]} castShadow>
          <boxGeometry args={[0.35, 0.08, 0.2]} />
          <meshStandardMaterial color={isEnabled ? "#475569" : "#64748b"} />
        </mesh>
        {isRgb && null}
      </group>
      <Billboard
        position={[config.position[0], config.position[1] + 0.55, config.position[2]]}
        visible={showHelpers}
      >
        <Text
          ref={labelRef}
          fontSize={0.38}
          color={isEnabled ? "#e2e8f0" : "#64748b"}
          outlineWidth={0.02}
          outlineColor="#0f172a"
          anchorX="center"
          anchorY="bottom"
        >
          {String(channelLabel)}
        </Text>
      </Billboard>
      <mesh
        ref={targetRef}
        position={config.target}
        castShadow
        visible={showHelpers && isActive}
      >
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial color="#38bdf8" />
      </mesh>
    </>
  );
};

interface TheaterSceneProps {
  projectName?: string;
  steps?: ScriptStep[];
  currentPage?: number;
  onStepsChange?: Dispatch<SetStateAction<ScriptStep[]>>;
  theaterLayout?: TheaterLayout;
  onTheaterLayoutChange?: Dispatch<SetStateAction<TheaterLayout>>;
  isPanelsSwapped?: boolean;
  onTogglePanels?: () => void;
  controlsHost?: HTMLElement | null;
  controlsInPanel?: boolean;
}

export const TheaterScene = ({
  projectName = "fools",
  steps = [],
  currentPage = 0,
  onStepsChange,
  theaterLayout,
  onTheaterLayoutChange,
  isPanelsSwapped,
  onTogglePanels,
  controlsHost,
  controlsInPanel,
}: TheaterSceneProps) => {
  const DEFAULT_LAYOUT: TheaterLayout = {
    hallWidth: 9,
    hallDepth: 6,
    wallHeight: 6,
    audienceStartZ: 3,
    seatRows: 4,
    seatsPerRow: 7,
    seatSpacing: 1.1,
    rowSpacing: 0.8,
    rowRise: 0.25,
    aisleWidth: 1.2,
    aisleCenterX: 0,
    doorWidth: 1.2,
    doorHeight: 2.2,
    doorZ: -6,
  };
  const layout = theaterLayout ?? DEFAULT_LAYOUT;
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<"target" | "source">("target");
  const [editMode, setEditMode] = useState<"spotlights" | "models">("spotlights");
  const [modelTransformMode, setModelTransformMode] = useState<
    "translate" | "rotate" | "scale"
  >("translate");
  const [showControls, setShowControls] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridStep, setGridStep] = useState(0.5);
  const [rgbBatchColor, setRgbBatchColor] = useState("#ffffff");
  const [showSpotlights, setShowSpotlights] = useState(true);
  const [showOnlyActiveSpotlight, setShowOnlyActiveSpotlight] = useState(false);
  const [builtinModelKey, setBuiltinModelKey] = useState<TheaterModel["builtin"]>(
    "roundTable"
  );
  const [hoveredModelId, setHoveredModelId] = useState<number | null>(null);
  const [pendingSnapModelId, setPendingSnapModelId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"spotlights" | "models" | "layout">(
    "spotlights"
  );
  const currentStep = steps[currentPage];
  const spotlights = currentStep?.theaterSpotlights ?? [];
  const effectiveSpotlights = spotlights.length > 0 ? spotlights : DEFAULT_SPOTLIGHTS;
  const activeSpotlightId =
    currentStep?.theaterActiveSpotlightId ?? effectiveSpotlights[0]?.id;
  const activeSpotlight =
    effectiveSpotlights.find((item) => item.id === activeSpotlightId) ??
    effectiveSpotlights[0];
  const models = currentStep?.theaterModels ?? [];
  const activeModelId = currentStep?.theaterActiveModelId;
  const activeModel = activeModelId
    ? models.find((item) => item.id === activeModelId)
    : undefined;
  const [activeModelObject, setActiveModelObject] = useState<THREE.Group | null>(
    null
  );
  const [activeModelObjectId, setActiveModelObjectId] = useState<number | null>(null);
  const modelObjectMapRef = useRef<Map<number, THREE.Group>>(new Map());
  const handleActiveObjectChange = useCallback(
    (node: THREE.Group | null, id: number) => {
      setActiveModelObject(node);
      setActiveModelObjectId(node ? id : null);
    },
    []
  );
  const handleObjectReady = useCallback((node: THREE.Group | null, id: number) => {
    if (node) {
      modelObjectMapRef.current.set(id, node);
    } else {
      modelObjectMapRef.current.delete(id);
    }
  }, []);

  useEffect(() => {
    if (!activeModelId || editMode !== "models") {
      setIsDragging(false);
    }
  }, [activeModelId, editMode]);

  useEffect(() => {
    const resetDragging = () => setIsDragging(false);
    window.addEventListener("pointerup", resetDragging);
    window.addEventListener("blur", resetDragging);
    return () => {
      window.removeEventListener("pointerup", resetDragging);
      window.removeEventListener("blur", resetDragging);
    };
  }, []);

  const normalizeSpotlights = useCallback(
    (items: TheaterSpotlight[]) =>
      items.map((item, index) => {
        const nextId = Number(item.id) || index + 1;
        return {
          id: nextId,
          label: item.label?.trim() || `Софит ${nextId}`,
          position: item.position ?? [0, 6, 6],
          target: item.target ?? [0, 1, 2],
          angleDeg: Number.isFinite(item.angleDeg) ? item.angleDeg : 20,
          intensity: Number.isFinite(item.intensity) ? item.intensity : 1.2,
          color: item.color,
          enabled: item.enabled ?? true,
          channel: Number.isFinite(item.channel) ? item.channel : nextId,
          isRgb: item.isRgb ?? false,
        };
      }),
    []
  );

  const updateCurrentStep = useCallback(
    (patch: Partial<ScriptStep>) => {
      if (!currentStep || !onStepsChange) return;
      onStepsChange((prev) =>
        prev.map((step, index) =>
          index === currentPage ? { ...step, ...patch } : step
        )
      );
    },
    [currentPage, currentStep, onStepsChange]
  );

  const updateSpotlights = useCallback(
    (next: TheaterSpotlight[]) => {
      updateCurrentStep({ theaterSpotlights: normalizeSpotlights(next) });
    },
    [normalizeSpotlights, updateCurrentStep]
  );

  const cloneSpotlights = useCallback(
    (items: TheaterSpotlight[]) =>
      items.map((item) => ({
        ...item,
        position: [...item.position] as [number, number, number],
        target: [...item.target] as [number, number, number],
      })),
    []
  );

  const ensureSpotlights = useCallback(() => {
    if (spotlights.length > 0) return spotlights;
    const cloned = cloneSpotlights(DEFAULT_SPOTLIGHTS);
    updateSpotlights(cloned);
    return cloned;
  }, [cloneSpotlights, spotlights, updateSpotlights]);

  const normalizeModels = useCallback(
    (items: TheaterModel[]) =>
      items.map((item, index) => {
        const nextId = Number(item.id) || index + 1;
        return {
          id: nextId,
          name: item.name?.trim() || `Модель ${nextId}`,
          file: item.file,
          type: item.type ?? (item.file ? "file" : "builtin"),
          builtin: item.builtin,
          allowOutOfBounds: item.allowOutOfBounds ?? false,
          position: item.position ?? [0, 0, 0],
          rotation: item.rotation ?? [0, 0, 0],
          scale: item.scale ?? [1, 1, 1],
        };
      }),
    []
  );

  const updateModels = useCallback(
    (next: TheaterModel[]) => {
      updateCurrentStep({ theaterModels: normalizeModels(next) });
    },
    [normalizeModels, updateCurrentStep]
  );

  const updateModel = useCallback(
    (id: number, patch: Partial<TheaterModel>) => {
      updateModels(
        models.map((item) => (item.id === id ? { ...item, ...patch } : item))
      );
    },
    [models, updateModels]
  );

  const resolveModelSrc = useCallback(
    (file: string) => {
      const url = new URL(`project-models://${encodeURIComponent(projectName)}/`);
      url.pathname = `/${file}`;
      return url.toString();
    },
    [projectName]
  );

  const copyFromPreviousStep = () => {
    if (!currentStep || currentPage <= 0) return;
    const previous = steps[currentPage - 1];
    const source = previous?.theaterSpotlights ?? [];
    const cloned = source.map((item) => ({ ...item }));
    updateSpotlights(cloned);
    if (cloned.length > 0) {
      updateCurrentStep({ theaterActiveSpotlightId: cloned[0].id });
    }
  };

  const copyModelsFromPreviousStep = () => {
    if (!currentStep || currentPage <= 0) return;
    const previous = steps[currentPage - 1];
    const source = previous?.theaterModels ?? [];
    const cloned = source.map((item) => ({
      ...item,
      position: [...item.position] as [number, number, number],
      rotation: [...item.rotation] as [number, number, number],
      scale: [...item.scale] as [number, number, number],
    }));
    updateModels(cloned);
    if (cloned.length > 0) {
      updateCurrentStep({ theaterActiveModelId: cloned[0].id });
    }
  };

  const updateSpotlight = useCallback(
    (id: number, patch: Partial<TheaterSpotlight>) => {
      const base = ensureSpotlights();
      updateSpotlights(
        base.map((item) => (item.id === id ? { ...item, ...patch } : item))
      );
    },
    [ensureSpotlights, updateSpotlights]
  );

  const addSpotlight = () => {
    const base = ensureSpotlights();
    const nextId = base.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
    const nextItem: TheaterSpotlight = {
      id: nextId,
      label: `Софит ${nextId}`,
      position: [0, 6, 6],
      target: [0, 1, 2],
      angleDeg: 20,
      intensity: 1.2,
      color: "#fbbf24",
      enabled: true,
      channel: nextId,
      isRgb: false,
    };
    updateSpotlights([...base, nextItem]);
    updateCurrentStep({ theaterActiveSpotlightId: nextId });
  };

  const addRgbSpotlight = () => {
    const base = ensureSpotlights();
    const nextId = base.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
    const rgbIndex =
      base.filter((item) => item.isRgb).reduce((acc, item) => Math.max(acc, item.id), 0) +
      1;
    const nextItem: TheaterSpotlight = {
      id: nextId,
      label: `RGB ${rgbIndex}`,
      position: [0, 6, 6],
      target: [0, 1, 2],
      angleDeg: 20,
      intensity: 1.2,
      color: "#ffffff",
      enabled: true,
      channel: nextId,
      isRgb: true,
    };
    updateSpotlights([...base, nextItem]);
    updateCurrentStep({ theaterActiveSpotlightId: nextId });
  };

  const applyRgbColorToAll = useCallback(
    (nextColor: string) => {
      const base = ensureSpotlights();
      updateSpotlights(
        base.map((item) => (item.isRgb ? { ...item, color: nextColor } : item))
      );
    },
    [ensureSpotlights, updateSpotlights]
  );

  const enableSpotlightsByType = useCallback(
    (isRgb: boolean) => {
      const base = ensureSpotlights();
      updateSpotlights(
        base.map((item) =>
          item.isRgb === isRgb ? { ...item, enabled: true } : item
        )
      );
    },
    [ensureSpotlights, updateSpotlights]
  );

  const disableSpotlightsByType = useCallback(
    (isRgb: boolean) => {
      const base = ensureSpotlights();
      updateSpotlights(
        base.map((item) =>
          item.isRgb === isRgb ? { ...item, enabled: false } : item
        )
      );
    },
    [ensureSpotlights, updateSpotlights]
  );

  const blackoutAllSpotlights = useCallback(() => {
    const base = ensureSpotlights();
    updateSpotlights(base.map((item) => ({ ...item, enabled: false })));
  }, [ensureSpotlights, updateSpotlights]);

  const addModel = async () => {
    if (!currentStep) return;
    try {
      if (!window.api?.pickProjectModel) {
        console.error(
          "pickProjectModel is not available. Restart the Electron process to reload preload."
        );
        return;
      }
      const result = await window.api.pickProjectModel(projectName);
      if (!result?.ok) {
        if (result?.canceled) return;
        console.error("Failed to pick model:", result?.error);
        return;
      }
      const nextId = models.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
      const nextItem: TheaterModel = {
        id: nextId,
        name: result.name || `Модель ${nextId}`,
        file: result.file,
        type: "file",
        allowOutOfBounds: false,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      };
      updateModels([...models, nextItem]);
      updateCurrentStep({ theaterActiveModelId: nextId });
      setPendingSnapModelId(nextId);
      setEditMode("models");
    } catch (err) {
      console.error("Failed to add model:", err);
    }
  };

  const addBuiltinModel = () => {
    const nextId = models.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
    const builtinNames: Record<string, string> = {
      roundTable: "Круглый стол",
      chair: "Стул",
      bench: "Скамейка",
      cabinet: "Тумба",
      blackCube: "Черный куб",
      strawGrid: "Сетка + солома",
      actor: "Актер",
      fence: "Забор",
      dancer: "Танцор",
    };
    const nextItem: TheaterModel = {
      id: nextId,
      name: builtinNames[builtinModelKey ?? "roundTable"] || `Модель ${nextId}`,
      type: "builtin",
      builtin: builtinModelKey,
      allowOutOfBounds: false,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
    updateModels([...models, nextItem]);
    updateCurrentStep({ theaterActiveModelId: nextId });
    setPendingSnapModelId(nextId);
    setEditMode("models");
  };

  const removeModel = (id: number) => {
    if (!currentStep) return;
    const next = models.filter((item) => item.id !== id);
    updateModels(next);
    if (activeModelId === id) {
      updateCurrentStep({ theaterActiveModelId: next[0]?.id });
    }
  };

  const cloneModel = (id: number) => {
    if (!currentStep) return;
    const source = models.find((item) => item.id === id);
    if (!source) return;
    const nextId = models.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
    const offsetX = 0.3;
    const offsetZ = 0.3;
    const nextItem: TheaterModel = {
      ...source,
      id: nextId,
      name: `${source.name} (копия)`,
      position: [source.position[0] + offsetX, source.position[1], source.position[2] + offsetZ],
    };
    updateModels([...models, nextItem]);
    updateCurrentStep({ theaterActiveModelId: nextId });
    setPendingSnapModelId(nextId);
    setEditMode("models");
  };

  const syncActiveModel = useCallback(() => {
    if (!activeModelObject || !activeModelId) return;
    if (activeModelObjectId !== activeModelId) return;
    const obj = activeModelObject;
    const prevModel = models.find((item) => item.id === activeModelId);
    const box = new THREE.Box3().setFromObject(obj);
    const lift = box.min.y < 0 ? -box.min.y : 0;
    let nextX = obj.position.x;
    let nextZ = obj.position.z;
    const allowOut = activeModel?.allowOutOfBounds ?? false;
    if (!allowOut) {
      const halfW = layout.hallWidth / 2;
      const halfD = layout.hallDepth / 2;
      if (box.min.x < -halfW) {
        nextX += -halfW - box.min.x;
      }
      if (box.max.x > halfW) {
        nextX -= box.max.x - halfW;
      }
      if (box.min.z < -halfD) {
        nextZ += -halfD - box.min.z;
      }
      if (box.max.z > halfD) {
        nextZ -= box.max.z - halfD;
      }
    }
    const clampedY = obj.position.y + lift;
    obj.position.set(nextX, clampedY, nextZ);

    if (prevModel) {
      if (prevModel.type === "builtin" && prevModel.builtin === "strawGrid") {
        updateModel(activeModelId, {
          position: [nextX, clampedY, nextZ],
          rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
          scale: [obj.scale.x, obj.scale.y, obj.scale.z],
        });
        return;
      }
      const activeBox = new THREE.Box3().setFromObject(obj);
      const collision = models.some((item) => {
        if (item.id === activeModelId) return false;
        if (item.type === "builtin" && item.builtin === "strawGrid") return false;
        const otherObject = modelObjectMapRef.current.get(item.id);
        if (otherObject) {
          const otherBox = new THREE.Box3().setFromObject(otherObject);
          return activeBox.intersectsBox(otherBox);
        }
        const pos = new THREE.Vector3(...item.position);
        const size = new THREE.Vector3(
          Math.max(0.2, Math.abs(item.scale[0]) * 0.8),
          Math.max(0.2, Math.abs(item.scale[1]) * 0.6),
          Math.max(0.2, Math.abs(item.scale[2]) * 0.8)
        );
        const otherBox = new THREE.Box3().setFromCenterAndSize(pos, size);
        return activeBox.intersectsBox(otherBox);
      });
      if (collision) {
        obj.position.set(prevModel.position[0], prevModel.position[1], prevModel.position[2]);
        updateModel(activeModelId, {
          position: [
            prevModel.position[0],
            prevModel.position[1],
            prevModel.position[2],
          ],
          rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
          scale: [obj.scale.x, obj.scale.y, obj.scale.z],
        });
        return;
      }
    }
    updateModel(activeModelId, {
      position: [nextX, clampedY, nextZ],
      rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      scale: [obj.scale.x, obj.scale.y, obj.scale.z],
    });
  }, [
    activeModel,
    activeModelId,
    activeModelObject,
    activeModelObjectId,
    layout.hallDepth,
    layout.hallWidth,
    models,
    updateModel,
  ]);

  useEffect(() => {
    if (!pendingSnapModelId) return;
    if (!activeModelObject || activeModelId !== pendingSnapModelId) return;
    if (activeModelObjectId !== pendingSnapModelId) return;
    const box = new THREE.Box3().setFromObject(activeModelObject);
    const lift = box.min.y < 0 ? -box.min.y : 0;
    if (lift !== 0) {
      activeModelObject.position.y += lift;
    }
    updateModel(pendingSnapModelId, {
      position: [
        activeModelObject.position.x,
        activeModelObject.position.y,
        activeModelObject.position.z,
      ],
    });
    setPendingSnapModelId(null);
  }, [
    activeModelId,
    activeModelObject,
    activeModelObjectId,
    pendingSnapModelId,
    updateModel,
  ]);

  const updateLayout = useCallback(
    (patch: Partial<TheaterLayout>) => {
      if (!onTheaterLayoutChange) return;
      onTheaterLayoutChange((prev) => ({ ...prev, ...patch }));
    },
    [onTheaterLayoutChange]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.key.toLowerCase() !== "e") return;
      event.preventDefault();
      setShowControls((prev) => !prev);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleDelete = (event: KeyboardEvent) => {
      if (editMode !== "models") return;
      if (!activeModelId) return;
      const key = event.key.toLowerCase();
      if (key !== "delete" && key !== "backspace") return;
      const target = event.target as HTMLElement | null;
      const isEditable =
        target?.closest("input, textarea, [contenteditable='true']") != null;
      if (isEditable) return;
      event.preventDefault();
      removeModel(activeModelId);
    };

    window.addEventListener("keydown", handleDelete);
    return () => window.removeEventListener("keydown", handleDelete);
  }, [activeModelId, editMode, removeModel]);

  useEffect(() => {
    const handleClear = (event: KeyboardEvent) => {
      if (editMode !== "models") return;
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      const isEditable =
        target?.closest("input, textarea, [contenteditable='true']") != null;
      if (isEditable) return;
      event.preventDefault();
      updateCurrentStep({ theaterActiveModelId: undefined });
    };

    window.addEventListener("keydown", handleClear);
    return () => window.removeEventListener("keydown", handleClear);
  }, [editMode, updateCurrentStep]);

  const controlsNode = showControls ? (
    <div
      className={`theater-controls${controlsInPanel ? " theater-controls-panel" : ""}`}
    >
      <div className="theater-tabs">
        <button
          type="button"
          className="theater-spotlight-btn"
          data-active={activeTab === "spotlights"}
          onClick={() => {
            setActiveTab("spotlights");
            setEditMode("spotlights");
          }}
        >
          Софиты
        </button>
        <button
          type="button"
          className="theater-spotlight-btn"
          data-active={activeTab === "models"}
          onClick={() => {
            setActiveTab("models");
            setEditMode("models");
          }}
        >
          Модели
        </button>
        <button
          type="button"
          className="theater-spotlight-btn"
          data-active={activeTab === "layout"}
          onClick={() => setActiveTab("layout")}
        >
          План
        </button>
      </div>
      {activeTab === "spotlights" && (
        <>
          <div className="theater-spotlight-list">
            <div className="theater-spotlight-section">Софиты</div>
            {(spotlights.length > 0 ? spotlights : effectiveSpotlights)
              .filter((item) => !item.isRgb)
              .map((item) => (
                <div key={item.id} className="theater-spotlight-tab">
                  <button
                    type="button"
                    className="theater-spotlight-btn"
                    data-active={item.id === activeSpotlightId}
                    onClick={() => {
                      setEditMode("spotlights");
                      ensureSpotlights();
                      updateCurrentStep({ theaterActiveSpotlightId: item.id });
                    }}
                    disabled={!currentStep}
                  >
                    {item.label}
                  </button>
                  <label className="theater-spotlight-channel">
                    Канал
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={item.channel ?? item.id}
                      onChange={(event) =>
                        updateSpotlight(item.id, {
                          channel: Math.max(1, Number(event.target.value) || 1),
                        })
                      }
                      disabled={!currentStep}
                    />
                  </label>
                  <button
                    type="button"
                    className="theater-spotlight-btn"
                    data-active={item.enabled !== false}
                    onClick={() =>
                      updateSpotlight(item.id, {
                        enabled: !(item.enabled ?? true),
                      })
                    }
                    disabled={!currentStep}
                    title={item.enabled === false ? "Включить" : "Выключить"}
                  >
                    {item.enabled === false ? "Выкл" : "Вкл"}
                  </button>
                </div>
              ))}
            {(spotlights.length > 0 ? spotlights : effectiveSpotlights).filter(
              (item) => !item.isRgb
            ).length === 0 && (
                <span className="theater-spotlight-empty">Софитов нет</span>
              )}
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={addSpotlight}
              disabled={!currentStep}
            >
              + Софит
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={() => enableSpotlightsByType(false)}
              disabled={!currentStep}
              title="Включить все обычные софиты"
            >
              Включить все
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={() => disableSpotlightsByType(false)}
              disabled={!currentStep}
              title="Выключить все обычные софиты"
            >
              Выключить все
            </button>
            <div className="theater-spotlight-section">RGB</div>
            {(spotlights.length > 0 ? spotlights : effectiveSpotlights)
              .filter((item) => item.isRgb)
              .map((item) => (
                <div key={item.id} className="theater-spotlight-tab">
                  <button
                    type="button"
                    className="theater-spotlight-btn"
                    data-active={item.id === activeSpotlightId}
                    onClick={() => {
                      setEditMode("spotlights");
                      ensureSpotlights();
                      updateCurrentStep({ theaterActiveSpotlightId: item.id });
                    }}
                    disabled={!currentStep}
                  >
                    {item.label}
                  </button>
                  <label className="theater-spotlight-channel">
                    Канал
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={item.channel ?? item.id}
                      onChange={(event) =>
                        updateSpotlight(item.id, {
                          channel: Math.max(1, Number(event.target.value) || 1),
                        })
                      }
                      disabled={!currentStep}
                    />
                  </label>
                  <button
                    type="button"
                    className="theater-spotlight-btn"
                    data-active={item.enabled !== false}
                    onClick={() =>
                      updateSpotlight(item.id, {
                        enabled: !(item.enabled ?? true),
                      })
                    }
                    disabled={!currentStep}
                    title={item.enabled === false ? "Включить" : "Выключить"}
                  >
                    {item.enabled === false ? "Выкл" : "Вкл"}
                  </button>
                </div>
              ))}
            {(spotlights.length > 0 ? spotlights : effectiveSpotlights).filter(
              (item) => item.isRgb
            ).length === 0 && (
                <span className="theater-spotlight-empty">RGB нет</span>
              )}
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={addRgbSpotlight}
              disabled={!currentStep}
            >
              + RGB
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={() => enableSpotlightsByType(true)}
              disabled={!currentStep}
              title="Включить все RGB"
            >
              Включить все RGB
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={() => disableSpotlightsByType(true)}
              disabled={!currentStep}
              title="Выключить все RGB"
            >
              Выключить все RGB
            </button>
            <div className="theater-spotlight-section">Шаблоны RGB</div>
            <div className="theater-spotlight-grid">
              <button
                type="button"
                className="theater-spotlight-btn"
                onClick={() => applyRgbColorToAll("#22c55e")}
                disabled={!currentStep}
                title="Зеленый"
              >
                Зеленый
              </button>
              <button
                type="button"
                className="theater-spotlight-btn"
                onClick={() => applyRgbColorToAll("#3b82f6")}
                disabled={!currentStep}
                title="Синий"
              >
                Синий
              </button>
              <button
                type="button"
                className="theater-spotlight-btn"
                onClick={() => applyRgbColorToAll("#ec4899")}
                disabled={!currentStep}
                title="Розовый"
              >
                Розовый
              </button>
              <button
                type="button"
                className="theater-spotlight-btn"
                onClick={() => applyRgbColorToAll("#facc15")}
                disabled={!currentStep}
                title="Желтый"
              >
                Желтый
              </button>
            </div>
            <label>
              Цвет всем RGB
              <input
                type="color"
                value={rgbBatchColor}
                onChange={(event) => setRgbBatchColor(event.target.value)}
                disabled={!currentStep}
              />
            </label>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={() => applyRgbColorToAll(rgbBatchColor)}
              disabled={!currentStep}
              title="Применить выбранный цвет ко всем RGB"
            >
              Применить к RGB
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={copyFromPreviousStep}
              disabled={!currentStep || currentPage === 0}
              title="Скопировать софиты из предыдущего шага"
            >
              Скопировать из прошлого шага
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={blackoutAllSpotlights}
              disabled={!currentStep}
              title="Выключить все софиты"
            >
              Блекаут
            </button>
          </div>
        </>
      )}
      <div className="theater-spotlight-active">
        <div className="theater-spotlight-section">
          Активный софит: {activeSpotlight?.label ?? "—"}
        </div>
        <div className="theater-spotlight-grid">
          <label>
            Показывать софиты
            <input
              type="checkbox"
              checked={showSpotlights}
              onChange={(event) => setShowSpotlights(event.target.checked)}
            />
          </label>
          <label>
            Только активный
            <input
              type="checkbox"
              checked={showOnlyActiveSpotlight}
              onChange={(event) => setShowOnlyActiveSpotlight(event.target.checked)}
              disabled={!activeSpotlight}
            />
          </label>
          <label>
            Сетка
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(event) => setShowGrid(event.target.checked)}
            />
          </label>
          <label>
            Привязка X/Z
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={(event) => setSnapToGrid(event.target.checked)}
            />
          </label>
          <label>
            Шаг
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={gridStep}
              onChange={(event) =>
                setGridStep(Math.max(0.1, Number(event.target.value) || 0.1))
              }
            />
          </label>
        </div>
        <div className="theater-spotlight-drag">
          <button
            type="button"
            className="theater-spotlight-btn"
            data-active={dragMode === "target"}
            onClick={() => {
              setEditMode("spotlights");
              setDragMode("target");
            }}
            disabled={!activeSpotlight}
          >
            Цель
          </button>
          <button
            type="button"
            className="theater-spotlight-btn"
            data-active={dragMode === "source"}
            onClick={() => {
              setEditMode("spotlights");
              setDragMode("source");
            }}
            disabled={!activeSpotlight}
          >
            Источник
          </button>
        </div>
        <label>
          Угол
          <input
            type="range"
            min={5}
            max={60}
            step={1}
            value={activeSpotlight?.angleDeg ?? 20}
            onChange={(event) =>
              updateSpotlight(activeSpotlight?.id ?? 0, {
                angleDeg: Number(event.target.value),
              })
            }
            disabled={!activeSpotlight}
          />
          <span>{activeSpotlight?.angleDeg ?? 20}°</span>
        </label>
        <label>
          Интенсивность
          <input
            type="range"
            min={0}
            max={3}
            step={0.1}
            value={activeSpotlight?.intensity ?? 1.2}
            onChange={(event) =>
              updateSpotlight(activeSpotlight?.id ?? 0, {
                intensity: Number(event.target.value),
              })
            }
            disabled={!activeSpotlight}
          />
          <span>{(activeSpotlight?.intensity ?? 1.2).toFixed(1)}</span>
        </label>
        <label>
          Цвет
          <input
            type="color"
            value={activeSpotlight?.color ?? "#fbbf24"}
            onChange={(event) =>
              updateSpotlight(activeSpotlight?.id ?? 0, {
                color: event.target.value,
              })
            }
            disabled={!activeSpotlight}
          />
        </label>
      </div>
      {activeTab === "models" && (
        <>
          <div className="theater-model-list">
            {models.length === 0 ? (
              <span className="theater-spotlight-empty">Моделей нет</span>
            ) : (
              <label>
                Выбор модели
                <select
                  value={activeModelId ?? ""}
                  onChange={(event) => {
                    const nextId = Number(event.target.value);
                    if (!Number.isFinite(nextId)) return;
                    setEditMode("models");
                    updateCurrentStep({ theaterActiveModelId: nextId });
                  }}
                  disabled={!currentStep}
                >
                  {models.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Шаблон
              <select
                value={builtinModelKey ?? ""}
                onChange={(event) => {
                  const nextKey = event.target.value as TheaterModel["builtin"];
                  setBuiltinModelKey(nextKey);
                }}
              >
                <option value="roundTable">Круглый стол</option>
                <option value="chair">Стул</option>
                <option value="bench">Скамейка</option>
                <option value="cabinet">Тумба</option>
                <option value="blackCube">Черный куб</option>
                <option value="strawGrid">Сетка + солома</option>
                <option value="actor">Актер</option>
                <option value="fence">Забор</option>
                <option value="dancer">Танцор</option>
              </select>
            </label>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={addBuiltinModel}
              disabled={!currentStep}
            >
              + Шаблон
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={addModel}
              disabled={!currentStep}
            >
              + Файл модели
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={() => removeModel(activeModelId ?? 0)}
              disabled={!activeModel || editMode !== "models"}
            >
              Удалить модель
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={() => cloneModel(activeModelId ?? 0)}
              disabled={!activeModel || editMode !== "models"}
            >
              Клонировать модель
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={() => updateCurrentStep({ theaterActiveModelId: undefined })}
              disabled={!activeModelId}
              title="Снять выделение"
            >
              Снять выделение
            </button>
            <label>
              Вне стен
              <input
                type="checkbox"
                checked={activeModel?.allowOutOfBounds ?? false}
                onChange={(event) =>
                  activeModelId &&
                  updateModel(activeModelId, {
                    allowOutOfBounds: event.target.checked,
                  })
                }
                disabled={!activeModelId}
              />
            </label>
            <button
              type="button"
              className="theater-spotlight-btn"
              onClick={copyModelsFromPreviousStep}
              disabled={!currentStep || currentPage === 0}
              title="Скопировать модели из предыдущего шага"
            >
              Скопировать модели
            </button>
          </div>
          <div className="theater-model-actions">
            <button
              type="button"
              className="theater-spotlight-btn"
              data-active={modelTransformMode === "translate"}
              onClick={() => {
                setEditMode("models");
                setModelTransformMode("translate");
              }}
              disabled={!activeModel || editMode !== "models"}
            >
              Перемещение
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              data-active={modelTransformMode === "rotate"}
              onClick={() => {
                setEditMode("models");
                setModelTransformMode("rotate");
              }}
              disabled={!activeModel || editMode !== "models"}
            >
              Вращение
            </button>
            <button
              type="button"
              className="theater-spotlight-btn"
              data-active={modelTransformMode === "scale"}
              onClick={() => {
                setEditMode("models");
                setModelTransformMode("scale");
              }}
              disabled={!activeModel || editMode !== "models"}
            >
              Масштаб
            </button>
          </div>
        </>
      )}
      {activeTab === "layout" && (
        <>
          <div className="theater-layout-title">План зала</div>
          <div className="theater-layout-grid">
            <label>
              Ширина
              <input
                type="number"
                min={6}
                step={0.5}
                value={layout.hallWidth}
                onChange={(event) =>
                  updateLayout({ hallWidth: Number(event.target.value) || 0 })
                }
              />
            </label>
            <label>
              Глубина
              <input
                type="number"
                min={6}
                step={0.5}
                value={layout.hallDepth}
                onChange={(event) =>
                  updateLayout({ hallDepth: Number(event.target.value) || 0 })
                }
              />
            </label>
            <label>
              Проход W
              <input
                type="number"
                min={0}
                step={0.1}
                value={layout.aisleWidth}
                onChange={(event) =>
                  updateLayout({ aisleWidth: Number(event.target.value) || 0 })
                }
              />
            </label>
            <label>
              Проход X
              <input
                type="number"
                step={0.1}
                value={layout.aisleCenterX}
                onChange={(event) =>
                  updateLayout({ aisleCenterX: Number(event.target.value) || 0 })
                }
              />
            </label>
            <label>
              Рядов
              <input
                type="number"
                min={0}
                step={1}
                value={layout.seatRows}
                onChange={(event) =>
                  updateLayout({
                    seatRows: Math.max(0, Number(event.target.value) || 0),
                  })
                }
              />
            </label>
            <label>
              Мест/ряд
              <input
                type="number"
                min={1}
                step={1}
                value={layout.seatsPerRow}
                onChange={(event) =>
                  updateLayout({
                    seatsPerRow: Math.max(1, Number(event.target.value) || 1),
                  })
                }
              />
            </label>
            <label>
              Подъем
              <input
                type="number"
                min={0}
                step={0.05}
                value={layout.rowRise}
                onChange={(event) =>
                  updateLayout({ rowRise: Number(event.target.value) || 0 })
                }
              />
            </label>
            <label>
              Дверь Z
              <input
                type="number"
                step={0.5}
                value={layout.doorZ}
                onChange={(event) =>
                  updateLayout({ doorZ: Number(event.target.value) || 0 })
                }
              />
            </label>
          </div>
        </>
      )}
    </div>
  ) : null;

  const controlsRender =
    controlsInPanel && controlsHost && controlsNode
      ? createPortal(controlsNode, controlsHost)
      : null;

  return (
    <div className="theater-scene">
      {onTogglePanels && (
        <div className="theater-panels-toggle">
          <button
            type="button"
            className="theater-spotlight-btn"
            data-active={isPanelsSwapped}
            onClick={onTogglePanels}
          >
            Поменять панели
          </button>
        </div>
      )}
      {controlsRender}
      <Canvas
        className="theater-canvas"
        shadows
        camera={{ position: [0, 6, 12], fov: 45 }}
        onWheel={(event) => event.preventDefault()}
        style={{ touchAction: "none" }}
        dpr={[1, 1.5]}
      >
        <TheaterStage layout={layout} />
        {showGrid && (
          <gridHelper
            args={[
              Math.max(layout.hallWidth, layout.hallDepth),
              Math.max(
                1,
                Math.round(Math.max(layout.hallWidth, layout.hallDepth) / gridStep)
              ),
              "#334155",
              "#1f2937",
            ]}
            position={[0, 0.01, 0]}
          />
        )}
        {(spotlights.length > 0 ? spotlights : effectiveSpotlights).map((item) => (
          <SpotlightItem
            key={item.id}
            config={item}
            isActive={item.id === activeSpotlightId && editMode === "spotlights"}
            dragMode={dragMode}
            snapEnabled={snapToGrid}
            snapStep={gridStep}
            showHelpers={
              showSpotlights &&
              (!showOnlyActiveSpotlight || item.id === activeSpotlightId)
            }
            onTargetChange={(id, next) => updateSpotlight(id, { target: next })}
            onPositionChange={(id, next) => updateSpotlight(id, { position: next })}
            onDraggingChange={setIsDragging}
          />
        ))}
        <Suspense fallback={null}>
          {models.map((model) => {
            const isActive = editMode === "models" && model.id === activeModelId;
            const onSelect = () => {
              setEditMode("models");
              updateCurrentStep({ theaterActiveModelId: model.id });
            };
            const onActivate = () => {
              setEditMode("models");
              updateCurrentStep({ theaterActiveModelId: model.id });
              setModelTransformMode("translate");
            };
            const onHoverChange = (next: boolean) => {
              setHoveredModelId(next ? model.id : null);
            };
            if (model.type === "builtin") {
              return (
                <BuiltinModelInstance
                  key={model.id}
                  model={model}
                  isActive={isActive}
                  onActiveObjectChange={handleActiveObjectChange}
                  onObjectReady={handleObjectReady}
                  onSelect={onSelect}
                  onActivate={onActivate}
                  isSelected={model.id === activeModelId}
                  isHovered={model.id === hoveredModelId}
                  onHoverChange={onHoverChange}
                />
              );
            }
            if (model.file) {
              return (
                <FileModelInstance
                  key={model.id}
                  model={model}
                  url={resolveModelSrc(model.file)}
                  isActive={isActive}
                  onActiveObjectChange={handleActiveObjectChange}
                  onObjectReady={handleObjectReady}
                  onSelect={onSelect}
                  onActivate={onActivate}
                  isSelected={model.id === activeModelId}
                  isHovered={model.id === hoveredModelId}
                  onHoverChange={onHoverChange}
                />
              );
            }
            return null;
          })}
        </Suspense>
        {editMode === "models" &&
          activeModelObject &&
          activeModelObjectId === activeModelId &&
          activeModelObject.parent && (
            <TransformControls
              mode={modelTransformMode}
              object={activeModelObject}
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={() => setIsDragging(false)}
              onObjectChange={syncActiveModel}
            />
          )}
        <OrbitControls makeDefault enableDamping enabled={!isDragging} />
      </Canvas>
    </div>
  );
};
