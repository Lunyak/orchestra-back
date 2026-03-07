/* eslint-disable react-hooks/exhaustive-deps */
import { FC, useEffect, useRef } from "react";
import * as THREE from "three";

const PARTICLE_COUNT = 32;
const PARTICLE_SIZE = 280;
const TRIANGLE_Z = 700;
const PARTICLE_Z_MIN = -100;
const PARTICLE_Z_MAX = TRIANGLE_Z - 50;

interface IProps {
  color?: number;
  text?: string;
}

const SmokeText: FC<IProps> = ({ color = 0x0a6b5e, text = "Дофамин" }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameIdRef = useRef<number>(0);

  useEffect(() => {
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let clock: THREE.Clock;
    let smokeInstanced: THREE.InstancedMesh | null = null;
    const rotationZ = new Float32Array(PARTICLE_COUNT);
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const scales = new Float32Array(PARTICLE_COUNT);
    const driftPhase = new Float32Array(PARTICLE_COUNT);
    const driftSpeed = new Float32Array(PARTICLE_COUNT);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    let delta = 0;
    let timeAccum = 0;

    function init() {
      clock = new THREE.Clock();

      const renderer = new THREE.WebGLRenderer({ alpha: true, powerPreference: "low-power" });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      rendererRef.current = renderer;

      scene = new THREE.Scene();

      camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        1,
        10000
      );
      camera.position.z = 1000;

      const light = new THREE.DirectionalLight(0xffffff, 0.8);
      light.position.set(-1, 0, 1);
      scene.add(light);

      const smokeTexture = new THREE.TextureLoader().load(
        "https://s3-us-west-2.amazonaws.com/s.cdpn.io/95637/Smoke-Element.png"
      );
      const smokeMaterial = new THREE.MeshLambertMaterial({
        map: smokeTexture,
        transparent: true,
        opacity: 0.35,
        color: color,
        depthWrite: false,
      });
      const smokeGeo = new THREE.PlaneGeometry(PARTICLE_SIZE, PARTICLE_SIZE);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        positions[i * 3 + 0] = Math.random() * 500 - 250;
        positions[i * 3 + 1] = Math.random() * 500 - 250;
        positions[i * 3 + 2] =
          Math.random() * (PARTICLE_Z_MAX - PARTICLE_Z_MIN) + PARTICLE_Z_MIN;
        rotationZ[i] = Math.random() * Math.PI * 2;
        scales[i] = 0.7 + Math.random() * 0.8;
        driftPhase[i] = Math.random() * Math.PI * 2;
        driftSpeed[i] = 0.4 + Math.random() * 0.35;
      }

      smokeInstanced = new THREE.InstancedMesh(
        smokeGeo,
        smokeMaterial,
        PARTICLE_COUNT
      );
      smokeInstanced.count = PARTICLE_COUNT;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        position.set(
          positions[i * 3 + 0],
          positions[i * 3 + 1],
          positions[i * 3 + 2]
        );
        quaternion.setFromEuler(new THREE.Euler(0, 0, rotationZ[i]));
        scale.setScalar(scales[i]);
        matrix.compose(position, quaternion, scale);
        smokeInstanced.setMatrixAt(i, matrix);
      }
      smokeInstanced.instanceMatrix.needsUpdate = true;
      scene.add(smokeInstanced);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvas.width = 1024;
      canvas.height = 512;

      const canvasTexture = new THREE.CanvasTexture(canvas);
      const canvasMaterial = new THREE.MeshBasicMaterial({
        map: canvasTexture,
        transparent: true,
        opacity: 1,
      });

      const textPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(350, 175),
        canvasMaterial
      );
      textPlane.position.set(0, 0, TRIANGLE_Z + 1);
      scene.add(textPlane);

      async function drawText() {
        await (document as any).fonts.ready;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white";
        ctx.font = "140px 'Russo One', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        canvasTexture.needsUpdate = true;
      }
      drawText();

      if (mountRef.current) {
        mountRef.current.innerHTML = "";
        mountRef.current.appendChild(renderer.domElement);
      }

      function updateInstances() {
        if (!smokeInstanced) return;
        timeAccum += delta;
        for (let p = 0; p < PARTICLE_COUNT; p++) {
          const phase = driftPhase[p] + timeAccum * driftSpeed[p];
          const driftX = Math.sin(phase) * 28 + Math.cos(phase * 0.7) * 18;
          const driftY = Math.cos(phase * 0.9) * 22 + Math.sin(phase * 0.5) * 14;
          position.set(
            positions[p * 3 + 0] + driftX,
            positions[p * 3 + 1] + driftY,
            positions[p * 3 + 2]
          );
          rotationZ[p] += delta * 0.15;
          quaternion.setFromEuler(new THREE.Euler(0, 0, rotationZ[p]));
          scale.setScalar(scales[p]);
          matrix.compose(position, quaternion, scale);
          smokeInstanced.setMatrixAt(p, matrix);
        }
        smokeInstanced.instanceMatrix.needsUpdate = true;
      }

      function animate() {
        if (document.hidden) {
          frameIdRef.current = requestAnimationFrame(animate);
          return;
        }
        delta = clock.getDelta();
        updateInstances();
        renderer.render(scene, camera);
        frameIdRef.current = requestAnimationFrame(animate);
      }

      frameIdRef.current = requestAnimationFrame(animate);
    }

    init();

    const handleResize = () => {
      if (!rendererRef.current || !camera) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameIdRef.current);
      window.removeEventListener("resize", handleResize);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      if (scene) scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const m = mesh.material as THREE.Material;
          m.dispose();
          const mat = m as THREE.Material & { map?: THREE.Texture };
          if (mat.map) mat.map.dispose();
        }
      });
      if (mountRef.current) {
        mountRef.current.innerHTML = "";
      }
    };
  }, []);

  return <div className="smoke" ref={mountRef} />;
};

export default SmokeText;
