import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import {
  THEATER_CAMERA_CAPTURE_EVENT,
  type TheaterCameraBookmark,
} from "../../model/theater-camera-bookmarks";
import {
  THEATER_CAMERA_FOCUS_EVENT,
  type TheaterCameraFocusRequest,
} from "../../model/theater-camera-focus";
import {
  writeTheaterCamera,
  type TheaterCameraState,
} from "../../model/theater-camera-storage";

type TheaterOrbitControlsProps = {
  projectName: string;
  initialCamera: TheaterCameraState;
  enabled: boolean;
};

const FOCUS_MS = 650;

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

  const animateTo = useCallback(
    (request: TheaterCameraFocusRequest) => {
      const controls = controlsRef.current;
      if (!controls || !(camera instanceof THREE.PerspectiveCamera)) return;

      if (focusAnimRef.current != null) {
        cancelAnimationFrame(focusAnimRef.current);
      }

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
    [camera, persist],
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
    const onCaptureRequest = () => {
      const state = readCameraState();
      window.dispatchEvent(
        new CustomEvent(THEATER_CAMERA_CAPTURE_EVENT, { detail: state }),
      );
    };
    window.addEventListener(
      "orchestra:theater-camera-capture-request",
      onCaptureRequest,
    );
    return () =>
      window.removeEventListener(
        "orchestra:theater-camera-capture-request",
        onCaptureRequest,
      );
  }, [readCameraState]);

  useEffect(() => {
    const onApplyBookmark = (event: Event) => {
      const bookmark = (event as CustomEvent<TheaterCameraBookmark>).detail;
      if (!bookmark?.state) return;
      animateTo({
        position: bookmark.state.position,
        target: bookmark.state.target,
        fov: bookmark.state.fov,
      });
    };
    window.addEventListener("orchestra:theater-camera-apply-bookmark", onApplyBookmark);
    return () =>
      window.removeEventListener(
        "orchestra:theater-camera-apply-bookmark",
        onApplyBookmark,
      );
  }, [animateTo]);

  useEffect(() => {
    window.addEventListener("beforeunload", persist);
    return () => {
      window.removeEventListener("beforeunload", persist);
      if (persistTimerRef.current != null) {
        window.clearTimeout(persistTimerRef.current);
      }
      if (focusAnimRef.current != null) {
        cancelAnimationFrame(focusAnimRef.current);
      }
    };
  }, [persist]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      enabled={enabled}
      onChange={schedulePersist}
      onEnd={persist}
    />
  );
}
