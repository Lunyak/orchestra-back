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
  deleteKadrFromSceneMarkdown,
  findKadrById,
  formatDeleteKadrConfirmMessage,
  readSceneLightKadrs,
  recordKadrToMarkdown,
  scanMarkdownKadrSections,
} from "../../../features/theater/model/light-kadrs";
import { LightConsoleView } from "./LightConsoleView";
import { LightConsoleSettingsModal } from "./LightConsoleSettingsModal";
import { SCRIPT_MARKDOWN_NOTES_TAB_LABEL } from "../show-script/script-markdown-tab-labels";
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
  markdown,
  activeKadrId,
  onActiveKadrIdChange,
  lightChannels,
  lightFaders,
  lightPrograms,
  spotlights,
  onUpdateScene,
  onUpdateMarkdown,
}: LightKadrPanelProps) {
  const [recordMessage, setRecordMessage] = useState<string | null>(null);
  const [programSaveMessage, setProgramSaveMessage] = useState<string | null>(null);
  const [selectedKadrNo, setSelectedKadrNo] = useState<number | null>(null);
  const sections = useMemo(() => scanMarkdownKadrSections(markdown), [markdown]);
  const kadrs = useMemo(() => readSceneLightKadrs(scene), [scene?.lightKadrs, scene?.id]);

  useEffect(() => {
    if (sections.length === 0) {
      setSelectedKadrNo(null);
      return;
    }
    if (activeKadrId) {
      const byId = sections.find((s) => s.id === activeKadrId);
      if (byId) {
        setSelectedKadrNo(byId.kadrNo);
        return;
      }
    }
    setSelectedKadrNo((prev) => {
      if (prev != null && sections.some((s) => s.kadrNo === prev)) return prev;
      return sections[0]?.kadrNo ?? null;
    });
  }, [activeKadrId, sections]);

  const activeSection = useMemo(() => {
    if (sections.length === 0) return null;
    if (selectedKadrNo != null) {
      const byNo = sections.find((s) => s.kadrNo === selectedKadrNo);
      if (byNo) return byNo;
    }
    if (activeKadrId) {
      const byId = sections.find((s) => s.id === activeKadrId);
      if (byId) return byId;
    }
    return sections[0] ?? null;
  }, [activeKadrId, selectedKadrNo, sections]);

  const resolvedActiveId = activeSection?.id ?? activeKadrId;

  const activeKadr = useMemo(() => {
    if (!activeSection) return undefined;
    if (activeSection.id) return findKadrById(kadrs, activeSection.id);
    return kadrs.kadrs.find((k) => k.kadrNo === activeSection.kadrNo);
  }, [activeSection, kadrs.kadrs]);

  const { playbookData } = usePlaybook();
  const liveConsole = useLightConsoleState({
    projectName,
    spotlights: spotlights ?? [],
  });
  const layoutSettings = useLightConsoleLayoutSettings(projectName);

  const recordActiveKadr = () => {
    if (!scene || !activeSection) return;
    const result = recordLightKadrForSection({
      markdown,
      section: activeSection,
      existingKadrId: resolvedActiveId,
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
    onUpdateMarkdown(result.nextMarkdown);
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

  const syncMarkdownLine = () => {
    if (!scene || !activeKadr || !activeSection) return;
    onUpdateMarkdown(
      recordKadrToMarkdown({
        markdown,
        section: activeSection,
        kadr: activeKadr,
        lightChannels,
        lightFaders: liveConsole.faders,
        programs: lightPrograms,
      }),
    );
  };

  const deleteActiveKadr = () => {
    if (!scene || !activeSection) return;
    const confirmMessage = formatDeleteKadrConfirmMessage(activeSection.headingTitle);
    if (!window.confirm(confirmMessage)) return;

    const deletedIndex = sections.findIndex(
      (section) =>
        section.headingStart === activeSection.headingStart &&
        section.kadrNo === activeSection.kadrNo,
    );
    const { markdown: nextMarkdown, lightKadrs: nextKadrs } = deleteKadrFromSceneMarkdown(scene, {
      id: activeSection.id,
      kadrNo: activeSection.kadrNo,
    });

    onUpdateMarkdown(nextMarkdown);
    onUpdateScene({ lightKadrs: nextKadrs });

    const remaining = scanMarkdownKadrSections(nextMarkdown);
    const nextIndex =
      deletedIndex >= 0
        ? Math.min(deletedIndex, Math.max(0, remaining.length - 1))
        : 0;
    const nextSection = remaining[nextIndex] ?? null;
    setSelectedKadrNo(nextSection?.kadrNo ?? null);
    onActiveKadrIdChange?.(nextSection?.id ?? null);
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
            data-primary="true"
            disabled={!scene || !activeSection}
            onClick={recordActiveKadr}
            title={
              activeSection
                ? `Сохранить look в «${activeSection.headingTitle}»`
                : undefined
            }
          >
            {activeSection
              ? `Записать в картину ${activeSection.kadrNo}`
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
            className="light-kadr-panel__action"
            disabled={!activeKadr || !activeSection}
            onClick={syncMarkdownLine}
          >
            Обновить строку в тексте
          </button>
          <button
            type="button"
            className="light-kadr-panel__action light-kadr-panel__action--danger"
            disabled={!scene || !activeSection}
            onClick={deleteActiveKadr}
            title={
              activeSection
                ? `Удалить «${activeSection.headingTitle}» и перенумеровать остальные`
                : undefined
            }
          >
            Удалить картину
          </button>
        </div>
      </div>

      {sections.length > 0 ? (
        <>
          <div className="light-kadr-panel__target" aria-live="polite">
            <span className="light-kadr-panel__target-label">Запись идёт в:</span>
            <strong className="light-kadr-panel__target-title">
              {activeSection?.headingTitle ?? `Картина ${activeSection?.kadrNo ?? "?"}`}
            </strong>
            {activeSection?.id ? (
              <span className="light-kadr-panel__target-id" title="Скрытый якорь в тексте">
                lk:{activeSection.id.slice(0, 8)}…
              </span>
            ) : (
              <span className="light-kadr-panel__target-id light-kadr-panel__target-id--new">
                якорь появится после записи
              </span>
            )}
          </div>
          <div className="light-kadr-panel__strip" role="tablist" aria-label="Картины сцены">
            {sections.map((section) => {
              const kadr =
                section.id != null
                  ? findKadrById(kadrs, section.id)
                  : kadrs.kadrs.find((k) => k.kadrNo === section.kadrNo);
              const color = kadrProgramColor(kadr, lightChannels);
              const active = activeSection?.kadrNo === section.kadrNo;
              return (
                <button
                  key={`${section.kadrNo}:${section.id ?? section.headingStart}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className="light-kadr-panel__chip"
                  data-active={active}
                  onClick={() => {
                    setSelectedKadrNo(section.kadrNo);
                    onActiveKadrIdChange?.(section.id ?? null);
                  }}
                  title={`Выбрать «${section.headingTitle}» для записи света`}
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
                    <span className="light-kadr-panel__chip-no">Картина {section.kadrNo}</span>
                    {kadr?.programId ? (
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
          Нет <code>### Картина N</code> в тексте сцены — добавьте на вкладке «
          {SCRIPT_MARKDOWN_NOTES_TAB_LABEL}» / «Текст».
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
