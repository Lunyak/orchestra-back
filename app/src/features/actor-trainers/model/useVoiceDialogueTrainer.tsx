import cn from "classnames";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ScriptScene } from "../../../shared/types/script";
import { useAppEditorMenubarActionsRender } from "../../../shared/components/app-editor-menubar/AppEditorMenubarContext";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { useAuth } from "../../auth";
import { useProject } from "../../project";
import { useProjectRolesQuery } from "../../project/api/project-api";
import type { VoiceLineControlsPanelProps } from "../ui/VoiceLineControlsPanel";
import {
  buildActiveLineForBody,
  buildAllDialogueLines,
  buildDesiredRoleKeySet,
  buildExerciseIndexByLineId,
  buildLineBeforeActive,
  buildVoiceExercises,
  resolvePrimaryRoleKey,
} from "./voice-dialogue-helpers";
import { findNextUndoneIndex } from "./voice-trainer-progress";
import { getSpeechRecognition } from "./voice-trainer-speech";
import { findProjectRoleForScriptKey } from "./voice-trainer-partner";
import {
  selectVoiceTrainerUi,
  voiceTrainerUiActions,
  VOICE_PASS_RATIO_OPTIONS,
  type VoicePassRatioPercent,
} from "./voiceTrainerUiSlice";
import { useVoiceDialoguePartners } from "./useVoiceDialoguePartners";
import { useVoiceDialogueProgress } from "./useVoiceDialogueProgress";
import { useVoiceDialogueSession } from "./useVoiceDialogueSession";
import { useVoiceTrainerMic } from "./useVoiceTrainerMic";
import { useVoiceTrainerTts } from "./useVoiceTrainerTts";

export type VoiceDialogueTrainerProps = {
  scenes: ScriptScene[];
  role: string;
  roleKeys?: string[];
  selectedPlaybookIds: number[];
  storageKey?: string;
  performerId: string;
  performerLabel?: string;
};

