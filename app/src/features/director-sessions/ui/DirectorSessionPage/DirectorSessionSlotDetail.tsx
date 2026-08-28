import { FormTextarea } from "@shared/core/form-textarea/FormTextarea";
import { MiniAvatar } from "@shared/components/mini-avatar/MiniAvatar";
import { useState } from "react";
import type { ScriptScene } from "../../../../shared/types/script";
import type { TeamProfile } from "../../../../sync/api/profile";
import { profileListAvatarSrc } from "../../../../sync/api/profile";
import type { TroupeMemberItem } from "../../../../sync/api/troupe";
import type {
  DirectorSessionSlot,
  DirectorSlotRoleRehearsalPick,
} from "../../directorSessionsSync";
import {
  getTroupeMemberLabel,
  isSlotScenePickerCustomSlug,
  SLOT_SCENE_PICKER_CUSTOM_SLUG,
} from "../../model/session-page-utils";
import { RehearsalsCard } from "../../../rehearsals-card/RehearsalsCard";
import { SlotParticipantsPickerModal } from "../SlotParticipantsPickerModal";
import {
  SlotScenePickerModal,
  type SlotSceneListItem,
} from "../SlotScenePickerModal";
import { SlotRoleRehearsalPicker } from "../SlotRoleRehearsalPicker";
import { TroupeSchedulePreview } from "../TroupeSchedulePreview";
import { DirectorSessionPreviewSlot } from "./DirectorSessionPreviewSlot";

export type DirectorSessionSlotDetailProps = {
  slot: DirectorSessionSlot;
  isTheaterContext: boolean;
  selectedSceneLabel: string;
  selectedSceneProjectLabel: string;
  selectedScene: ScriptScene | null;
  projectFilter: string;
  onProjectFilterChange: (slug: string) => void;
  visibleProjects: string[];
  scenePickerProjects: Array<{ slug: string; label: string }>;
  selectableScenes: SlotSceneListItem[];
  scenesLoading: boolean;
  scenesError: string | null;
  availabilityError: string | null;
  sessionStartsAt: string | null;
  slotsBySceneRefInSession: Map<string, DirectorSessionSlot[]>;
  onSelectScene: (scene: ScriptScene) => void;
  onSelectProgRun: () => void;
  onSelectCustom: (title: string) => void;
  sessionDateKey: string | null;
  scheduleProfiles: TeamProfile[];
  scheduleMembersLoading: boolean;
  slotChartEmailSet: Set<string> | undefined;
  slotRoleKeysForPicker: string[];
  roleTitleByKey: Record<string, string>;
  roleEmailsByKey: Record<string, string[]>;
  teamProfiles: TeamProfile[];
  onRolePicksChange: (next: DirectorSlotRoleRehearsalPick[]) => void;
  theaterMembers: TroupeMemberItem[];
  selectedTheaterMembers: TroupeMemberItem[];
  selectedParticipantEmails: string[];
  onApplyParticipants: (emails: string[]) => void;
  slotNotesDraft: string;
  onSlotNotesChange: (value: string) => void;
  onSlotNotesBlur: () => void;
};

