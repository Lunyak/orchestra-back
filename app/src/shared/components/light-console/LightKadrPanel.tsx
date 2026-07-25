import { useEffect, useMemo, useState } from "react";
import { usePlaybook } from "../../../features/playbook";
import type {
  PlaybookLightFadersDataV1,
  PlaybookLightProgramsDataV1,
} from "../../../features/playbook/model/playbook-slice";
import type { ScriptScene } from "../../types/script";
import { parseLightChannel, resolveLightColor } from "../show-script/utils/lightTokens";
import {
  applyKadrToFaders,
  deleteKadrFromSceneData,
  findKadrById,
  formatDeleteKadrConfirmMessage,
  readSceneLightKadrs,
} from "../../../features/theater/model/light-kadrs";
import {
  insertKadrInSceneData,
  kadrDisplayTitle,
} from "../../../features/theater/model/kadr-store";
import { LightConsoleView } from "./LightConsoleView";
import { LightConsoleSettingsModal } from "./LightConsoleSettingsModal";
import { recordLightKadrForSection } from "./light-kadr-record";
import { useLightConsoleLayoutSettings } from "./useLightConsoleLayoutSettings";
import { useLightConsoleState } from "./useLightConsoleState";

export type LightKadrPanelProps = {
  projectName: string;
  scene: ScriptScene | null | undefined;
  markdown: string;
  activeKadrId: string | null;
  onActiveKadrIdChange?: (id: string | null) => void;
  lightChannels: string[];
  lightFaders: PlaybookLightFadersDataV1 | null;
  lightPrograms: PlaybookLightProgramsDataV1 | null;
  spotlights?: ScriptScene["theaterSpotlights"];
  onUpdateScene: (changes: Partial<ScriptScene>) => void;
  onUpdateMarkdown: (nextMarkdown: string) => void;
};

function kadrProgramColor(
  kadr: ReturnType<typeof findKadrById>,
  lightChannels: string[],
): string | null {
  if (!kadr || kadr.blackout || kadr.programId <= 0) return "var(--color-surface-1)";
  const raw = lightChannels[kadr.programId - 1];
  if (!raw) return null;
  const parsed = parseLightChannel(raw);
  return resolveLightColor(parsed.label, parsed.color);
}

