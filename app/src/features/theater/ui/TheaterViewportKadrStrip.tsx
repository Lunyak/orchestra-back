import { useEffect, useMemo, useState } from "react";
import { usePlaybook } from "../../playbook";
import { findKadrById, readSceneLightKadrs } from "../model/light-kadrs";
import { applyKadrLook } from "../model/kadr-store";
import { buildTheaterSnapshotScenePatch } from "../model/kadr-theater-snapshot";
import { resolveLightFaders } from "../../../shared/components/light-console/light-console-data";
import {
  buildSpectacleKadrTape,
  findTapeIndexForSceneKadr,
} from "../../spectacle-run/model/spectacle-kadr-tape";
import { SpectacleRunKadrStrip } from "../../spectacle-run/ui/SpectacleRunKadrStrip";
import type { TheaterSceneViewModel } from "../model/use-theater-scene";
import "../../spectacle-run/ui/style.css";
import "./theater-viewport-kadr-strip.css";

export type TheaterViewportKadrStripProps = {
  vm: TheaterSceneViewModel;
};

/** Горизонтальная лента сцен/картин поверх 3D viewport. */
export function TheaterViewportKadrStrip({ vm }: TheaterViewportKadrStripProps) {
  const { scenes, playbookData, setPlaybookData, updateScene, setCurrentPage } = usePlaybook();
  const tape = useMemo(() => buildSpectacleKadrTape(scenes), [scenes]);
  const [tapeIndex, setTapeIndex] = useState(0);

  const lightChannels = useMemo(
    () => (Array.isArray(playbookData?.lightChannels) ? playbookData.lightChannels : []),
    [playbookData?.lightChannels],
  );

  useEffect(() => {
    const current = tape[tapeIndex];
    if (current && current.sceneIndex === vm.currentPage) return;
    const nextIndex = findTapeIndexForSceneKadr(tape, vm.currentPage, null);
    if (nextIndex >= 0) setTapeIndex(nextIndex);
  }, [tape, tapeIndex, vm.currentPage]);

  const onSelectIndex = (index: number) => {
    const item = tape[index];
    if (!item) return;

    setTapeIndex(index);

    if (item.sceneIndex !== vm.currentPage) {
      setCurrentPage(item.sceneIndex);
    }

    if (item.isPlaceholder || !item.kadrId) return;

    const targetScene = scenes[item.sceneIndex];
    if (!targetScene) return;
    const kadr = findKadrById(readSceneLightKadrs(targetScene), item.kadrId);
    if (!kadr) return;

    const baseFaders = resolveLightFaders(playbookData?.lightFaders ?? undefined);
    const look = applyKadrLook(kadr, baseFaders);

    setPlaybookData((prev) => {
      const nextPrograms =
        look.programId != null && prev?.lightPrograms
          ? { ...prev.lightPrograms, activeProgramId: look.programId }
          : prev?.lightPrograms;
      return {
        ...(prev ?? {}),
        lightFaders: look.faders,
        ...(nextPrograms ? { lightPrograms: nextPrograms } : {}),
      };
    });

    if (kadr.theaterSnapshot) {
      updateScene(targetScene.id, buildTheaterSnapshotScenePatch(kadr.theaterSnapshot));
      return;
    }

    if (look.smokeMachine != null) {
      vm.setSmokeMachineEnabled(look.smokeMachine);
    }
  };

  if (tape.length === 0) return null;

  return (
    <div className="theater-viewport-kadr-strip">
      <SpectacleRunKadrStrip
        variant="rehearsal"
        projectName={vm.projectName}
        tape={tape}
        tapeIndex={tapeIndex}
        scenes={scenes}
        lightChannels={lightChannels}
        lightFaders={playbookData?.lightFaders ?? null}
        lightPrograms={playbookData?.lightPrograms ?? null}
        onSelectIndex={onSelectIndex}
      />
    </div>
  );
}
