import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { showScriptMarkdownActions } from "../../show-script-markdown/model/show-script-markdown-slice";
import { useScene } from "../../scene";
import type { SceneLightChannelRolesV1 } from "../../scene/model/scene-slice";
import {
  applyKadrToFaders,
  findKadrById,
  readStepLightKadrs,
  resolveKadrSectionForTapeItem,
} from "../../theater/model/light-kadrs";
import { parseSoundLineInSection } from "../../theater/model/kadr-sound";
import { applyKadrSound } from "./apply-kadr-sound";
import { recordSoundKadrForSection } from "./record-kadr-sound";
import { getPlaylistPlaybackSnapshot } from "../../scene/model/scene-playback-bridge";
import { recordLightKadrForSection } from "../../../shared/components/light-console/light-kadr-record";
import { formatChannelShort } from "../../../shared/components/light-console/light-console-labels";
import {
  appendLightChannel,
  patchSceneDataForLightChannelCount,
  removeLastLightChannel,
} from "../../../shared/components/light-console/light-channels-mutate";
import { resolveLightFaders, resolveLightPrograms } from "../../../shared/components/light-console/light-console-data";
import { useLightConsoleState } from "../../../shared/components/light-console/useLightConsoleState";
import type { ScriptStep } from "../../../shared/types/script";
import {
  appendKadrToStep,
  buildSpectacleKadrTape,
  findTapeIndexForStepKadr,
  isLastTapeItemInStep,
  nextKadrNumberForStep,
  type SpectacleTapeItem,
} from "./spectacle-kadr-tape";

export type UseSpectacleRunArgs = {
  projectName: string;
  steps: ScriptStep[];
  lightChannels: string[];
};

