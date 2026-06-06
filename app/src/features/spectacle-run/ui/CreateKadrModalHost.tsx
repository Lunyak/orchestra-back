import { useMemo } from "react";
import { useScene } from "../../scene";
import {
  buildEditKadrDraftFromTapeItem,
  type CreateKadrDraft,
} from "../model/create-kadr-from-draft";
import { useSpectacleRunContext } from "../model/spectacle-run-context";
import { CreateKadrModal } from "./CreateKadrModal";

export function CreateKadrModalHost({ lightChannels }: { lightChannels: string[] }) {
  const run = useSpectacleRunContext();
  const { sceneData } = useScene();
  const step = run.currentStep;
  const currentItem = run.currentItem;

  const editDraft = useMemo((): CreateKadrDraft | null => {
    if (run.kadrModalMode !== "edit" || !step || !currentItem) return null;
    return buildEditKadrDraftFromTapeItem({
      step,
      item: currentItem,
      lightPrograms: run.lightPrograms,
    });
  }, [currentItem, run.kadrModalMode, run.lightPrograms, step]);

  if (!step) return null;

  const playlist = (sceneData?.playlist ?? []).map((track) => ({
    id: track.id,
    title: track.title ?? "",
  }));
  const sounds = (sceneData?.sounds ?? []).map((sound) => ({
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
      spotlights={step.theaterSpotlights ?? []}
      liveConsole={run.liveConsole}
      playlist={playlist}
      sounds={sounds}
      videos={run.videos}
      holdImages={run.holdImages}
      projector={sceneData?.projector ?? null}
      onClose={run.closeKadrModal}
      onSubmit={run.submitKadrModal}
    />
  );
}
