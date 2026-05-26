import { tc } from "../../../../shared/styles/theme-color";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

export const DancerModel = ({ tone }: { tone?: string | null }) => {
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

  const skin = tone || tc("--color-text-light");
  const cloth = tone || tc("--color-text-muted");
  const dark = tone || tc("--color-text-dimmer");

  return (
    <group ref={rootRef}>
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.9, 18]} />
        <meshStandardMaterial color={cloth} />
      </mesh>
      <group ref={leftArmRef} position={[-0.38, 1.3, 0]}>
        <mesh position={[0, -0.3, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.6, 12]} />
          <meshStandardMaterial color={dark} />
        </mesh>
      </group>
      <group ref={rightArmRef} position={[0.38, 1.3, 0]}>
        <mesh position={[0, -0.3, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.6, 12]} />
          <meshStandardMaterial color={dark} />
        </mesh>
      </group>
      <group ref={leftLegRef} position={[-0.16, 0.9, 0]}>
        <mesh position={[0, -0.45, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.9, 12]} />
          <meshStandardMaterial color={dark} />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.16, 0.9, 0]}>
        <mesh position={[0, -0.45, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.9, 12]} />
          <meshStandardMaterial color={dark} />
        </mesh>
      </group>
    </group>
  );
};

