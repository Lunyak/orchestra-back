import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MiniAvatar } from "../../../shared/components/mini-avatar/MiniAvatar";
import { useAppDispatch } from "../../../shared/store/hooks";
import { normalizeActorKey } from "../../actor/model/actor-page-helpers";
import { getProfilesBatch, type TeamProfile } from "../../../sync/api/profile";
import type { ProjectRoleInfo } from "../../../sync/api/projects";
import type { DialogueLine } from "./dialogue";
import {
  buildActorsByPartnerRole,
  buildPartnerRolesInScene,
  collectAssignedActorEmails,
} from "./voice-dialogue-helpers";
import { actorDisplayName } from "./voice-trainer-partner";
import {
  voiceTrainerUiActions,
  type PartnerVoiceSource,
} from "./voiceTrainerUiSlice";

export function useVoiceDialoguePartners(opts: {
  allLines: DialogueLine[];
  desiredRoleKeySet: Set<string>;
  projectRoles: ProjectRoleInfo[];
  accessToken: string | null | undefined;
  uiKey: string;
  partnerVoiceByRoleKey: Record<string, PartnerVoiceSource | undefined>;
}) {
  const {
    allLines,
    desiredRoleKeySet,
    projectRoles,
    accessToken,
    uiKey,
    partnerVoiceByRoleKey,
  } = opts;

  const dispatch = useAppDispatch();
  const [profileByEmail, setProfileByEmail] = useState<Record<string, TeamProfile | null>>({});
  const profileByEmailRef = useRef(profileByEmail);
  profileByEmailRef.current = profileByEmail;

  const partnerRolesInScene = useMemo(
    () => buildPartnerRolesInScene(allLines, desiredRoleKeySet),
    [allLines, desiredRoleKeySet],
  );

  const actorsByPartnerRole = useMemo(
    () => buildActorsByPartnerRole(partnerRolesInScene, projectRoles),
    [partnerRolesInScene, projectRoles],
  );

  const assignedActorEmails = useMemo(
    () => collectAssignedActorEmails(actorsByPartnerRole),
    [actorsByPartnerRole],
  );

  useEffect(() => {
    if (!accessToken || assignedActorEmails.length === 0) return;
    const missing = assignedActorEmails.filter((e) => !(e in profileByEmailRef.current));
    if (missing.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await getProfilesBatch(accessToken, missing);
        if (cancelled) return;
        setProfileByEmail((prev) => {
          const next = { ...prev };
          for (const e of missing) {
            const p = rows.find((r) => normalizeActorKey(r.email) === e);
            next[e] = p ?? null;
          }
          return next;
        });
      } catch {
        if (cancelled) return;
        setProfileByEmail((prev) => {
          const next = { ...prev };
          for (const e of missing) next[e] = null;
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, assignedActorEmails]);

  const renderActorSelectPerson = useCallback(
    (option: { value: string } | null) => {
      if (!option?.value.startsWith("p:")) return "—";
      const id = normalizeActorKey(option.value.slice(2));
      const prof = profileByEmail[id];
      const name = actorDisplayName(prof, id);
      const avatar = String(prof?.avatarUrl ?? "").trim() || null;
      return (
        <span className="custom-select__person">
          <MiniAvatar src={avatar} label={name} size={24} title={id} />
          <span className="custom-select__person-name">{name}</span>
        </span>
      );
    },
    [profileByEmail],
  );

  const partnerRoleSelectOptions = useMemo(
    () =>
      partnerRolesInScene.map(({ roleKey, roleTitle }) => {
        const actors = actorsByPartnerRole[roleKey] ?? [];
        return {
          roleKey,
          roleTitle,
          actors,
          options: actors.map((a) => {
            const prof = profileByEmail[a.id];
            return {
              value: `p:${a.id}`,
              label: actorDisplayName(prof, a.label),
            };
          }),
        };
      }),
    [actorsByPartnerRole, partnerRolesInScene, profileByEmail],
  );

  useEffect(() => {
    for (const { roleKey } of partnerRolesInScene) {
      const actors = actorsByPartnerRole[roleKey] ?? [];
      if (actors.length === 0) continue;
      const saved = partnerVoiceByRoleKey?.[roleKey];
      const savedOk =
        saved?.kind === "performer" &&
        actors.some((a) => a.id === normalizeActorKey(saved.performerId));
      if (savedOk) continue;
      dispatch(
        voiceTrainerUiActions.setPartnerVoiceSourceForRole({
          uiKey,
          roleKey,
          source: { kind: "performer", performerId: actors[0]!.id },
        }),
      );
    }
  }, [actorsByPartnerRole, dispatch, partnerRolesInScene, partnerVoiceByRoleKey, uiKey]);

  return {
    partnerRoleSelectOptions,
    renderActorSelectPerson,
  };
}
