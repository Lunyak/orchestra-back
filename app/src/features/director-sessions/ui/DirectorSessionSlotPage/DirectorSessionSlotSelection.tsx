import { FormTextarea } from "@shared/core/form-textarea/FormTextarea";
import type { ScriptScene } from "../../../../shared/types/script";
import type { TeamProfile } from "../../../../sync/api/profile";
import type {
  DirectorSessionSlot,
  DirectorSlotRoleRehearsalPick,
} from "../../directorSessionsSync";
import { RehearsalsCard } from "../../../rehearsals-card/RehearsalsCard";
import { SlotRoleRehearsalPicker } from "../SlotRoleRehearsalPicker";
import { TroupeSchedulePreview } from "../TroupeSchedulePreview";

export type DirectorSessionSlotSelectionProps = {
  slot: DirectorSessionSlot;
  selectedProjectLabel: string;
  selectedScene: ScriptScene | null;
  selectedScenePreviewText: string;
  sessionDateKey: string | null;
  teamProfiles: TeamProfile[];
  membersLoading: boolean;
  slotChartEmailSet: Set<string> | undefined;
  slotRoleKeysForPicker: string[];
  roleTitleByKey: Record<string, string>;
  roleEmailsByKey: Record<string, string[]>;
  onRolePicksChange: (next: DirectorSlotRoleRehearsalPick[]) => void;
  slotNotesDraft: string;
  onSlotNotesChange: (value: string) => void;
  onSlotNotesBlur: () => void;
  onClearMaterial: () => void;
  onDone: () => void;
};

export function DirectorSessionSlotSelection({
  slot,
  selectedProjectLabel,
  selectedScene,
  selectedScenePreviewText,
  sessionDateKey,
  teamProfiles,
  membersLoading,
  slotChartEmailSet,
  slotRoleKeysForPicker,
  roleTitleByKey,
  roleEmailsByKey,
  onRolePicksChange,
  slotNotesDraft,
  onSlotNotesChange,
  onSlotNotesBlur,
  onClearMaterial,
  onDone,
}: DirectorSessionSlotSelectionProps) {
  const hasRef = Boolean(slot.ref);
  const selectedSceneTitle = selectedScene?.title
    ? selectedScene.title
    : "—";

  return (
    <RehearsalsCard fluid title="Текущий выбор">
      <div className="director-session-slot-page__selection-summary">
        {hasRef && slot.ref ? (
          <>
            <div>
              Проект: <b>{selectedProjectLabel}</b>
            </div>
            <div>
              Картина / сцена: <b>#{slot.ref.sceneId}</b>
            </div>
          </>
        ) : (
          <div>Материал не выбран.</div>
        )}
      </div>

      {selectedScene ? (
        <div className="director-session-slot-page__preview">
          <div className="director-session-slot-page__preview-title">
            Превью
          </div>
          <div className="director-session-slot-page__preview-scene-title">
            {selectedSceneTitle}
          </div>
          <pre className="director-session-slot-page__preview-text">
            {selectedScenePreviewText}
          </pre>
          <TroupeSchedulePreview
            sessionDateKey={sessionDateKey}
            profiles={teamProfiles}
            membersLoading={membersLoading}
            participantEmailSet={slotChartEmailSet}
          />
          <SlotRoleRehearsalPicker
            roleKeys={slotRoleKeysForPicker}
            roleTitleByKey={roleTitleByKey}
            roleEmailsByKey={roleEmailsByKey}
            picks={slot.roleRehearsalPicks}
            profiles={teamProfiles}
            onPicksChange={onRolePicksChange}
          />
        </div>
      ) : null}

      <FormTextarea
        rootClassName="form-textarea--section"
        label="Заметки к слоту"
        value={slotNotesDraft}
        onChange={(e) => onSlotNotesChange(e.target.value)}
        onBlur={onSlotNotesBlur}
        placeholder="Например: темп, ключевой акцент, кого проверить…"
        rows={4}
      />

      <div className="director-session-slot-page__actions">
        <button
          type="button"
          className="director-session-slot-page__action-btn"
          onClick={onClearMaterial}
        >
          Снять материал
        </button>
        <button
          type="button"
          className="director-session-slot-page__action-btn"
          onClick={onDone}
        >
          Готово
        </button>
      </div>
    </RehearsalsCard>
  );
}