export function DirectorSessionSlotDetail({
  slot,
  isTheaterContext,
  selectedSceneLabel,
  selectedSceneProjectLabel,
  selectedScene,
  projectFilter,
  onProjectFilterChange,
  visibleProjects,
  scenePickerProjects,
  selectableScenes,
  scenesLoading,
  scenesError,
  availabilityError,
  sessionStartsAt,
  slotsBySceneRefInSession,
  onSelectScene,
  onSelectProgRun,
  onSelectCustom,
  sessionDateKey,
  scheduleProfiles,
  scheduleMembersLoading,
  slotChartEmailSet,
  slotRoleKeysForPicker,
  roleTitleByKey,
  roleEmailsByKey,
  teamProfiles,
  onRolePicksChange,
  theaterMembers,
  selectedTheaterMembers,
  selectedParticipantEmails,
  onApplyParticipants,
  slotNotesDraft,
  onSlotNotesChange,
  onSlotNotesBlur,
}: DirectorSessionSlotDetailProps) {
  const [sceneModalOpen, setSceneModalOpen] = useState(false);
  const [participantsModalOpen, setParticipantsModalOpen] = useState(false);

  const hasSceneOrProgRun = Boolean(selectedScene || slot.isProgRun);
  const showTheaterParticipants = isTheaterContext && !slot.ref;
  const showScheduleWithoutScene = !selectedScene && !slot.ref;
  const selectedSceneIdForPicker =
    !slot.isProgRun && slot.ref?.projectSlug === projectFilter
      ? Number(slot.ref.sceneId) || null
      : null;
  const isProgRunSelected =
    Boolean(slot.isProgRun) && slot.ref?.projectSlug === projectFilter;
  const initialCustomTitle = !slot.ref ? String(slot.title ?? "").trim() : "";
  const participantsCountLabel = selectedParticipantEmails.length
    ? `Выбрано: ${selectedParticipantEmails.length}`
    : "Выбрать актёров";
  const overflowParticipantsCount = selectedTheaterMembers.length - 5;
  const hasOverflowParticipants = selectedTheaterMembers.length > 5;

  const openSceneModal = () => {
    if (slot.ref?.projectSlug) {
      onProjectFilterChange(slot.ref.projectSlug);
    } else if (String(slot.title ?? "").trim()) {
      onProjectFilterChange(SLOT_SCENE_PICKER_CUSTOM_SLUG);
    } else if (
      !projectFilter ||
      isSlotScenePickerCustomSlug(projectFilter)
    ) {
      if (visibleProjects[0]) {
        onProjectFilterChange(visibleProjects[0]);
      }
    }
    setSceneModalOpen(true);
  };

  return (
    <div className="director-session-page__detail-grid">
      <RehearsalsCard
        fluid
        title=""
        className="director-session-page__preview"
      >
        <div className="director-session-page__slot-field">
          <button
            type="button"
            className="director-session-page__participants-trigger"
            onClick={openSceneModal}
            aria-label="Сцена или название"
          >
            <span className="director-session-page__participants-label">
              {selectedSceneLabel || "Выбрать сцену или название"}
            </span>
            {selectedSceneProjectLabel ? (
              <span className="director-session-page__scene-project">
                {selectedSceneProjectLabel}
              </span>
            ) : null}
          </button>
          <SlotScenePickerModal
            isOpen={sceneModalOpen}
            onClose={() => setSceneModalOpen(false)}
            projects={scenePickerProjects}
            projectSlug={projectFilter || SLOT_SCENE_PICKER_CUSTOM_SLUG}
            onProjectChange={onProjectFilterChange}
            scenes={selectableScenes}
            scenesLoading={scenesLoading}
            scenesError={scenesError}
            availabilityError={availabilityError}
            selectedSceneId={selectedSceneIdForPicker}
            isProgRunSelected={isProgRunSelected}
            currentSlotId={slot.id}
            sessionStartsAt={sessionStartsAt}
            slotsBySceneRefInSession={slotsBySceneRefInSession}
            onSelectScene={onSelectScene}
            onSelectProgRun={onSelectProgRun}
            initialCustomTitle={initialCustomTitle}
            onSelectCustom={onSelectCustom}
          />
        </div>

        {hasSceneOrProgRun ? (
          <div className="session__selected-scene">
            <TroupeSchedulePreview
              sessionDateKey={sessionDateKey}
              profiles={scheduleProfiles}
              membersLoading={scheduleMembersLoading}
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

        {showTheaterParticipants ? (
          <div className="director-session-page__slot-field">
            <span className="form-textarea__label">Участники</span>
            {theaterMembers.length ? (
              <>
                <button
                  type="button"
                  className="director-session-page__participants-trigger"
                  onClick={() => setParticipantsModalOpen(true)}
                >
                  <span className="director-session-page__participants-avatars">
                    {selectedTheaterMembers.slice(0, 5).map((member) => {
                      const label = getTroupeMemberLabel(member);
                      return (
                        <MiniAvatar
                          key={member.id}
                          src={profileListAvatarSrc(member.profile)}
                          label={label}
                          size={28}
                          title={label}
                        />
                      );
                    })}
                    {hasOverflowParticipants ? (
                      <span className="director-session-page__participants-more">
                        +{overflowParticipantsCount}
                      </span>
                    ) : null}
                  </span>
                  <span className="director-session-page__participants-label">
                    {participantsCountLabel}
                  </span>
                </button>
                <SlotParticipantsPickerModal
                  isOpen={participantsModalOpen}
                  members={theaterMembers}
                  selectedEmails={selectedParticipantEmails}
                  onClose={() => setParticipantsModalOpen(false)}
                  onApply={onApplyParticipants}
                />
              </>
            ) : (
              <div className="rehearsals-muted">
                В труппе театра пока нет участников.
              </div>
            )}
          </div>
        ) : null}

        {showScheduleWithoutScene ? (
          <div className="session__selected-scene">
            <TroupeSchedulePreview
              sessionDateKey={sessionDateKey}
              profiles={scheduleProfiles}
              membersLoading={scheduleMembersLoading}
              participantEmailSet={slotChartEmailSet}
            />
          </div>
        ) : null}

        <FormTextarea
          rootClassName="form-textarea--section"
          label="Заметки к слоту"
          value={slotNotesDraft}
          onChange={(e) => onSlotNotesChange(e.target.value)}
          onBlur={onSlotNotesBlur}
          placeholder="Например: темп, акценты, на что обратить внимание…"
          rows={4}
        />

        {selectedScene ? (
          <DirectorSessionPreviewSlot selectedScene={selectedScene} />
        ) : null}
      </RehearsalsCard>
    </div>
  );
}
