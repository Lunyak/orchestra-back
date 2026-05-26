import { useCallback, useEffect, useMemo } from "react";
import * as THREE from "three";

export const StrawGridModel = ({
  size = 6,
}: {
  size?: number;
}) => {
  const grassMap = useMemo(() => {
    const width = 64;
    const height = 64;
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        const noise =
          (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        const grain = Math.abs(noise);
        const baseR = 90;
        const baseG = 125;
        const baseB = 80;
        const v = 0.75 + grain * 0.45;
        data[i] = Math.max(0, Math.min(255, Math.round(baseR * v)));
        data[i + 1] = Math.max(0, Math.min(255, Math.round(baseG * v)));
        data[i + 2] = Math.max(0, Math.min(255, Math.round(baseB * v)));
        data[i + 3] = 255;
      }
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }, []);

  useEffect(() => {
    grassMap.repeat.set(size / 2, size / 2);
    grassMap.needsUpdate = true;
  }, [grassMap, size]);

  const ignoreRaycast = useCallback(() => null, []);

  return (
    <group raycast={ignoreRaycast}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
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

