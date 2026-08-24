import { useMemo } from "react";
import { useProjectMembersQuery } from "../../project/api/project-api";
import { usePlaybook } from "../../playbook";
import { mergeTaskAssigneeMembers } from "../../project-tasks/model/merge-task-assignee-members";
import { useMyTroupeQuery } from "../../troupe/api/troupe-api";
import { memberLabel } from "../../troupe/model/troupe-page-utils";
import { useAppSelector } from "../../../shared/store/hooks";
import type { ScriptRequisite } from "../../../shared/types/script";
import {
  buildEditKadrDraftFromTapeItem,
  type CreateKadrDraft,
} from "../model/create-kadr-from-draft";
import { useSpectacleRunContext } from "../model/spectacle-run-context";
import { CreateKadrModal } from "./CreateKadrModal";

export function CreateKadrModalHost({ lightChannels }: { lightChannels: string[] }) {
  const run = useSpectacleRunContext();
  const { playbookData, updateScene } = usePlaybook();
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const scene = run.currentScene;
  const currentItem = run.currentItem;
  const projectSlug = run.projectName;

  const { data: troupeData } = useMyTroupeQuery(
    {},
    { skip: !accessToken },
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

  const editDraft = useMemo((): CreateKadrDraft | null => {
    if (run.kadrModalMode !== "edit" || !scene || !currentItem) return null;
    return buildEditKadrDraftFromTapeItem({
      scene,
      item: currentItem,
      lightPrograms: run.lightPrograms,
    });
  }, [currentItem, run.kadrModalMode, run.lightPrograms, scene]);

  if (!scene) return null;

  const playlist = (playbookData?.playlist ?? []).map((track) => ({
    id: track.id,
    title: track.title ?? "",
  }));
  const sounds = (playbookData?.sounds ?? []).map((sound) => ({
    id: sound.id,
    title: sound.title ?? "",
  }));

  const editKadrNo = currentItem?.isPlaceholder ? null : currentItem?.kadrNo ?? null;

  const handleSceneRequisitesChange = (next: ScriptRequisite[]) => {
    updateScene(scene.id, { requisites: next });
  };

  return (
    <CreateKadrModal
      isOpen={run.kadrModalOpen}
      mode={run.kadrModalMode}
      nextKadrNo={run.nextKadrNo}
      editKadrNo={editKadrNo}
      initialDraft={editDraft}
      projectName={run.projectName}
      lightChannels={lightChannels}
      lightFaders={run.lightFaders}
      lightPrograms={run.lightPrograms}
      lightChannelRoles={run.lightChannelRoles}
      spotlights={scene.theaterSpotlights ?? []}
      liveConsole={run.liveConsole}
      playlist={playlist}
      sounds={sounds}
      videos={run.videos}
      holdImages={run.holdImages}
      projector={playbookData?.projector ?? null}
      sceneRequisites={scene.requisites ?? []}
      assigneeOptions={assigneeOptions}
      accessToken={accessToken}
      onSceneRequisitesChange={handleSceneRequisitesChange}
      onClose={run.closeKadrModal}
      onSubmit={run.submitKadrModal}
    />
  );
}
