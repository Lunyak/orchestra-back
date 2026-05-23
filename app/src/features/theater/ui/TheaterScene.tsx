import { OrbitControls, TransformControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { createPortal } from "react-dom";
import { useTheaterScene } from "../model/use-theater-scene";
import type { TheaterSceneProps } from "../model/theater-scene-types";
import { TheaterControls } from "./TheaterControls";
import { BuiltinModelInstance } from "./three/BuiltinModelInstance";
import { FileModelInstance } from "./three/FileModelInstance";
import { SpotlightItem } from "./three/SpotlightItem";
import { TheaterStage } from "./three/TheaterStage";
import "./style.css";

export type { TheaterSceneProps } from "../model/theater-scene-types";

export const TheaterScene = ({
  projectName = "fools",
  theaterLayout,
  onTheaterLayoutChange,
  isPanelsSwapped,
  onTogglePanels,
  controlsHost,
  controlsInPanel,
}: TheaterSceneProps) => {
  const vm = useTheaterScene({
    projectName,
    theaterLayout,
    onTheaterLayoutChange,
  });

  const {
    activeModelId,
    activeModelObject,
    activeModelObjectId,
    activeSpotlightId,
    dragMode,
    editMode,
    effectiveSpotlights,
    gridStep,
    handleActiveObjectChange,
    handleObjectReady,
    hoveredModelId,
    isDragging,
    layout,
    modelTransformMode,
    models,
    resolveModelSrc,
    setEditMode,
    setHoveredModelId,
    setIsDragging,
    setModelTransformMode,
    showGrid,
    showOnlyActiveSpotlight,
    showSpotlights,
    snapToGrid,
    spotlights,
    syncActiveModel,
    updateCurrentStep,
    updateSpotlight,
  } = vm;

  const controlsNode = (
    <TheaterControls vm={vm} controlsInPanel={controlsInPanel} />
  );

  const controlsRender =
    controlsInPanel && controlsHost && controlsNode
      ? createPortal(controlsNode, controlsHost)
      : controlsInPanel
        ? null
        : controlsNode;

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
                Math.round(Math.max(layout.hallWidth, layout.hallDepth) / gridStep),
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
