import { Buttons } from "@shared/components/buttons/Buttons";
import { Button } from "@shared/core/button/Button";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import {
  useDirectorSessionSlotsPanel,
  type DirectorSessionSlotsPanelProps,
} from "../model/useDirectorSessionSlotsPanel";
import { DirectorSessionIdleOrderModal } from "./DirectorSessionIdleOrderModal";
import { DirectorSessionSlotsList } from "./DirectorSessionSlotsList";
import { DirectorSessionSlotSettingsModal } from "./DirectorSessionSlotSettingsModal";
import "./director-sessions.css";

export type {
  DirectorSessionSlotDisplay,
  DirectorSessionSlotsPanelProps,
} from "../model/useDirectorSessionSlotsPanel";

export function DirectorSessionSlotsPanel(props: DirectorSessionSlotsPanelProps) {
  const vm = useDirectorSessionSlotsPanel(props);
  const {
    busyConflictError,
    onDismissBusyConflictError,
    canSuggestIdleOrder,
    openIdleOrderPreview,
    closeIdleOrderPreview,
    applyIdleOrderPreview,
    idleOrderPreview,
    idleOrderPreviewItems,
    idleOrderBusyConflicts,
    addSlot,
    selectedSlotForModal,
    slotDraft,
    slotSettings,
    onRequestCloseSlot,
    formatSlotTime,
    patchSlotDraft,
    commitSlotDraft,
  } = vm;

  const idleOrderTitle = canSuggestIdleOrder
    ? "Переставить сцены так, чтобы актёры меньше простаивали"
    : "Нужно минимум 2 слота со сценами";

  return (
    <RehearsalsCard fluid title="" className="director-session-slots-panel">
      <div className="director-session-slots-panel__tools" />

      <DirectorSessionSlotsList vm={vm} />

      {busyConflictError ? (
        <div
          className="director-session-slots-panel__busy-error"
          role="alert"
        >
          <p className="director-session-slots-panel__busy-error-text">
            {busyConflictError}
          </p>
          {onDismissBusyConflictError ? (
            <button
              type="button"
              className="director-session-slots-panel__busy-error-dismiss"
              onClick={onDismissBusyConflictError}
            >
              Понятно
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="director-session-slots-panel__footer-actions">
        <Button
          type="button"
          disabled={!canSuggestIdleOrder}
          title={idleOrderTitle}
          onClick={openIdleOrderPreview}
        >
          Собрать без простоя
        </Button>
        <Buttons.AddButton
          type="button"
          onClick={() => void addSlot()}
          title="Новый слот"
        />
      </div>

      {idleOrderPreview ? (
        <DirectorSessionIdleOrderModal
          preview={idleOrderPreview}
          items={idleOrderPreviewItems}
          busyConflicts={idleOrderBusyConflicts}
          onClose={closeIdleOrderPreview}
          onApply={() => void applyIdleOrderPreview()}
        />
      ) : null}

      {selectedSlotForModal ? (
        <DirectorSessionSlotSettingsModal
          slot={selectedSlotForModal}
          draft={slotDraft[selectedSlotForModal.id]}
          startsAtFallbackTime={formatSlotTime(selectedSlotForModal.offsetMin)}
          busyConflictError={busyConflictError}
          slotSettings={slotSettings}
          onClose={onRequestCloseSlot}
          onPatchDraft={(patch) =>
            patchSlotDraft(selectedSlotForModal.id, patch)
          }
          onCommitDraft={() => void commitSlotDraft(selectedSlotForModal.id)}
        />
      ) : null}
    </RehearsalsCard>
  );
}