export function LightKadrPanel({
  projectName,
  scene,
  activeKadrId,
  onActiveKadrIdChange,
  lightChannels,
  lightPrograms,
  spotlights,
  onUpdateScene,
}: LightKadrPanelProps) {
  const [recordMessage, setRecordMessage] = useState<string | null>(null);
  const [programSaveMessage, setProgramSaveMessage] = useState<string | null>(null);
  const kadrs = useMemo(() => readSceneLightKadrs(scene), [scene?.lightKadrs, scene?.id]);
  const sortedKadrs = useMemo(
    () => [...kadrs.kadrs].sort((a, b) => a.kadrNo - b.kadrNo || a.id.localeCompare(b.id)),
    [kadrs.kadrs],
  );

  useEffect(() => {
    if (sortedKadrs.length === 0) {
      onActiveKadrIdChange?.(null);
      return;
    }
    if (activeKadrId && sortedKadrs.some((kadr) => kadr.id === activeKadrId)) return;
    onActiveKadrIdChange?.(sortedKadrs[0]?.id ?? null);
  }, [activeKadrId, onActiveKadrIdChange, sortedKadrs]);

  const activeKadr = useMemo(
    () => (activeKadrId ? findKadrById(kadrs, activeKadrId) : undefined),
    [activeKadrId, kadrs],
  );

  const { playbookData } = usePlaybook();
  const liveConsole = useLightConsoleState({
    projectName,
    spotlights: spotlights ?? [],
  });
  const layoutSettings = useLightConsoleLayoutSettings(projectName);

  const createKadr = () => {
    if (!scene) return;
    const result = insertKadrInSceneData({
      scene,
      afterKadrId: activeKadrId,
    });
    onUpdateScene({ lightKadrs: result.nextKadrs });
    onActiveKadrIdChange?.(result.kadrId);
    setRecordMessage(`Картина ${result.kadrNo} создана`);
  };

  const recordActiveKadr = () => {
    if (!scene || !activeKadrId) return;
    const result = recordLightKadrForSection({
      kadrId: activeKadrId,
      kadrNo: activeKadr?.kadrNo,
      title: activeKadr ? kadrDisplayTitle(activeKadr) : undefined,
      kadrs,
      lightChannels,
      lightFaders: liveConsole.faders,
      lightPrograms,
      programId: liveConsole.programs.activeProgramId ?? 1,
      spotlights: spotlights ?? [],
      liveConsoleChannel: liveConsole.selectedLightSlot,
      lightChannelRoles:
        playbookData?.lightChannelRoles && playbookData.lightChannelRoles.v === 1
          ? playbookData.lightChannelRoles
          : null,
    });
    if (!result) return;
    onUpdateScene({ lightKadrs: result.nextKadrs });
    onActiveKadrIdChange?.(result.kadrId);
    setRecordMessage(result.summary);
  };

  const applyActiveKadr = () => {
    if (!activeKadr) return;
    const nextFaders = applyKadrToFaders(activeKadr, liveConsole.faders);
    liveConsole.persistFaders(nextFaders);
    if (activeKadr.programId > 0) {
      liveConsole.persistPrograms({
        ...(lightPrograms ?? liveConsole.programs),
        activeProgramId: activeKadr.programId,
      });
      const program = liveConsole.programs.programs.find((p) => p.id === activeKadr.programId);
      if (program) liveConsole.applyProgram(program);
    }
  };

  const deleteActiveKadr = () => {
    if (!scene || !activeKadr) return;
    const confirmMessage = formatDeleteKadrConfirmMessage(kadrDisplayTitle(activeKadr));
    if (!window.confirm(confirmMessage)) return;

    const deletedIndex = sortedKadrs.findIndex((kadr) => kadr.id === activeKadr.id);
    const nextKadrs = deleteKadrFromSceneData(scene, { id: activeKadr.id });
    onUpdateScene({ lightKadrs: nextKadrs });

    const remaining = nextKadrs.kadrs;
    const nextIndex =
      deletedIndex >= 0
        ? Math.min(deletedIndex, Math.max(0, remaining.length - 1))
        : 0;
    const nextKadr = remaining[nextIndex] ?? null;
    onActiveKadrIdChange?.(nextKadr?.id ?? null);
    setRecordMessage(
      remaining.length > 0
        ? `Картина удалена · осталось ${remaining.length}`
        : "Картина удалена",
    );
  };

  return (
    <div className="light-kadr-panel">
      <div className="light-kadr-panel__header">
        <div>
          <div className="light-kadr-panel__title">Картины сцены</div>
          <div className="light-kadr-panel__hint">
            П1–П8 = заливка · фейдеры = софиты · одна кнопка сохраняет всё в картину
          </div>
        </div>
        <div className="light-kadr-panel__actions">
          <button
            type="button"
            className="light-kadr-panel__action"
            disabled={!scene}
            onClick={createKadr}
          >
            + Картина
          </button>
          <button
            type="button"
            className="light-kadr-panel__action"
            data-primary="true"
            disabled={!scene || !activeKadr}
            onClick={recordActiveKadr}
            title={
              activeKadr
                ? `Сохранить look в «${kadrDisplayTitle(activeKadr)}»`
                : undefined
            }
          >
            {activeKadr
              ? `Записать в картину ${activeKadr.kadrNo}`
              : "Записать в картину"}
          </button>
          <button
            type="button"
            className="light-kadr-panel__action"
            disabled={!activeKadr}
            onClick={applyActiveKadr}
          >
            Применить на пульт
          </button>
          <button
            type="button"
            className="light-kadr-panel__action light-kadr-panel__action--danger"
            disabled={!scene || !activeKadr}
            onClick={deleteActiveKadr}
            title={
              activeKadr
                ? `Удалить «${kadrDisplayTitle(activeKadr)}» и перенумеровать остальные`
                : undefined
            }
          >
            Удалить картину
          </button>
        </div>
      </div>

      {sortedKadrs.length > 0 ? (
        <>
          <div className="light-kadr-panel__target" aria-live="polite">
            <span className="light-kadr-panel__target-label">Запись идёт в:</span>
            <strong className="light-kadr-panel__target-title">
              {activeKadr ? kadrDisplayTitle(activeKadr) : "—"}
            </strong>
          </div>
          <div className="light-kadr-panel__strip" role="tablist" aria-label="Картины сцены">
            {sortedKadrs.map((kadr) => {
              const color = kadrProgramColor(kadr, lightChannels);
              const active = activeKadrId === kadr.id;
              return (
                <button
                  key={kadr.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className="light-kadr-panel__chip"
                  data-active={active}
                  onClick={() => onActiveKadrIdChange?.(kadr.id)}
                  title={`Выбрать «${kadrDisplayTitle(kadr)}» для записи света`}
                >
                  <span
                    className="light-kadr-panel__chip-dot"
                    style={
                      color
                        ? ({ "--light-chip-dot-color": color } as React.CSSProperties)
                        : undefined
                    }
                  />
                  <span className="light-kadr-panel__chip-text">
                    <span className="light-kadr-panel__chip-no">Картина {kadr.kadrNo}</span>
                    {kadr.programId ? (
                      <span className="light-kadr-panel__chip-meta">П{kadr.programId}</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="light-kadr-panel__empty">
          Нет картин — нажмите «+ Картина» или создайте в прогоне.
        </p>
      )}

      {recordMessage ? (
        <p className="light-kadr-panel__record-msg" role="status">
          {recordMessage}
        </p>
      ) : null}

      {activeKadr?.updatedAt ? (
        <div className="light-kadr-panel__meta">
          Последняя запись в эту картину: {new Date(activeKadr.updatedAt).toLocaleString()}
        </div>
      ) : null}

      {programSaveMessage ? (
        <p className="light-kadr-panel__record-msg light-kadr-panel__record-msg--program" role="status">
          {programSaveMessage}
        </p>
      ) : null}

      <LightConsoleView
        mode="live"
        lightChannels={liveConsole.lightChannels}
        selectedLightSlot={liveConsole.selectedLightSlot}
        faders={liveConsole.faders}
        programs={liveConsole.programs}
        spotlights={spotlights ?? []}
        consoleChannel={liveConsole.selectedLightSlot}
        channelColumns={layoutSettings.layout.channelColumns}
        onSelectChannel={liveConsole.selectChannel}
        onSelectProgram={liveConsole.selectProgram}
        onOpenSettings={layoutSettings.openSettings}
        onPatchFader={liveConsole.patchFader}
        onSaveActiveProgram={() => {
          liveConsole.saveProgramSnapshot();
          const pid = liveConsole.programs.activeProgramId ?? 1;
          const label =
            liveConsole.programs.programs.find((p) => p.id === pid)?.label?.trim() ?? "";
          setProgramSaveMessage(
            `Программа П${pid}${label ? ` «${label}»` : ""} сохранена — все фейдеры на пульте`,
          );
        }}
      />
      <LightConsoleSettingsModal
        isOpen={layoutSettings.settingsOpen}
        layout={layoutSettings.layout}
        onClose={layoutSettings.closeSettings}
        onApply={layoutSettings.applyLayout}
      />
    </div>
  );
}
