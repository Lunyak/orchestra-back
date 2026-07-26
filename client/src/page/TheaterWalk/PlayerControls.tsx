import { PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Group } from "three";

const SPEED = 2.8;
const LOOK_X = 0.0035;
const LOOK_Y = 0.0022;
const EYE_HEIGHT = 1.6;
const MAX_PITCH = 0.7;
const MAX_DELTA = 0.05;

export const ROOM = {
  minX: -5.3,
  maxX: 5.3,
  minZ: -8.3,
  maxZ: 8.3,
  spawnX: 0,
  spawnZ: 6.5,
} as const;

type PlayerControlsProps = {
  onFacingChange?: (facing: string) => void;
};

/**
 * No pointer-lock. Hold LMB and drag to look. WASD to walk.
 * Yaw/pitch on separate groups — no quaternion conversion.
 */
export function PlayerControls({ onFacingChange }: PlayerControlsProps) {
  const { gl } = useThree();
  const yawGroup = useRef<Group>(null);
  const pitchGroup = useRef<Group>(null);
  const draggingRef = useRef(false);
  const lookDelta = useRef({ x: 0, y: 0 });
  const keysRef = useRef({
    forward: false,
    back: false,
    left: false,
    right: false,
  });
  const facingRef = useRef("");

  const resetPose = () => {
    lookDelta.current.x = 0;
    lookDelta.current.y = 0;
    if (!yawGroup.current || !pitchGroup.current) return;
    yawGroup.current.position.set(ROOM.spawnX, EYE_HEIGHT, ROOM.spawnZ);
    yawGroup.current.rotation.set(0, 0, 0);
    pitchGroup.current.rotation.set(0, 0, 0);
    facingRef.current = "";
  };

  useEffect(() => {
    resetPose();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "KeyW" || event.code === "ArrowUp") keysRef.current.forward = true;
      if (event.code === "KeyS" || event.code === "ArrowDown") keysRef.current.back = true;
      if (event.code === "KeyA" || event.code === "ArrowLeft") keysRef.current.left = true;
      if (event.code === "KeyD" || event.code === "ArrowRight") keysRef.current.right = true;
      if (event.code === "KeyR") resetPose();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "KeyW" || event.code === "ArrowUp") keysRef.current.forward = false;
      if (event.code === "KeyS" || event.code === "ArrowDown") keysRef.current.back = false;
      if (event.code === "KeyA" || event.code === "ArrowLeft") keysRef.current.left = false;
      if (event.code === "KeyD" || event.code === "ArrowRight") keysRef.current.right = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const dom = gl.domElement;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      draggingRef.current = true;
      dom.setPointerCapture(event.pointerId);
    };

    const onPointerUp = (event: PointerEvent) => {
      draggingRef.current = false;
      try {
        dom.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!draggingRef.current) return;
      lookDelta.current.x += event.movementX || 0;
      lookDelta.current.y += event.movementY || 0;
    };

    const onContextMenu = (event: Event) => event.preventDefault();

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerUp);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("lostpointercapture", onPointerUp);
    dom.addEventListener("contextmenu", onContextMenu);

    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerUp);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("lostpointercapture", onPointerUp);
      dom.removeEventListener("contextmenu", onContextMenu);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const yaw = yawGroup.current;
    const pitch = pitchGroup.current;
    if (!yaw || !pitch) return;

    const dx = lookDelta.current.x;
    const dy = lookDelta.current.y;
    lookDelta.current.x = 0;
    lookDelta.current.y = 0;

    if (dx !== 0) {
      yaw.rotation.y += dx * LOOK_X;
    }
    if (dy !== 0) {
      pitch.rotation.x += dy * LOOK_Y;
      pitch.rotation.x = clamp(pitch.rotation.x, -MAX_PITCH, MAX_PITCH);
    }

    const facing = facingFromYaw(yaw.rotation.y);
    if (facing !== facingRef.current) {
      facingRef.current = facing;
      onFacingChange?.(facing);
    }

    const dt = Math.min(delta, MAX_DELTA);
    const keys = keysRef.current;
    const forwardInput = Number(keys.forward) - Number(keys.back);
    const sideInput = Number(keys.right) - Number(keys.left);
    if (!forwardInput && !sideInput) return;

    const angle = yaw.rotation.y;
    const forwardX = -Math.sin(angle);
    const forwardZ = -Math.cos(angle);
    const rightX = Math.cos(angle);
    const rightZ = -Math.sin(angle);

    let moveX = forwardX * forwardInput + rightX * sideInput;
    let moveZ = forwardZ * forwardInput + rightZ * sideInput;
    const len = Math.hypot(moveX, moveZ);
    if (len < 1e-6) return;

    moveX = (moveX / len) * SPEED * dt;
    moveZ = (moveZ / len) * SPEED * dt;

    yaw.position.x = clamp(yaw.position.x + moveX, ROOM.minX, ROOM.maxX);
    yaw.position.z = clamp(yaw.position.z + moveZ, ROOM.minZ, ROOM.maxZ);
    yaw.position.y = EYE_HEIGHT;
  });

  return (
    <group ref={yawGroup} position={[ROOM.spawnX, EYE_HEIGHT, ROOM.spawnZ]}>
      <group ref={pitchGroup}>
        <PerspectiveCamera makeDefault fov={70} near={0.1} far={60} />
      </group>
    </group>
  );
}

function facingFromYaw(yaw: number): string {
  // yaw=0 looks toward -Z (far wall)
  const twoPi = Math.PI * 2;
  let a = yaw % twoPi;
  if (a < 0) a += twoPi;
  // Convert so 0 = -Z, increases when turning left (ccw from above)... 
  // Our yaw decreases when mouse moves right, so yaw negative = looking +X (right wall)
  // Angle of look direction on XZ: atan2(forwardX, forwardZ) with forward (-sin y, -cos y)
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const deg = (Math.atan2(forwardX, -forwardZ) * 180) / Math.PI;
  // deg 0 = far (-Z), 90 = right (+X), ±180 = near (+Z), -90 = left (-X)
  if (deg >= -45 && deg < 45) return "впереди · дальняя стена";
  if (deg >= 45 && deg < 135) return "справа · стена чемоданов";
  if (deg >= -135 && deg < -45) return "слева · афиша";
  return "назад · вход";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
