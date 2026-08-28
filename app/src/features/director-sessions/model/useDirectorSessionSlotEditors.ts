import { useEffect, useMemo, useState } from "react";
import type { ScriptScene } from "../../../shared/types/script";
import type { TroupeMemberItem } from "../../../sync/api/troupe";
import type {
  DirectorSessionSlot,
} from "../directorSessionsSync";
import {
  isSlotScenePickerCustomSlug,
  normalizeEmail,
  SLOT_SCENE_PICKER_CUSTOM_SLUG,
} from "./session-page-utils";
import type { DirectorSessionProjectDataCache } from "./session-page-types";
import {
  getNormalizedRoleKeysForAllScenes,
  materializeAllRoleRehearsalPicks,
  SLOT_PROG_RUN_TITLE,
} from "./session-slot-planned";

export function useDirectorSessionSlotEditors(args: {
  slot: DirectorSessionSlot | null;
  projectFilter: string;
  setProjectFilter: (value: string) => void;
  visibleProjects: string[];
  rolesSlug: string;
  roleEmailsByKey: Record<string, string[]>;
  roleEmailsByProjectSlug: Record<string, Record<string, string[]>>;
  dataCache: DirectorSessionProjectDataCache;
  theaterMembers: TroupeMemberItem[];
  updateSlot: (patch: Partial<DirectorSessionSlot>) => Promise<void>;
}) {
  const {
    slot,
    projectFilter,
    setProjectFilter,
    visibleProjects,
    rolesSlug,
    roleEmailsByKey,
    roleEmailsByProjectSlug,
    dataCache,
    theaterMembers,
    updateSlot,
  } = args;

  const [participantsModalOpen, setParticipantsModalOpen] = useState(false);
  const [sceneModalOpen, setSceneModalOpen] = useState(false);

  const selectedParticipantEmails = useMemo(
    () =>
      new Set(
        (slot?.participantEmails ?? []).map((email) =>
          normalizeEmail(String(email ?? "")),
        ),
      ),
    [slot?.participantEmails],
  );

  const selectedParticipantEmailsList = useMemo(
    () => Array.from(selectedParticipantEmails).filter(Boolean),
    [selectedParticipantEmails],
  );

  const selectedTheaterMembers = useMemo(
    () =>
      theaterMembers.filter((member) =>
        selectedParticipantEmails.has(normalizeEmail(member.email)),
      ),
    [theaterMembers, selectedParticipantEmails],
  );

  const applySlotParticipants = (emails: string[]) => {
    if (!slot) return;
    void updateSlot({
      participantEmails: emails
        .map((email) => normalizeEmail(email))
        .filter(Boolean),
    });
  };

  useEffect(() => {
    if (!slot) {
      setParticipantsModalOpen(false);
      setSceneModalOpen(false);
    }
  }, [slot]);

  const assignSceneToSlot = (scene: ScriptScene) => {
    if (!slot || !projectFilter || isSlotScenePickerCustomSlug(projectFilter))
      return;
    const sceneTitle =
      String(scene.title ?? "").trim() || `Сцена #${scene.id}`;
    void updateSlot({
      title: sceneTitle,
      ref: {
        projectSlug: projectFilter,
        sceneId: scene.id,
      },
      durationMin:
        scene.durationMin == null
          ? slot.durationMin
          : Math.max(1, Math.floor(Number(scene.durationMin) || 1)),
      isProgRun: false,
      roleRehearsalPicks: undefined,
    });
  };

  const assignProgRunToSlot = () => {
    if (!slot || !projectFilter || isSlotScenePickerCustomSlug(projectFilter))
      return;
    const pack = dataCache[projectFilter];
    const scenes = pack?.scenes ?? [];
    const firstScene = scenes[0];
    if (!firstScene) return;
    const roleEmails =
      projectFilter === rolesSlug && Object.keys(roleEmailsByKey).length > 0
        ? roleEmailsByKey
        : (roleEmailsByProjectSlug[projectFilter] ?? {});
    const roleKeys = getNormalizedRoleKeysForAllScenes(
      scenes,
      pack?.sceneRoles ?? null,
    );
    void updateSlot({
      title: SLOT_PROG_RUN_TITLE,
      ref: {
        projectSlug: projectFilter,
        sceneId: firstScene.id,
      },
      isProgRun: true,
      roleRehearsalPicks: materializeAllRoleRehearsalPicks(
        roleKeys,
        roleEmails,
      ),
    });
  };

  const assignCustomSlotTitle = (title: string) => {
    if (!slot) return;
    const nextTitle = title.trim() || "Без названия";
    void updateSlot({
      title: nextTitle,
      ref: undefined,
      isProgRun: false,
      roleRehearsalPicks: undefined,
    });
  };

  const openSceneModal = () => {
    if (!slot) return;
    if (slot.ref?.projectSlug) {
      setProjectFilter(slot.ref.projectSlug);
    } else if (String(slot.title ?? "").trim()) {
      setProjectFilter(SLOT_SCENE_PICKER_CUSTOM_SLUG);
    } else if (
      !projectFilter ||
      isSlotScenePickerCustomSlug(projectFilter)
    ) {
      if (visibleProjects[0]) {
        setProjectFilter(visibleProjects[0]);
      }
    }
    setSceneModalOpen(true);
  };

  const closeSceneModal = () => setSceneModalOpen(false);
  const openParticipantsModal = () => setParticipantsModalOpen(true);
  const closeParticipantsModal = () => setParticipantsModalOpen(false);

  const onRoleRehearsalPicksChange = (
    next: NonNullable<DirectorSessionSlot["roleRehearsalPicks"]>,
  ) => {
    void updateSlot({ roleRehearsalPicks: next });
  };

  return {
    participantsModalOpen,
    setParticipantsModalOpen,
    sceneModalOpen,
    setSceneModalOpen,
    openSceneModal,
    closeSceneModal,
    openParticipantsModal,
    closeParticipantsModal,
    selectedParticipantEmailsList,
    selectedTheaterMembers,
    applySlotParticipants,
    assignSceneToSlot,
    assignProgRunToSlot,
    assignCustomSlotTitle,
    onRoleRehearsalPicksChange,
  };
}
