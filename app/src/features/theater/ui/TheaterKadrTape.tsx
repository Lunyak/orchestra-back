import { useEffect, useMemo, useState } from "react";
import cn from "classnames";
import { usePlaybook } from "../../playbook";
import {
  deleteKadrFromSceneData,
  findKadrById,
  formatDeleteKadrConfirmMessage,
  readSceneLightKadrs,
} from "../model/light-kadrs";
import {
  applyKadrLook,
  insertKadrInSceneData,
  kadrDisplayTitle,
} from "../model/kadr-store";
import {
  buildTheaterSnapshotScenePatch,
  captureSceneTheaterSnapshot,
} from "../model/kadr-theater-snapshot";
import { buildSceneKadrTapeGroupsFromScenes } from "../model/scene-kadr-tape";
import { captureTheaterViewportDataUrl } from "../model/theater-viewport-capture";
import { migrateSceneLightKadrsFromMarkdown } from "../../spectacle-run/model/migrate-kadrs-from-markdown";
import { resolveLightFaders } from "../../../shared/components/light-console/light-console-data";
import type { TheaterSceneViewModel } from "../model/use-theater-scene";
import "./theater-kadr-tape.css";

export type TheaterKadrTapeProps = {
  vm: TheaterSceneViewModel;
};

/** Лента «сцены → картины» в 3D-редакторе (общий store с прогоном). */
export function TheaterKadrTape({ vm }: TheaterKadrTapeProps) {
  const {
    scenes,
    playbookData,
    setPlaybookData,
    updateScene,
    setCurrentPage,
    saveScenesForLightPlot,
  } = usePlaybook();
  const [activeKadrId, setActiveKadrId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [captureSnapshot, setCaptureSnapshot] = useState(true);

  const currentPage = vm.currentPage;
  const currentScene = vm.currentScene;

  useEffect(() => {
    if (!currentScene) return;
    const migrated = migrateSceneLightKadrsFromMarkdown(currentScene);
    const prev = readSceneLightKadrs(currentScene);
    if (JSON.stringify(prev) === JSON.stringify(migrated)) return;
    updateScene(currentScene.id, { lightKadrs: migrated });
  }, [currentScene, updateScene]);

  const tapeGroups = useMemo(
    () => buildSceneKadrTapeGroupsFromScenes(scenes),
    [scenes],
  );

  useEffect(() => {
    if (!currentScene || !activeKadrId) return;
    const kadrs = readSceneLightKadrs(currentScene).kadrs;
    if (kadrs.some((kadr) => kadr.id === activeKadrId)) return;
    setActiveKadrId(kadrs[0]?.id ?? null);
  }, [activeKadrId, currentScene]);

  const selectScene = (sceneIndex: number) => {
    if (sceneIndex === currentPage) return;
    setCurrentPage(sceneIndex);
    setStatus(`Сцена ${sceneIndex + 1}`);
  };

  const applyKadrId = (sceneIndex: number, kadrId: string) => {
    const targetScene = scenes[sceneIndex];
    if (!targetScene) return;
    const kadr = findKadrById(readSceneLightKadrs(targetScene), kadrId);
    if (!kadr) return;

    if (sceneIndex !== currentPage) {
      setCurrentPage(sceneIndex);
    }

    setActiveKadrId(kadrId);
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
    } else if (look.smokeMachine != null) {
      vm.setSmokeMachineEnabled(look.smokeMachine);
    }

    setStatus(`Картина ${kadr.kadrNo}: look на пульт`);
  };

  const createKadr = () => {
    const scene = currentScene ?? scenes[currentPage];
    if (!scene) return;

    const theaterSnapshot = captureSnapshot
      ? captureSceneTheaterSnapshot(scene)
      : null;
    const coverDataUrl = captureSnapshot ? captureTheaterViewportDataUrl() : null;
    const imageMarkdown = coverDataUrl ? `![](${coverDataUrl})` : undefined;

    const result = insertKadrInSceneData({
      scene,
      afterKadrId: activeKadrId,
      theaterSnapshot,
      imageMarkdown,
    });
    updateScene(scene.id, { lightKadrs: result.nextKadrs });
    setActiveKadrId(result.kadrId);
    void saveScenesForLightPlot({ force: true });
    const snapshotNote = captureSnapshot ? " + мизансцена" : "";
    setStatus(`Картина ${result.kadrNo} создана${snapshotNote}`);
  };

  const deleteActive = () => {
    const scene = currentScene ?? scenes[currentPage];
    if (!scene || !activeKadrId) return;
    const kadr = findKadrById(readSceneLightKadrs(scene), activeKadrId);
    if (!kadr) return;
    if (!window.confirm(formatDeleteKadrConfirmMessage(kadrDisplayTitle(kadr)))) return;
    const nextKadrs = deleteKadrFromSceneData(scene, { id: activeKadrId });
    updateScene(scene.id, { lightKadrs: nextKadrs });
    void saveScenesForLightPlot({ force: true });
    setStatus(`«${kadrDisplayTitle(kadr)}» удалена`);
  };

  if (scenes.length === 0) {
    return (
      <div className="theater-kadr-tape theater-kadr-tape--empty">
        <p>Нет сцен в playbook</p>
      </div>
    );
  }

  return (
    <div className="theater-kadr-tape" aria-label="Сцены и картины">
      <div className="theater-kadr-tape__toolbar">
        <button type="button" className="theater-kadr-tape__btn" onClick={createKadr}>
          + Картина
        </button>
        <button
          type="button"
          className="theater-kadr-tape__btn theater-kadr-tape__btn--danger"
          disabled={!activeKadrId}
          onClick={deleteActive}
        >
          Удалить
        </button>
        <label className="theater-kadr-tape__snapshot-toggle">
          <input
            type="checkbox"
            checked={captureSnapshot}
            onChange={(event) => setCaptureSnapshot(event.target.checked)}
          />
          Снапшот мизансцены
        </label>
      </div>

      <ul className="theater-kadr-tape__groups" role="list" aria-label="Сцены">
        {tapeGroups.map((group) => {
          const sceneActive = group.sceneIndex === currentPage;
          const realKadrs = group.items.filter((entry) => !entry.item.isPlaceholder);

          return (
            <li
              key={group.sceneId}
              className={cn(
                "theater-kadr-tape__group",
                sceneActive && "theater-kadr-tape__group--active",
              )}
            >
              <button
                type="button"
                className={cn(
                  "theater-kadr-tape__scene",
                  sceneActive && "theater-kadr-tape__scene--active",
                )}
                onClick={() => selectScene(group.sceneIndex)}
                aria-current={sceneActive ? "true" : undefined}
              >
                <span className="theater-kadr-tape__scene-no">С{group.sceneOrdinal}</span>
                <span className="theater-kadr-tape__scene-title">{group.sceneTitle}</span>
              </button>

              {realKadrs.length === 0 ? (
                <p className="theater-kadr-tape__empty">Нет картин</p>
              ) : (
                <ul
                  className="theater-kadr-tape__list"
                  role="listbox"
                  aria-label={`Картины сцены ${group.sceneOrdinal}`}
                >
                  {realKadrs.map(({ item }) => {
                    const kadrId = item.kadrId;
                    if (!kadrId) return null;
                    const active = kadrId === activeKadrId && sceneActive;
                    return (
                      <li key={kadrId}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={cn(
                            "theater-kadr-tape__item",
                            active && "theater-kadr-tape__item--active",
                          )}
                          onClick={() => applyKadrId(group.sceneIndex, kadrId)}
                        >
                          <span className="theater-kadr-tape__no">К{item.kadrNo}</span>
                          <span className="theater-kadr-tape__title">{item.headingTitle}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {status ? (
        <p className="theater-kadr-tape__status" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
