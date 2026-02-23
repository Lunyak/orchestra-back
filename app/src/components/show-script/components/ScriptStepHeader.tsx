import React from "react";
import type { ScriptStep } from "../../../shared/types/script";
import ControlsScript from "../controls-script/ControlsScript";

export function ScriptStepHeader({
  isEditing,
  currentStep,
  updateStep,
  controls,
}: {
  isEditing: boolean;
  currentStep: ScriptStep | undefined;
  updateStep: <K extends keyof ScriptStep>(
    id: number,
    field: K,
    value: ScriptStep[K],
  ) => void;
  controls: null | {
    selectedTrackId: number | null;
    playlistOptions: { id: number; title: string }[];
    onSelectedTrackIdChange: (trackId: number | null) => void;
    lightChannels: string[];
    onLightChannelsChange: (next: string[]) => void;
    selectedLightSlot: number;
    onSelectedLightSlotChange: (slot: number) => void;
    onInsertText: (text: string) => void;
  };
}) {
  return (
    <div className="script-header">
      <div className="script-actions">
        {isEditing && controls ? (
          <ControlsScript
            selectedTrackId={controls.selectedTrackId}
            playlistOptions={controls.playlistOptions}
            onSelectedTrackIdChange={controls.onSelectedTrackIdChange}
            lightChannels={controls.lightChannels}
            selectedLightSlot={controls.selectedLightSlot}
            onLightChannelsChange={controls.onLightChannelsChange}
            onSelectedLightSlotChange={controls.onSelectedLightSlotChange}
            onInsertText={controls.onInsertText}
          />
        ) : null}
      </div>

      {isEditing && currentStep ? (
        <div className="form-group">
          <div className="script-title-insert">
            <label htmlFor={`title-${currentStep?.id}`}></label>
            <input
              id={`title-${currentStep.id}`}
              type="text"
              className="form-input"
              value={currentStep.title ?? ""}
              onChange={(e) => updateStep(currentStep.id, "title", e.target.value)}
              placeholder="Введите название шага"
            />
          </div>
          <div className="script-duration-insert">
            <label>
              <div className="script-duration-label">Длительность (мин)</div>
              <input
                type="number"
                min={1}
                max={480}
                step={1}
                className="form-input"
                value={currentStep.durationMin ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (!raw) {
                    updateStep(currentStep.id, "durationMin", undefined);
                    return;
                  }
                  const n = Number(raw);
                  if (!Number.isFinite(n)) return;
                  const clamped = Math.max(1, Math.min(480, Math.trunc(n)));
                  updateStep(currentStep.id, "durationMin", clamped);
                }}
                placeholder="например 10"
              />
            </label>
          </div>
        </div>
      ) : (
        <div className="script-step-title">{currentStep?.title}</div>
      )}
    </div>
  );
}