export function useSpectacleRun({ projectName, steps, lightChannels }: UseSpectacleRunArgs) {
  const dispatch = useAppDispatch();
  const { sceneData, setSceneData, updateStep, setCurrentPage, currentPage } = useScene();
  const tape = useMemo(() => buildSpectacleKadrTape(steps), [steps]);
  const [tapeIndex, setTapeIndex] = useState(0);
  const textHidden = useAppSelector((state) => state.scriptUi.spectacleRunTextHidden);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const applyingTapeRef = useRef(false);
  const liveSaveTimerRef = useRef<number | null>(null);
  const tapeIndexRef = useRef(0);
  const tapeInitRef = useRef(false);
  const pendingTapeKadrIdRef = useRef<string | null>(null);
  const skipTapeApplyEffectRef = useRef(false);
  /** Первый заход в репетицию: не затирать общий пульт снимком картины (правки из 3D театра). */
  const skipKadrFadersOnceRef = useRef(true);
  const stepsRef = useRef(steps);
  const tapeRef = useRef(tape);
  stepsRef.current = steps;
  tapeRef.current = tape;

  const lightFaders = useMemo(
    () => resolveLightFaders(sceneData?.lightFaders ?? undefined),
    [sceneData?.lightFaders],
  );
  const lightPrograms = useMemo(
    () => resolveLightPrograms(sceneData?.lightPrograms),
    [sceneData?.lightPrograms],
  );

  const clampedIndex = tape.length === 0 ? 0 : Math.min(tapeIndex, tape.length - 1);
  const currentItem = tape[clampedIndex] ?? null;
  const currentStep = currentItem ? steps[currentItem.stepIndex] : null;

  tapeIndexRef.current = clampedIndex;

  const liveConsole = useLightConsoleState({
    projectName,
    spotlights: currentStep?.theaterSpotlights ?? [],
  });

  const appendLightChannelSlot = useCallback(() => {
    const next = appendLightChannel(lightChannels);
    if (next.length === lightChannels.length) return;
    dispatch(
      showScriptMarkdownActions.setLightChannels({
        projectSlug: projectName,
        sceneName: "script",
        lightChannels: next,
      }),
    );
    setSceneData((prev) => ({
      ...(prev ?? {}),
      ...patchSceneDataForLightChannelCount(prev, next, lightChannels.length),
    }));
    liveConsole.selectChannel(next.length);
    setLiveStatus(
      `Добавлен ${formatChannelShort(next.length)} · каналов на пульте: ${next.length}`,
    );
  }, [dispatch, lightChannels, liveConsole, projectName, setSceneData]);

  const removeLightChannelSlot = useCallback(() => {
    const next = removeLastLightChannel(lightChannels);
    if (!next) return;
    dispatch(
      showScriptMarkdownActions.setLightChannels({
        projectSlug: projectName,
        sceneName: "script",
        lightChannels: next,
      }),
    );
    setSceneData((prev) => ({
      ...(prev ?? {}),
      ...patchSceneDataForLightChannelCount(prev, next, lightChannels.length),
    }));
    const slot = Math.min(
      Math.max(1, liveConsole.selectedLightSlot || 1),
      next.length,
    );
    if (slot !== liveConsole.selectedLightSlot) {
      liveConsole.selectChannel(slot);
    }
    setLiveStatus(`Удалён последний канал · осталось ${next.length}`);
  }, [
    dispatch,
    lightChannels,
    liveConsole,
    liveConsole.selectedLightSlot,
    projectName,
    setSceneData,
  ]);

  const flushLiveSaveAtIndex = useCallback(
    (
      index: number,
      snapshot?: {
        faders: typeof liveConsole.faders;
        programs: typeof liveConsole.programs;
      },
    ) => {
      const item = tapeRef.current[index];
      const step = item ? stepsRef.current[item.stepIndex] : null;
      if (!item || !step || item.isPlaceholder) return;

      const markdown = String(step.markdown ?? "");
      const section = resolveKadrSectionForTapeItem(markdown, item);
      if (!section) {
        setLiveStatus(
          `Картина ${item.kadrNo}: блок не найден в тех. карте — откройте «Тех. карта» и проверьте ### Картина ${item.kadrNo}`,
        );
        return;
      }

      const faders = snapshot?.faders ?? liveConsole.faders;
      const programs = snapshot?.programs ?? liveConsole.programs;
      const kadrId = item.kadrId ?? section.id;

      const programId = Math.max(
        1,
        Math.trunc(programs.activeProgramId ?? programs.programs[0]?.id ?? 1) || 1,
      );

      const roles =
        sceneData?.lightChannelRoles && sceneData.lightChannelRoles.v === 1
          ? sceneData.lightChannelRoles
          : null;

      const result = recordLightKadrForSection({
        markdown,
        section,
        existingKadrId: kadrId,
        kadrs: readStepLightKadrs(step),
        lightChannels,
        lightFaders: faders,
        lightPrograms: programs,
        programId,
        spotlights: step.theaterSpotlights ?? [],
        liveConsoleChannel: liveConsole.selectedLightSlot,
        lightChannelRoles: roles,
      });
      if (!result) {
        setLiveStatus(`Картина ${item.kadrNo}: не удалось записать свет`);
        return;
      }

      updateStep(step.id, {
        lightKadrs: result.nextKadrs,
        markdown: result.nextMarkdown,
      } as Partial<ScriptStep>);
      setLiveStatus(result.summary);
    },
    [
      lightChannels,
      liveConsole.faders,
      liveConsole.programs,
      liveConsole.selectedLightSlot,
      sceneData?.lightChannelRoles,
      updateStep,
    ],
  );

  const flushLiveSave = useCallback(() => {
    flushLiveSaveAtIndex(tapeIndexRef.current);
  }, [flushLiveSaveAtIndex]);

  const scheduleLiveSave = useCallback(() => {
    if (applyingTapeRef.current) return;
    const item = tapeRef.current[tapeIndexRef.current];
    if (!item || item.isPlaceholder) return;
    const step = stepsRef.current[item.stepIndex];
    if (!step || !resolveKadrSectionForTapeItem(String(step.markdown ?? ""), item)) {
      return;
    }
    if (liveSaveTimerRef.current != null) {
      window.clearTimeout(liveSaveTimerRef.current);
    }
    liveSaveTimerRef.current = window.setTimeout(() => {
      liveSaveTimerRef.current = null;
      flushLiveSave();
    }, 550);
  }, [flushLiveSave]);

  const applyTapeItem = useCallback(
    (item: SpectacleTapeItem, options?: { applyFaders?: boolean }) => {
      applyingTapeRef.current = true;
      setCurrentPage(item.stepIndex);

      const step = stepsRef.current[item.stepIndex];
      if (!step || item.isPlaceholder) {
        applyingTapeRef.current = false;
        return;
      }

      const markdown = String(step.markdown ?? "");
      const section = resolveKadrSectionForTapeItem(markdown, item);
      if (section) {
        const soundCue = parseSoundLineInSection(markdown, section);
        applyKadrSound(soundCue);
      }

      const kadrs = readStepLightKadrs(step);
      const kadrId = item.kadrId ?? section?.id ?? null;
      const kadr = kadrId ? findKadrById(kadrs, kadrId) : undefined;

      const applyFaders = options?.applyFaders !== false;
      if (kadr && applyFaders) {
        const nextFaders = applyKadrToFaders(kadr, liveConsole.faders);
        liveConsole.persistFaders(nextFaders);
      }

      if (kadr && kadr.programId > 0) {
        liveConsole.persistPrograms({
          ...liveConsole.programs,
          activeProgramId: kadr.programId,
        });
      }

      applyingTapeRef.current = false;
    },
    [liveConsole, setCurrentPage],
  );

  useEffect(() => {
    if (tape.length === 0 || tapeInitRef.current) return;
    tapeInitRef.current = true;
    const onStep = tape.findIndex((item) => item.stepIndex === currentPage);
    if (onStep >= 0) setTapeIndex(onStep);
  }, [currentPage, tape]);

  useEffect(() => {
    if (skipTapeApplyEffectRef.current) {
      skipTapeApplyEffectRef.current = false;
      return;
    }
    const item = tape[clampedIndex];
    if (!item) return;
    if (liveSaveTimerRef.current != null) {
      window.clearTimeout(liveSaveTimerRef.current);
      liveSaveTimerRef.current = null;
      flushLiveSaveAtIndex(tapeIndexRef.current);
    }
    const skipFaders = skipKadrFadersOnceRef.current;
    if (skipKadrFadersOnceRef.current) {
      skipKadrFadersOnceRef.current = false;
    }
    applyTapeItem(item, { applyFaders: !skipFaders });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только смена позиции в ленте
  }, [clampedIndex]);

  const consoleSnapshotKey = useMemo(
    () =>
      JSON.stringify({
        faders: liveConsole.faders.faders.map((f) => ({
          id: f.id,
          intensity: f.intensity,
          enabled: f.enabled,
          color: f.color,
        })),
        programId: liveConsole.programs.activeProgramId,
      }),
    [liveConsole.faders.faders, liveConsole.programs.activeProgramId],
  );

  useEffect(() => {
    if (applyingTapeRef.current) return;
    scheduleLiveSave();
    return () => {
      if (liveSaveTimerRef.current != null) {
        window.clearTimeout(liveSaveTimerRef.current);
      }
    };
  }, [consoleSnapshotKey, scheduleLiveSave]);

  useEffect(() => {
    if (tape.length === 0) return;
    if (tapeIndex > tape.length - 1) {
      setTapeIndex(Math.max(0, tape.length - 1));
    }
  }, [tape.length, tapeIndex]);

  const recordSoundToCurrentKadr = useCallback(() => {
    const item = tape[clampedIndex];
    if (!item?.section || item.isPlaceholder) return;
    const step = steps[item.stepIndex];
    if (!step) return;

    const result = recordSoundKadrForSection({
      markdown: String(step.markdown ?? ""),
      section: item.section,
      playlist: (sceneData?.playlist ?? []).map((t) => ({
        id: Number(t.id),
        title: String(t.title ?? ""),
      })),
      sounds: (sceneData?.sounds ?? []).map((s) => ({
        id: Number(s.id),
        title: String(s.title ?? ""),
      })),
    });

    if (!result) {
      const snap = getPlaylistPlaybackSnapshot();
      if (!snap.trackId) {
        setLiveStatus("Включите трек в плейлисте, затем «Записать звук»");
        return;
      }
      return;
    }

    updateStep(step.id, { markdown: result.nextMarkdown } as Partial<ScriptStep>);
    setLiveStatus(result.summary);
  }, [clampedIndex, sceneData?.playlist, sceneData?.sounds, steps, tape, updateStep]);

  const addKadrToCurrentStep = useCallback(() => {
    const item = tape[clampedIndex];
    if (!item) return;
    const step = steps[item.stepIndex];
    if (!step) return;

    const { nextMarkdown, nextKadrs, kadrId, kadrNo } = appendKadrToStep({ step });
    pendingTapeKadrIdRef.current = kadrId;
    updateStep(step.id, {
      markdown: nextMarkdown,
      lightKadrs: nextKadrs,
    } as Partial<ScriptStep>);
    setLiveStatus(
      `Картина ${kadrNo}: настройте пульт ниже → «Записать свет» или сдвиньте любой фейдер`,
    );
  }, [clampedIndex, steps, tape, updateStep]);

  const canRecordLight = useMemo(() => {
    if (!currentItem || currentItem.isPlaceholder || !currentStep) return false;
    return Boolean(
      resolveKadrSectionForTapeItem(String(currentStep.markdown ?? ""), currentItem),
    );
  }, [currentItem, currentStep]);

  const recordLightToCurrentKadr = useCallback(() => {
    flushLiveSave();
  }, [flushLiveSave]);

  const goToTapeIndex = useCallback(
    (nextIndex: number) => {
      if (tape.length === 0) return;
      const clamped = Math.max(0, Math.min(tape.length - 1, nextIndex));
      if (clamped === tapeIndexRef.current) return;

      if (liveSaveTimerRef.current != null) {
        window.clearTimeout(liveSaveTimerRef.current);
        liveSaveTimerRef.current = null;
      }

      const leavingIndex = tapeIndexRef.current;
      const leavingSnapshot =
        leavingIndex !== clamped
          ? {
              faders: liveConsole.faders,
              programs: liveConsole.programs,
            }
          : null;

      if (leavingSnapshot) {
        flushLiveSaveAtIndex(leavingIndex, leavingSnapshot);
      }

      const target = tape[clamped];
      if (target) {
        applyingTapeRef.current = true;
        applyTapeItem(target);
      }

      skipTapeApplyEffectRef.current = true;
      tapeIndexRef.current = clamped;
      setTapeIndex(clamped);
    },
    [
      applyTapeItem,
      flushLiveSaveAtIndex,
      liveConsole.faders,
      liveConsole.programs,
      tape,
    ],
  );

  useEffect(() => {
    const pendingId = pendingTapeKadrIdRef.current;
    if (!pendingId || tape.length === 0) return;
    const idx = findTapeIndexForStepKadr(tape, -1, pendingId);
    if (idx < 0) return;
    pendingTapeKadrIdRef.current = null;
    goToTapeIndex(idx);
  }, [tape, steps, goToTapeIndex]);

  const goPrev = useCallback(() => goToTapeIndex(clampedIndex - 1), [clampedIndex, goToTapeIndex]);
  const goNext = useCallback(() => goToTapeIndex(clampedIndex + 1), [clampedIndex, goToTapeIndex]);

  const goNextStep = useCallback(() => {
    if (!currentItem) return;
    const nextInTape = tape.findIndex(
      (item, index) => index > clampedIndex && item.stepIndex > currentItem.stepIndex,
    );
    if (nextInTape >= 0) goToTapeIndex(nextInTape);
  }, [clampedIndex, currentItem, goToTapeIndex, tape]);

  const isLastInSpectacle = clampedIndex >= tape.length - 1;
  const isLastInStep = isLastTapeItemInStep(tape, clampedIndex);
  const canGoNext = !isLastInSpectacle;
  const nextLabel = isLastInStep ? "Следующий шаг" : "Далее";

  return {
    tape,
    tapeIndex: clampedIndex,
    currentItem,
    currentStep,
    textHidden,
    liveStatus,
    setLiveStatus,
    liveConsole,
    lightFaders,
    lightPrograms,
    lightChannelRoles:
      sceneData?.lightChannelRoles && sceneData.lightChannelRoles.v === 1
        ? sceneData.lightChannelRoles
        : null,
    setLightChannelRoles: (next: SceneLightChannelRolesV1) => {
      setSceneData((prev) => ({ ...(prev ?? {}), lightChannelRoles: next }));
    },
    goPrev,
    goNext,
    goNextStep,
    goToTapeIndex,
    canGoPrev: clampedIndex > 0,
    canGoNext,
    isLastInStep,
    isLastInSpectacle,
    nextLabel,
    flushLiveSave,
    recordLightToCurrentKadr,
    canRecordLight,
    addKadrToCurrentStep,
    nextKadrNo: currentStep ? nextKadrNumberForStep(currentStep) : 1,
    canAddKadr: Boolean(currentStep),
    recordSoundToCurrentKadr,
    canRecordSound: Boolean(currentItem?.section && !currentItem?.isPlaceholder),
    appendLightChannelSlot,
    removeLightChannelSlot,
  };
}
