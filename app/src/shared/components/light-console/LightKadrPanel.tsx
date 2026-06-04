import { useEffect, useMemo, useState } from "react";
import { useScene } from "../../../features/scene";
import type {
  SceneLightFadersDataV1,
  SceneLightProgramsDataV1,
} from "../../../features/scene/model/scene-slice";
import type { ScriptStep } from "../../types/script";
import { parseLightChannel, resolveLightColor } from "../show-script/utils/lightTokens";
import {
  applyKadrToFaders,
  findKadrById,
  readStepLightKadrs,
  recordKadrToMarkdown,
  scanMarkdownKadrSections,
} from "../../../features/theater/model/light-kadrs";
import { LightConsoleView } from "./LightConsoleView";
import { SCRIPT_MARKDOWN_NOTES_TAB_LABEL } from "../show-script/script-markdown-tab-labels";
import { LightWorkflowGuide } from "./LightWorkflowGuide";
import { recordLightKadrForSection } from "./light-kadr-record";
import { useLightConsoleState } from "./useLightConsoleState";

export type LightKadrPanelProps = {
  projectName: string;
  step: ScriptStep | null | undefined;
  markdown: string;
  activeKadrId: string | null;
  onActiveKadrIdChange?: (id: string | null) => void;
  lightChannels: string[];
  lightFaders: SceneLightFadersDataV1 | null;
  lightPrograms: SceneLightProgramsDataV1 | null;
  spotlights?: ScriptStep["theaterSpotlights"];
  onUpdateStep: (changes: Partial<ScriptStep>) => void;
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
  step,
  markdown,
  activeKadrId,
  onActiveKadrIdChange,
  lightChannels,
  lightFaders,
  lightPrograms,
  spotlights,
  onUpdateStep,
  onUpdateMarkdown,
}: LightKadrPanelProps) {
  const [recordMessage, setRecordMessage] = useState<string | null>(null);
  const [programSaveMessage, setProgramSaveMessage] = useState<string | null>(null);
  const [selectedKadrNo, setSelectedKadrNo] = useState<number | null>(null);
  const sections = useMemo(() => scanMarkdownKadrSections(markdown), [markdown]);
  const kadrs = useMemo(() => readStepLightKadrs(step), [step?.lightKadrNo, step?.id]);

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

  const { sceneData } = useScene();
  const liveConsole = useLightConsoleState({
    projectName,
    spotlights: spotlights ?? [],
  });

  const recordActiveKadr = () => {
    if (!step || !activeSection) return;
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
        sceneData?.lightChannelRoles && sceneData.lightChannelRoles.v === 1
          ? sceneData.lightChannelRoles
          : null,
    });
    if (!result) return;
    onUpdateStep({ lightKadrs: result.nextKadrs });
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
    if (!step || !activeKadr || !activeSection) return;
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

  return (
    <div className="light-kadr-panel">
      <div className="light-kadr-panel__header">
        <div>
          <div className="light-kadr-panel__title">Картины шага</div>
          <div className="light-kadr-panel__hint">
            П1–П8 = заливка · фейдеры = софиты · одна кнопка сохраняет всё в картину
          </div>
        </div>
        <div className="light-kadr-panel__actions">
          <button
            type="button"
            className="light-kadr-panel__action"
            data-primary="true"
            disabled={!step || !activeSection}
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
          <div className="light-kadr-panel__strip" role="tablist" aria-label="Картины шага">
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
                    style={{ backgroundColor: color ?? undefined }}
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
          <p className="light-kadr-panel__strip-hint">
            Нажмите нужную картину, затем настройте пульт и «Записать в картину N». В тексте связь
            через строку <code>- **Свет**:</code> под этим заголовком.
          </p>
        </>
      ) : (
        <p className="light-kadr-panel__empty">
          Нет <code>### Картина N</code> в тексте шага — добавьте на вкладке «
          {SCRIPT_MARKDOWN_NOTES_TAB_LABEL}» / «Текст».
        </p>
      )}

      <LightWorkflowGuide />
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
        onFaderCountChange={liveConsole.setFaderCount}
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
    </div>
  );
}
