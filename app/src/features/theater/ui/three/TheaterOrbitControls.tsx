import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import {
  THEATER_CAMERA_FOCUS_EVENT,
  type TheaterCameraFocusRequest,
} from "../../model/theater-camera-focus";
import {
  isTheaterEditableTarget,
  isTheaterPageActive,
} from "../../model/theater-keyboard-shortcuts";
import {
  DEFAULT_THEATER_CAMERA,
  writeTheaterCamera,
  type TheaterCameraState,
} from "../../model/theater-camera-storage";

type TheaterOrbitControlsProps = {
  projectName: string;
  initialCamera: TheaterCameraState;
  enabled: boolean;
};

const FOCUS_MS = 650;
const MOVE_SPEED = 9;
const MOVE_SPEED_FAST = 24;

type MoveKeys = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fast: boolean;
};

const EMPTY_MOVE_KEYS: MoveKeys = {
  forward: false,
  back: false,
  left: false,
  right: false,
  up: false,
  down: false,
  fast: false,
};

export function TheaterOrbitControls({
  projectName,
  initialCamera,
  enabled,
}: TheaterOrbitControlsProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const restoredRef = useRef(false);
  const persistTimerRef = useRef<number | null>(null);
  const focusAnimRef = useRef<number | null>(null);
  const keysRef = useRef<MoveKeys>({ ...EMPTY_MOVE_KEYS });
  const forwardRef = useRef(new THREE.Vector3());
  const rightRef = useRef(new THREE.Vector3());
  const moveRef = useRef(new THREE.Vector3());
  const worldUp = useRef(new THREE.Vector3(0, 1, 0)).current;

  useEffect(() => {
    restoredRef.current = false;
  }, [projectName, initialCamera]);

  useLayoutEffect(() => {
    const controls = controlsRef.current;
    if (!controls || restoredRef.current) return;

    camera.position.set(...initialCamera.position);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = initialCamera.fov;
      camera.updateProjectionMatrix();
    }
    controls.target.set(...initialCamera.target);
    controls.update();
    restoredRef.current = true;
  }, [camera, initialCamera, projectName]);

  const readCameraState = useCallback((): TheaterCameraState | null => {
    const controls = controlsRef.current;
    if (!controls || !(camera instanceof THREE.PerspectiveCamera)) return null;
    return {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
      fov: camera.fov,
    };
  }, [camera]);

  const persist = useCallback(() => {
    const state = readCameraState();
    if (!state) return;
    writeTheaterCamera(projectName, state);
  }, [projectName, readCameraState]);

  const schedulePersist = useCallback(() => {
    if (persistTimerRef.current != null) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      persist();
      persistTimerRef.current = null;
    }, 350);
  }, [persist]);

  const cancelFocusAnim = useCallback(() => {
    if (focusAnimRef.current == null) return;
    cancelAnimationFrame(focusAnimRef.current);
    focusAnimRef.current = null;
  }, []);

  const animateTo = useCallback(
    (request: TheaterCameraFocusRequest) => {
      const controls = controlsRef.current;
      if (!controls || !(camera instanceof THREE.PerspectiveCamera)) return;

      cancelFocusAnim();

      const fromPos = camera.position.clone();
      const fromTarget = controls.target.clone();
      const fromFov = camera.fov;
      const toPos = new THREE.Vector3(...(request.position ?? fromPos.toArray()));
      const toTarget = new THREE.Vector3(...request.target);
      const toFov =
        typeof request.fov === "number" && Number.isFinite(request.fov)
          ? request.fov
          : fromFov;
      const started = performance.now();

      const tick = (now: number) => {
        const t = Math.min(1, (now - started) / FOCUS_MS);
        const eased = 1 - (1 - t) ** 3;
        camera.position.lerpVectors(fromPos, toPos, eased);
        controls.target.lerpVectors(fromTarget, toTarget, eased);
        camera.fov = THREE.MathUtils.lerp(fromFov, toFov, eased);
        camera.updateProjectionMatrix();
        controls.update();
        if (t < 1) {
          focusAnimRef.current = requestAnimationFrame(tick);
        } else {
          focusAnimRef.current = null;
          persist();
        }
      };

      focusAnimRef.current = requestAnimationFrame(tick);
    },
    [camera, cancelFocusAnim, persist],
  );

  useEffect(() => {
    const onFocus = (event: Event) => {
      const detail = (event as CustomEvent<TheaterCameraFocusRequest>).detail;
      if (!detail?.target) return;
      animateTo(detail);
    };
    window.addEventListener(THEATER_CAMERA_FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(THEATER_CAMERA_FOCUS_EVENT, onFocus);
  }, [animateTo]);

  useEffect(() => {
    const applyMoveKey = (code: string, pressed: boolean) => {
      const keys = keysRef.current;
      switch (code) {
        case "KeyW":
          keys.forward = pressed;
          break;
        case "KeyS":
          keys.back = pressed;
          break;
        case "KeyA":
          keys.left = pressed;
          break;
        case "KeyD":
          keys.right = pressed;
          break;
        case "KeyQ":
          keys.down = pressed;
          break;
        case "KeyE":
          keys.up = pressed;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          keys.fast = pressed;
          break;
        default:
          return false;
      }
      return true;
    };

    const canCaptureMove = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return false;
      if (isTheaterEditableTarget(event.target)) return false;
      if (!isTheaterPageActive()) return false;
      return true;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!canCaptureMove(event)) return;

      if (event.code === "Home") {
        event.preventDefault();
        animateTo({
          position: DEFAULT_THEATER_CAMERA.position,
          target: DEFAULT_THEATER_CAMERA.target,
          fov: DEFAULT_THEATER_CAMERA.fov,
        });
        return;
      }

      if (!applyMoveKey(event.code, true)) return;
      event.preventDefault();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      applyMoveKey(event.code, false);
    };

    const onBlur = () => {
      keysRef.current = { ...EMPTY_MOVE_KEYS };
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
      keysRef.current = { ...EMPTY_MOVE_KEYS };
    };
  }, [animateTo]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls || !enabled) return;

    const keys = keysRef.current;
    const hasMove =
      keys.forward ||
      keys.back ||
      keys.left ||
      keys.right ||
      keys.up ||
      keys.down;
    if (!hasMove) return;

    cancelFocusAnim();

    const forward = forwardRef.current;
    const right = rightRef.current;
    const move = moveRef.current;
    move.set(0, 0, 0);

    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) {
      forward.set(0, 0, -1);
    } else {
      forward.normalize();
    }
    right.crossVectors(forward, worldUp).normalize();

    const speed = (keys.fast ? MOVE_SPEED_FAST : MOVE_SPEED) * delta;
    if (keys.forward) move.addScaledVector(forward, speed);
    if (keys.back) move.addScaledVector(forward, -speed);
    if (keys.right) move.addScaledVector(right, speed);
    if (keys.left) move.addScaledVector(right, -speed);
    if (keys.up) move.y += speed;
    if (keys.down) move.y -= speed;

    camera.position.add(move);
    controls.target.add(move);
    controls.update();
    schedulePersist();
  });

  useEffect(() => {
    window.addEventListener("beforeunload", persist);
    return () => {
      window.removeEventListener("beforeunload", persist);
      if (persistTimerRef.current != null) {
        window.clearTimeout(persistTimerRef.current);
      }
      cancelFocusAnim();
    };
  }, [cancelFocusAnim, persist]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.85}
      panSpeed={1.35}
      zoomSpeed={1.25}
      screenSpacePanning
      minDistance={0.4}
      maxDistance={220}
      maxPolarAngle={Math.PI / 2 + 0.25}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.PAN,
      }}
      enabled={enabled}
      onChange={schedulePersist}
      onEnd={persist}
    />
  );
}
