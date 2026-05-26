import { tc } from "../../../../shared/styles/theme-color";
import { TransformControls } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { TheaterLayout } from "../../../../shared/types/script";
import { getAudienceStartZBounds } from "../../model/theater-metrics";

const snapValue = (
  value: number,
  step: number,
  enabled: boolean,
  origin = 0,
) => {
  if (!enabled || step <= 0) return value;
  return origin + Math.round((value - origin) / step) * step;
};

export const AudienceSeatsHandle = ({
  layout,
  active,
  highlighted,
  snapEnabled,
  snapStep,
  onAudienceStartZPreview,
  onAudienceStartZChange,
  onDraggingChange,
}: {
  layout: TheaterLayout;
  active: boolean;
  highlighted?: boolean;
  snapEnabled: boolean;
  snapStep: number;
  onAudienceStartZPreview: (nextZ: number) => void;
  onAudienceStartZChange: (nextZ: number) => void;
  onDraggingChange: (value: boolean) => void;
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const isDraggingRef = useRef(false);
  const [controlsTarget, setControlsTarget] = useState<THREE.Group | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { min: minZ, max: maxStartZ } = getAudienceStartZBounds(layout);
  const blockDepth =
    layout.seatRows > 0 ? (layout.seatRows - 1) * layout.rowSpacing : 0;
  const centerZ = layout.audienceStartZ + blockDepth / 2;
  const maxZ = maxStartZ + blockDepth;
  const width = Math.max(
    1,
    (layout.seatsPerRow - 1) * layout.seatSpacing + layout.aisleWidth,
  );
  const boxDepth = Math.max(0.35, blockDepth + 0.35);
  const showHighlight = Boolean(highlighted || isDragging);

  useEffect(() => {
    setControlsTarget(groupRef.current);
  }, [active]);

  useEffect(() => {
    if (!groupRef.current || isDragging) return;
    groupRef.current.position.set(0, 0.45, THREE.MathUtils.clamp(centerZ, minZ, maxZ));
  }, [centerZ, isDragging, minZ, maxZ]);

  const commitPosition = () => {
    if (!groupRef.current) return;
    const draggedCenterZ = groupRef.current.position.z;
    const nextStartZ = THREE.MathUtils.clamp(
      snapValue(draggedCenterZ - blockDepth / 2, snapStep, snapEnabled, -layout.hallDepth / 2),
      minZ,
      maxStartZ,
    );
    onAudienceStartZChange(nextStartZ);
    groupRef.current.position.z = nextStartZ + blockDepth / 2;
  };

  const previewPosition = () => {
    if (!groupRef.current) return;
    const draggedCenterZ = groupRef.current.position.z;
    const nextStartZ = THREE.MathUtils.clamp(
      snapValue(draggedCenterZ - blockDepth / 2, snapStep, snapEnabled, -layout.hallDepth / 2),
      minZ,
      maxStartZ,
    );
    onAudienceStartZPreview(nextStartZ);
  };

  const setDragging = (next: boolean) => {
    isDraggingRef.current = next;
    setIsDragging(next);
    onDraggingChange(next);
  };

  if (!active || layout.seatRows <= 0) return null;

  return (
    <>
      <group ref={groupRef}>
        <mesh visible={showHighlight}>
          <boxGeometry args={[width, 0.12, boxDepth]} />
          <meshStandardMaterial
            color={tc("--color-active-ascent")}
            transparent
            opacity={0.28}
            depthWrite={false}
            emissive={tc("--color-active-ascent")}
            emissiveIntensity={0.35}
          />
        </mesh>
      </group>
      {controlsTarget && (
        <TransformControls
          object={controlsTarget}
          mode="translate"
          showX={false}
          showY={false}
          showZ
          onMouseDown={() => {
            setDragging(true);
          }}
          onObjectChange={() => {
            if (isDraggingRef.current) previewPosition();
          }}
          onMouseUp={() => {
            commitPosition();
            setDragging(false);
          }}
        />
      )}
    </>
  );
};
