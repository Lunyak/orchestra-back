import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export const SpotlightCone = ({
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
