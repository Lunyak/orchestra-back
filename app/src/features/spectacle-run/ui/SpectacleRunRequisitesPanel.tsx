import { useMemo } from "react";
import { useProject } from "../../project/model/project-context";
import { useProjectMembersQuery } from "../../project/api/project-api";
import { usePlaybook } from "../../playbook";
import { mergeTaskAssigneeMembers } from "../../project-tasks/model/merge-task-assignee-members";
import { useMyTroupeQuery } from "../../troupe/api/troupe-api";
import { memberLabel } from "../../troupe/model/troupe-page-utils";
import {
  findKadrById,
  readSceneLightKadrs,
  upsertKadrInScene,
} from "../../theater/model/light-kadrs";
import { readSceneTheaterModels } from "../../theater/model/theater-scene-models";
import { useAppSelector } from "../../../shared/store/hooks";
import type {
  SceneLightKadrRequisiteActionV1,
  SceneLightKadrRequisiteCueV1,
  ScriptRequisite,
  ScriptScene,
} from "../../../shared/types/script";
import type { SpectacleTapeItem } from "../model/spectacle-kadr-tape";
import { CreateKadrRequisitesSection } from "./CreateKadrRequisitesSection";

export function SpectacleRunRequisitesPanel({
  scene,
  tapeItem,
}: {
  scene: ScriptScene | null;
  tapeItem: SpectacleTapeItem | null;
}) {
  const { updateScene } = usePlaybook();
  const { projectName } = useProject();
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const projectSlug = projectName ?? "";

  const { data: troupeData } = useMyTroupeQuery(
    { project: projectSlug },
    { skip: !projectSlug },
  );
  const { data: projectMembersData } = useProjectMembersQuery(projectSlug, {
    skip: !accessToken || !projectSlug,
  });

  const assigneeOptions = useMemo(() => {
    const members = mergeTaskAssigneeMembers(troupeData, projectMembersData);
    return members.map((member) => {
      const label = memberLabel(member);
      return {
        value: member.email,
        label,
        searchText: [label, member.email].filter(Boolean).join(" "),
        person: member,
      };
    });
  }, [projectMembersData, troupeData]);

  const theaterModels = useMemo(
    () => (scene ? readSceneTheaterModels(scene) : []),
    [scene],
  );

  const kadrs = useMemo(
    () => readSceneLightKadrs(scene),
    [scene?.id, scene?.lightKadrs],
  );

  const activeKadr = useMemo(() => {
    if (!tapeItem || tapeItem.isPlaceholder) return null;
    if (tapeItem.kadrId) return findKadrById(kadrs, tapeItem.kadrId) ?? null;
    return kadrs.kadrs.find((item) => item.kadrNo === tapeItem.kadrNo) ?? null;
  }, [kadrs, tapeItem]);

  const draftCues = activeKadr?.requisites ?? [];

  if (!scene || !activeKadr) return null;

  const persistKadrCues = (nextCues: SceneLightKadrRequisiteCueV1[]) => {
    const nextKadr =
      nextCues.length > 0
        ? { ...activeKadr, requisites: nextCues }
        : (() => {
            const { requisites: _removed, ...rest } = activeKadr;
            return rest;
          })();
    const nextKadrs = upsertKadrInScene({ kadrs, kadr: nextKadr });
    updateScene(scene.id, { lightKadrs: nextKadrs });
  };

  const handleSceneRequisitesChange = (next: ScriptRequisite[]) => {
    const ids = new Set(next.map((item) => item.id));
    updateScene(scene.id, { requisites: next });
    const pruned = draftCues.filter((cue) => ids.has(cue.requisiteId));
    if (pruned.length !== draftCues.length) {
      persistKadrCues(pruned);
    }
  };

  const toggleCue = (requisiteId: number) => {
    const exists = draftCues.some((cue) => cue.requisiteId === requisiteId);
    if (exists) {
      persistKadrCues(draftCues.filter((cue) => cue.requisiteId !== requisiteId));
      return;
    }
    persistKadrCues([...draftCues, { requisiteId, action: "setup" }]);
  };

  const setCueAction = (
    requisiteId: number,
    action: SceneLightKadrRequisiteActionV1,
  ) => {
    persistKadrCues(
      draftCues.map((cue) =>
        cue.requisiteId === requisiteId ? { ...cue, action } : cue,
      ),
    );
  };

  return (
    <section
      className="spectacle-run-requisites-panel"
      aria-label="Реквизит картины"
    >
      <CreateKadrRequisitesSection
        sceneRequisites={scene.requisites ?? []}
        onSceneRequisitesChange={handleSceneRequisitesChange}
        theaterModels={theaterModels}
        draftCues={draftCues}
        onToggleCue={toggleCue}
        onCueActionChange={setCueAction}
        assigneeOptions={assigneeOptions}
        accessToken={accessToken}
        projectSlug={projectSlug}
      />
    </section>
  );
}
