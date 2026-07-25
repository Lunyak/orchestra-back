import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { theaterSmokeBeamOpacity } from "../../model/theater-scene-lighting";

type SpotlightSmokeBeamProps = {
  position: [number, number, number];
  target: [number, number, number];
  angleRad: number;
  color: string;
  uiIntensity: number;
  smokeSaturation?: number;
};

/** Мягкий объёмный луч: градиент по оси и радиусу (свет в дыму). */
export function SpotlightSmokeBeam({
  position,
  target,
  angleRad,
  color,
  uiIntensity,
  smokeSaturation = 1,
}: SpotlightSmokeBeamProps) {
  const opacity = theaterSmokeBeamOpacity(uiIntensity, smokeSaturation);
  const beam = useMemo(() => {
    const start = new THREE.Vector3(...position);
    const end = new THREE.Vector3(...target);
    const direction = end.clone().sub(start);
    const length = Math.max(0.35, direction.length());
    if (length < 0.01) return null;
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );
    const radius = Math.max(0.12, Math.tan(angleRad) * length);
    return { mid, quaternion, length, radius };
  }, [angleRad, position, target]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        fog: false,
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opacity },
          uLength: { value: 1 },
          uRadiusTip: { value: 0.03 },
          uRadiusBase: { value: 1 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vLocal;
          void main() {
            vLocal = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uOpacity;
          uniform float uLength;
          uniform float uRadiusTip;
          uniform float uRadiusBase;
          varying vec3 vLocal;
          void main() {
            float t = clamp((vLocal.y + uLength * 0.5) / max(uLength, 0.001), 0.0, 1.0);
            float maxR = mix(uRadiusTip, uRadiusBase, t);
            float radial = length(vLocal.xz) / max(maxR, 0.001);
            float radialFade = 1.0 - smoothstep(0.15, 1.0, radial);
            radialFade *= radialFade;
            float axialFade = pow(1.0 - t, 0.55) * smoothstep(0.0, 0.08, t);
            float alpha = uOpacity * radialFade * axialFade;
            if (alpha < 0.002) discard;
            gl_FragColor = vec4(uColor, alpha);
          }
        `,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useEffect(() => {
    if (!beam) return;
    const { uniforms } = material;
    if (!uniforms.uColor || !uniforms.uOpacity || !uniforms.uLength || !uniforms.uRadiusBase) {
      return;
    }
    uniforms.uColor.value.set(color);
    uniforms.uOpacity.value = opacity;
    uniforms.uLength.value = beam.length;
    uniforms.uRadiusBase.value = beam.radius;
  }, [beam, color, material, opacity]);

  if (!beam || opacity <= 0) return null;

  return (
    <mesh
      position={beam.mid.toArray()}
      quaternion={beam.quaternion}
      material={material}
      raycast={() => null}
      renderOrder={2}
    >
      <cylinderGeometry args={[beam.radius, 0.03, beam.length, 36, 1, true]} />
    </mesh>
  );
}
