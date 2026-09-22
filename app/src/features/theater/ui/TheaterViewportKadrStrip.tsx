import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { usePlaybook } from "../../playbook";
import { findKadrById, readSceneLightKadrs } from "../model/light-kadrs";
import { applyKadrLook } from "../model/kadr-store";
import { buildTheaterSnapshotScenePatch } from "../model/kadr-theater-snapshot";
import { clampKadrStripHeight } from "../model/theater-view-prefs-storage";
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
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);

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

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = {
      startY: event.clientY,
      startHeight: vm.kadrStripHeight,
    };
  };

  const handleResizePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = resizeRef.current;
    if (!drag) return;
    const delta = drag.startY - event.clientY;
    vm.setKadrStripHeight(clampKadrStripHeight(drag.startHeight + delta));
  };

  const handleResizePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!resizeRef.current) return;
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  if (tape.length === 0) return null;

  return (
    <div className="theater-viewport-kadr-strip">
      <button
        type="button"
        className="theater-viewport-kadr-strip-resize"
        aria-label="Изменить высоту ленты сцен"
        title="Потянуть для изменения высоты"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerCancel={handleResizePointerUp}
      />
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