export function useVoiceDialogueTrainer({
  scenes,
  role,
  roleKeys,
  selectedPlaybookIds,
  storageKey,
  performerId,
  performerLabel,
}: VoiceDialogueTrainerProps) {
  const desiredRoleKeySet = useMemo(
    () => buildDesiredRoleKeySet(role, roleKeys),
    [role, roleKeys],
  );
  const primaryRoleKey = useMemo(() => resolvePrimaryRoleKey(role, roleKeys), [role, roleKeys]);

  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const dispatch = useAppDispatch();
  const { data: rolesRes } = useProjectRolesQuery(projectName!, {
    skip: !accessToken || !projectName,
  });
  const projectRoles = useMemo(() => rolesRes?.roles ?? [], [rolesRes?.roles]);
  const uiKey = storageKey || `voiceTrainer:${projectName || "project"}:${primaryRoleKey || "role"}`;
  const ui = useAppSelector((s) => selectVoiceTrainerUi(s, uiKey));
  const voiceLines = useAppSelector((s) => s.playbook.playbookData?.voiceLines);
  const voiceUpload = useAppSelector((s) => s.playbook.voiceLinesUpload);

  useEffect(() => {
    dispatch(voiceTrainerUiActions.initVoiceTrainerUi({ uiKey }));
  }, [dispatch, uiKey]);

  const allLines = useMemo(
    () => buildAllDialogueLines(scenes, selectedPlaybookIds),
    [selectedPlaybookIds, scenes],
  );
  const exercises = useMemo(
    () => buildVoiceExercises(allLines, desiredRoleKeySet),
    [allLines, desiredRoleKeySet],
  );
  const exerciseIndexByLineId = useMemo(() => buildExerciseIndexByLineId(exercises), [exercises]);

  const progress = useVoiceDialogueProgress({ storageKey, exercises });
  const {
    doneIds,
    allDoneDialog,
    setAllDoneDialog,
    index,
    setIndex,
    doneCount,
    total,
    left,
    allDone,
    markDone,
    clearDone,
    clearAllDone,
  } = progress;

  const current = exercises[index] ?? null;
  const [hideUnspokenText, setHideUnspokenText] = useState(true);
  const scriptLineRefs = useRef(new Map<string, HTMLDivElement>());
  useEffect(() => {
    if (!current) return;
    const lineEl = scriptLineRefs.current.get(current.lineId);
    if (!lineEl) return;
    lineEl.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [current?.lineId]);

  const roleInfo = useMemo(
    () => findProjectRoleForScriptKey(role, projectRoles),
    [projectRoles, role],
  );
  const lineBeforeActive = useMemo(() => buildLineBeforeActive(current), [current]);

  const [supported, setSupported] = useState(() => ({
    tts: true,
    stt: Boolean(getSpeechRecognition()),
  }));
  useEffect(() => {
    setSupported({ tts: true, stt: Boolean(getSpeechRecognition()) });
  }, []);

  const autoFlow = ui.autoFlow;
  const checkMode = ui.checkMode;
  const passRatioPercent = ui.passRatioPercent;
  const passRatio = passRatioPercent / 100;
  const showText = ui.showText;

  const [revealedLineIds, setRevealedLineIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setRevealedLineIds(new Set());
  }, [uiKey]);

  const [settingsOpen, setSettingsOpen] = useState(false);

  useAppEditorMenubarActionsRender(
    "voice-settings",
    22,
    () => (
      <button
        type="button"
        className={cn("app-editor-menubar__panel-btn", settingsOpen && "app-editor-menubar__panel-btn--active")}
        onClick={() => setSettingsOpen((open) => !open)}
        title="Настройки голосового тренажёра"
        aria-label="Настройки голосового тренажёра"
        aria-pressed={settingsOpen}
      >
        🎙
      </button>
    ),
    [settingsOpen],
  );

  const voiceName = ui.ttsVoiceName;
  const pttActiveRef = useRef(false);
  const stopListeningRef = useRef<() => void>(() => {});
  const skipPrevTtsForExerciseIdRef = useRef<string | null>(null);

  const mic = useVoiceTrainerMic({ recordTakes: ui.recordTakes });
  const {
    micSelectOptions,
    micDeviceId,
    setMicDeviceId,
    micLabelsReady,
    micError,
    lastTake,
    setLastTake,
    acquireMicStream,
    releaseMicStream,
    startTakeRecording,
    stopTakeRecording,
  } = mic;

  const tts = useVoiceTrainerTts({
    ttsSupported: supported.tts,
    onTtsUnavailable: () => setSupported((p) => ({ ...p, tts: false })),
    voiceName,
    stopListening: () => stopListeningRef.current(),
    pttActiveRef,
  });
  const { voices, ttsDiag, requestSpeak, playUrl, cancelSpeech } = tts;

  const session = useVoiceDialogueSession({
    current,
    exercises,
    index,
    setIndex,
    doneIds,
    markDone,
    setAllDoneDialog,
    autoFlow,
    checkMode,
    passRatio,
    supported,
    ttsDiag,
    requestSpeak,
    playUrl,
    cancelSpeech,
    projectRoles,
    partnerVoiceByRoleKey: ui.partnerVoiceByRoleKey,
    voiceLinesByLineId: voiceLines?.byLineId,
    acquireMicStream,
    startTakeRecording,
    stopTakeRecording,
    lastTake,
    setLastTake,
    projectName,
    performerId,
    performerLabel,
    left,
    total,
    pttActiveRef,
    skipPrevTtsForExerciseIdRef,
  });

  stopListeningRef.current = session.stopListening;

  const {
    listening,
    transcript,
    interim,
    result,
    sentenceTokens,
    sentenceIndex,
    lastAccepted,
    currentTarget,
    myTextNoRemarks,
    prevText,
    stopListening,
    beginListeningSession,
    pttStart,
    pttStop,
    autoCycleBusy,
    runAuto,
    speakPrev,
    saveLastTakeAsPreferred,
    resetSessionBuffers,
  } = session;

  const partners = useVoiceDialoguePartners({
    allLines,
    desiredRoleKeySet,
    projectRoles,
    accessToken,
    uiKey,
    partnerVoiceByRoleKey: ui.partnerVoiceByRoleKey,
  });
  const { partnerRoleSelectOptions, renderActorSelectPerson } = partners;

  const voiceSelectOptions = useMemo(
    () => [
      { value: "auto", label: "Авто (по умолчанию)" },
      ...voices.map((v) => ({
        value: v.name,
        label: `${v.name}${v.locale ? ` (${v.locale})` : ""}`,
      })),
    ],
    [voices],
  );

  const checkModeOptions = useMemo(
    () => [
      { value: "full", label: "1 раз (целиком)" },
      { value: "sentences", label: "По предложениям" },
    ],
    [],
  );

  const passRatioOptions = useMemo(
    () =>
      VOICE_PASS_RATIO_OPTIONS.map((value) => ({
        value: String(value),
        label: `${value}%`,
      })),
    [],
  );

  const resetProgressAll = () => {
    if (!storageKey) return;
    const confirmed = window.confirm("Сбросить весь прогресс голосового тренажёра для этой роли?");
    if (!confirmed) return;
    stopListening();
    cancelSpeech();
    clearAllDone();
    setIndex(0);
    resetSessionBuffers();
  };

  const resetProgressCurrent = () => {
    if (!storageKey || !current) return;
    const confirmed = window.confirm("Сбросить прогресс ТОЛЬКО для текущей реплики?");
    if (!confirmed) return;
    clearDone(current.id);
    resetSessionBuffers();
  };

  const toggleRevealCurrentLine = () => {
    if (!current?.lineId) return;
    setRevealedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(current.lineId)) next.delete(current.lineId);
      else next.add(current.lineId);
      return next;
    });
  };

  const showLearningStage = !allDone && Boolean(current);
  const showScriptStrip = allLines.length > 0;
  const activeScriptLineIndex = current
    ? allLines.findIndex((line) => line.id === current.lineId)
    : -1;

  const lineControlsProps: VoiceLineControlsPanelProps | null = current
    ? {
        current,
        sentenceTokens,
        sentenceIndex,
        showText,
        revealedLineIds,
        onToggleRevealLine: toggleRevealCurrentLine,
        currentTarget,
        lastAccepted,
        supported,
        listening,
        left,
        total,
        pttStart,
        pttStop,
        beginListeningSession,
        autoFlow,
        autoCycleBusy,
        runAuto,
        lastTake,
        playUrl,
        voiceUpload,
        projectName,
        performerId,
        saveLastTakeAsPreferred,
        index,
        exercisesCount: exercises.length,
        onPrev: () => setIndex((i) => Math.max(0, i - 1)),
        onNext: () => setIndex((i) => Math.min(exercises.length - 1, i + 1)),
        myTextNoRemarks,
      }
    : null;

  const goPrevMyLine = () => setIndex((i) => Math.max(0, i - 1));
  const goNextMyLine = () => setIndex((i) => Math.min(exercises.length - 1, i + 1));
  const goNextUndone = () => {
    const next = findNextUndoneIndex(exercises, doneIds, index);
    if (next == null) {
      setAllDoneDialog(true);
      return;
    }
    setIndex(next);
  };

  const jumpToExercise = (lineId: string) => {
    const exerciseIndex = exerciseIndexByLineId.get(lineId);
    if (typeof exerciseIndex !== "number") return;
    setIndex(exerciseIndex);
  };

  const activeLineForBody = buildActiveLineForBody(current);

  const settingsPanelProps = {
    micError,
    micDeviceId,
    micSelectOptions,
    micLabelsReady,
    onMicDeviceChange: (next: string) => {
      setMicDeviceId(next);
      releaseMicStream();
      void acquireMicStream();
    },
    voiceName,
    voiceSelectOptions,
    ttsEnabled: supported.tts,
    onVoiceNameChange: (next: string) =>
      dispatch(voiceTrainerUiActions.setVoiceTtsVoiceName({ uiKey, value: next })),
    checkMode,
    checkModeOptions,
    onCheckModeChange: (next: string) =>
      dispatch(
        voiceTrainerUiActions.setVoiceCheckMode({
          uiKey,
          value: next === "sentences" ? "sentences" : "full",
        }),
      ),
    passRatioPercent,
    passRatioOptions,
    onPassRatioChange: (value: VoicePassRatioPercent) =>
      dispatch(voiceTrainerUiActions.setVoicePassRatioPercent({ uiKey, value })),
    autoFlow,
    onAutoFlowChange: (value: boolean) =>
      dispatch(voiceTrainerUiActions.setVoiceAutoFlow({ uiKey, value })),
    recordTakes: ui.recordTakes,
    onRecordTakesChange: (value: boolean) =>
      dispatch(voiceTrainerUiActions.setVoiceRecordTakes({ uiKey, value })),
    partnerRoleSelectOptions,
    partnerVoiceByRoleKey: ui.partnerVoiceByRoleKey,
    onPartnerVoiceChange: (roleKey: string, nextPerformerId: string) =>
      dispatch(
        voiceTrainerUiActions.setPartnerVoiceSourceForRole({
          uiKey,
          roleKey,
          source: { kind: "performer", performerId: nextPerformerId },
        }),
      ),
    renderActorSelectPerson,
    showText,
    onShowTextChange: (value: boolean) =>
      dispatch(voiceTrainerUiActions.setVoiceShowText({ uiKey, value })),
    prevText,
    onSpeakPrev: () => speakPrev(),
    storageKey,
    onResetProgressCurrent: resetProgressCurrent,
    onResetProgressAll: resetProgressAll,
  };

  return {
    supported,
    micError,
    settingsOpen,
    setSettingsOpen,
    progress: {
      index,
      left,
      total,
      exercises,
      doneIds,
      doneCount,
      allDoneDialog,
      setAllDoneDialog,
      storageKey,
      allDone,
    },
    nav: {
      goPrevMyLine,
      goNextMyLine,
      goNextUndone,
      resetProgressAll,
      jumpToExercise,
    },
    current,
    activeLineForBody,
    lineBeforeActive,
    allLines,
    showLearningStage,
    showScriptStrip,
    roleInfo,
    role,
    accessToken,
    projectRoles,
    listening,
    transcript,
    interim,
    result,
    showText,
    revealedLineIds,
    passRatioPercent,
    hideUnspokenText,
    setHideUnspokenText,
    selectedPlaybookIds,
    exerciseIndexByLineId,
    activeScriptLineIndex,
    scriptLineRefs,
    lineControlsProps,
    settingsPanelProps,
    stopListening,
    cancelSpeech,
  };
}
