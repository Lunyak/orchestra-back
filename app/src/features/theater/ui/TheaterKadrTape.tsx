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
import { migrateSceneLightKadrsFromMarkdown } from "../../spectacle-run/model/migrate-kadrs-from-markdown";
import { resolveLightFaders } from "../../../shared/components/light-console/light-console-data";
import type { TheaterSceneViewModel } from "../model/use-theater-scene";
import "./theater-kadr-tape.css";

export type TheaterKadrTapeProps = {
  vm: TheaterSceneViewModel;
};

/** Лента картин текущей сцены в 3D-редакторе: выбор → look на пульт + 3D. */
export function TheaterKadrTape({ vm }: TheaterKadrTapeProps) {
  const { playbookData, setPlaybookData, updateScene, saveScenesForLightPlot } = usePlaybook();
  const scene = vm.currentScene;
  const [activeKadrId, setActiveKadrId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!scene) return;
    const migrated = migrateSceneLightKadrsFromMarkdown(scene);
    const prev = readSceneLightKadrs(scene);
    if (JSON.stringify(prev) === JSON.stringify(migrated)) return;
    updateScene(scene.id, { lightKadrs: migrated });
  }, [scene?.id, scene?.markdown, scene?.lightKadrs, updateScene]);

  const kadrs = useMemo(() => {
    if (!scene) return [];
    return [...readSceneLightKadrs(scene).kadrs].sort(
      (a, b) => a.kadrNo - b.kadrNo || a.id.localeCompare(b.id),
    );
  }, [scene?.id, scene?.lightKadrs]);

  useEffect(() => {
    if (kadrs.length === 0) {
      setActiveKadrId(null);
      return;
    }
    setActiveKadrId((prev) => {
      if (prev && kadrs.some((kadr) => kadr.id === prev)) return prev;
      return kadrs[0]?.id ?? null;
    });
  }, [kadrs]);

  const applyKadrId = (kadrId: string) => {
    if (!scene) return;
    const kadr = findKadrById(readSceneLightKadrs(scene), kadrId);
    if (!kadr) return;

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

    if (look.smokeMachine != null) {
      vm.setSmokeMachineEnabled(look.smokeMachine);
    }

    setStatus(`Картина ${kadr.kadrNo}: look на пульт`);
  };

  const createKadr = () => {
    if (!scene) return;
    const result = insertKadrInSceneData({
      scene,
      afterKadrId: activeKadrId,
    });
    updateScene(scene.id, { lightKadrs: result.nextKadrs });
    setActiveKadrId(result.kadrId);
    void saveScenesForLightPlot({ force: true });
    setStatus(`Картина ${result.kadrNo} создана`);
  };

  const deleteActive = () => {
    if (!scene || !activeKadrId) return;
    const kadr = findKadrById(readSceneLightKadrs(scene), activeKadrId);
    if (!kadr) return;
    if (!window.confirm(formatDeleteKadrConfirmMessage(kadrDisplayTitle(kadr)))) return;
    const nextKadrs = deleteKadrFromSceneData(scene, { id: activeKadrId });
    updateScene(scene.id, { lightKadrs: nextKadrs });
    void saveScenesForLightPlot({ force: true });
    setStatus(`«${kadrDisplayTitle(kadr)}» удалена`);
  };

  if (!scene) {
    return (
      <div className="theater-kadr-tape theater-kadr-tape--empty">
        <p>Нет активной сцены</p>
      </div>
    );
  }

  return (
    <div className="theater-kadr-tape" aria-label="Картины сцены">
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
      </div>

      {kadrs.length === 0 ? (
        <p className="theater-kadr-tape__empty">Нет картин — создайте первую</p>
      ) : (
        <ul className="theater-kadr-tape__list" role="listbox" aria-label="Картины">
          {kadrs.map((kadr) => {
            const active = kadr.id === activeKadrId;
            return (
              <li key={kadr.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn("theater-kadr-tape__item", active && "theater-kadr-tape__item--active")}
                  onClick={() => applyKadrId(kadr.id)}
                >
                  <span className="theater-kadr-tape__no">К{kadr.kadrNo}</span>
                  <span className="theater-kadr-tape__title">{kadrDisplayTitle(kadr)}</span>
                  {kadr.blackout || kadr.programId <= 0 ? (
                    <span className="theater-kadr-tape__meta">блекаут</span>
                  ) : (
                    <span className="theater-kadr-tape__meta">П{kadr.programId}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {status ? (
        <p className="theater-kadr-tape__status" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
