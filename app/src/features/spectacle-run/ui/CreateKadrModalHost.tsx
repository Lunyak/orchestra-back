import { useMemo } from "react";
import { usePlaybook } from "../../playbook";
import {
  buildEditKadrDraftFromTapeItem,
  type CreateKadrDraft,
} from "../model/create-kadr-from-draft";
import { useSpectacleRunContext } from "../model/spectacle-run-context";
import { CreateKadrModal } from "./CreateKadrModal";

export function CreateKadrModalHost({ lightChannels }: { lightChannels: string[] }) {
  const run = useSpectacleRunContext();
  const { playbookData } = usePlaybook();
  const scene = run.currentScene;
  const currentItem = run.currentItem;

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
      onClose={run.closeKadrModal}
      onSubmit={run.submitKadrModal}
    />
  );
}
