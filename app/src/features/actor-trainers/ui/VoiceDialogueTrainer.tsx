import cn from "classnames";
import {
  useVoiceDialogueTrainer,
  type VoiceDialogueTrainerProps,
} from "../model/useVoiceDialogueTrainer";
import { VoiceDialogueLearningStage } from "./VoiceDialogueLearningStage";
import { VoiceDialogueTrainerChrome } from "./VoiceDialogueTrainerChrome";
import { VoiceDialogueTrainerSettingsModal } from "./VoiceDialogueTrainerSettingsModal";
import { VoiceLineControlsPanel } from "./VoiceLineControlsPanel";
import "./dialogue-style.css";
import "./voice-style.css";

export type { VoiceDialogueTrainerProps };

export function VoiceDialogueTrainer(props: VoiceDialogueTrainerProps) {
  const vm = useVoiceDialogueTrainer(props);
  const {
    supported,
    micError,
    settingsOpen,
    setSettingsOpen,
    progress,
    nav,
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
  } = vm;

  const {
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
  } = progress;

  if (!current) {
    return (
      <div className={cn("dialogue-trainer", "voice-trainer")}>
        <div className="dialogue-empty">Нет реплик для голосового режима.</div>
      </div>
    );
  }

  const emptyMessage =
    allLines.length === 0
      ? selectedPlaybookIds.length === 0
        ? "Выберите сцены в настройках. Если список пуст, выберите роль, у которой есть реплики в тексте."
        : "Нет текста в выбранных сценах (проверьте поле «Текст» в сценах)."
      : null;

  const showStage =
    !emptyMessage && showLearningStage && Boolean(activeLineForBody);

  const afterScroll = (
    <>
      {showLearningStage && lineControlsProps ? (
        <div
          className="dialogue-word-dock voice-controls-dock"
          aria-label="Управление репликой"
        >
          <VoiceLineControlsPanel
            {...lineControlsProps}
            className="voice-panel--dock"
          />
        </div>
      ) : null}

      {showScriptStrip ? (
        <section className="dialogue-script-strip" aria-label="Полный сценарий">
          <div className="dialogue-script-strip__head">
            <span className="dialogue-script-strip__title">Сценарий</span>
            <span className="dialogue-script-strip__hint">
              {hideUnspokenText
                ? "непройденный текст скрыт"
                : "текущая фраза подсвечена"}
            </span>
          </div>
          <div className="dialogue-script-strip__scroll">
            {allLines.map((line, lineIndex) => {
              const isStage = line.kind === "stage";
              const exerciseIndex = exerciseIndexByLineId.get(line.id);
              const isMine = typeof exerciseIndex === "number";
              const exercise = isMine ? exercises[exerciseIndex]! : null;
              const isActive = current.lineId === line.id;
              const isPassedByPosition =
                allDone ||
                (activeScriptLineIndex >= 0 &&
                  lineIndex < activeScriptLineIndex);
              const isMineDone = Boolean(exercise && doneIds.has(exercise.id));
              const isDone = !isActive && (isPassedByPosition || isMineDone);
              const hideText = hideUnspokenText && !isDone;
              const roleLabel = line.role ? String(line.role) : "Ремарка";
              const canJump = isMine && !allDone;
              const visibleText = hideText ? "···" : line.text;

              return (
                <div
                  key={line.id}
                  ref={(el) => {
                    if (!el) {
                      scriptLineRefs.current.delete(line.id);
                      return;
                    }
                    scriptLineRefs.current.set(line.id, el);
                  }}
                  className={cn(
                    "dialogue-script-strip__line",
                    isStage && "dialogue-script-strip__line--stage",
                    isMine && "dialogue-script-strip__line--mine",
                    isActive && "dialogue-script-strip__line--active",
                    isDone && "dialogue-script-strip__line--done",
                    hideText && "dialogue-script-strip__line--hidden-text",
                    canJump && "dialogue-script-strip__line--jumpable",
                  )}
                  onClick={
                    canJump ? () => nav.jumpToExercise(line.id) : undefined
                  }
                  role={canJump ? "button" : undefined}
                  tabIndex={canJump ? 0 : undefined}
                  onKeyDown={
                    canJump
                      ? (event) => {
                          if (event.key !== "Enter" && event.key !== " ")
                            return;
                          event.preventDefault();
                          nav.jumpToExercise(line.id);
                        }
                      : undefined
                  }
                >
                  {isStage ? (
                    <span className="dialogue-script-strip__stage">
                      {visibleText}
                    </span>
                  ) : (
                    <>
                      <span className="dialogue-script-strip__role">
                        {roleLabel}
                      </span>
                      <span className="dialogue-script-strip__text">
                        {visibleText}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <footer className="dialogue-footer">
        <div className="dialogue-toolbar-main">
          <div className="dialogue-toolbar-title">
            Роль <b>{role || "—"}</b>
          </div>
          <div className="dialogue-toolbar-meta">
            {allDone ? (
              <>
                Пройдено <b>{doneCount}</b> / {total} —{" "}
                <b>весь блок завершён</b>
              </>
            ) : (
              <>
                Пройдено <b>{doneCount}</b> / {total} (осталось {left})
                {current ? (
                  <>
                    {" "}
                    · сейчас реплика <b>{index + 1}</b>
                  </>
                ) : null}
              </>
            )}
          </div>
          {current.sceneTitle ? (
            <div className="dialogue-toolbar-scene">
              Сцена <b>{current.sceneTitle}</b>
            </div>
          ) : null}
        </div>
      </footer>
    </>
  );

  return (
    <>
      <VoiceDialogueTrainerChrome
        allDone={allDone}
        hideUnspokenText={hideUnspokenText}
        onToggleHideUnspokenText={() => setHideUnspokenText((value) => !value)}
        index={index}
        exercisesCount={exercises.length}
        left={left}
        onGoPrevMyLine={nav.goPrevMyLine}
        onGoNextMyLine={nav.goNextMyLine}
        onGoNextUndone={nav.goNextUndone}
        storageKey={storageKey}
        onResetProgressAll={nav.resetProgressAll}
        sttSupported={supported.stt}
        micError={micError}
        settingsOpen={settingsOpen}
        allDoneDialog={allDoneDialog}
        total={total}
        onFinishAllDone={() => {
          stopListening();
          cancelSpeech();
          setAllDoneDialog(false);
        }}
        onRestartAllDone={() => {
          nav.resetProgressAll();
          setAllDoneDialog(false);
        }}
        emptyMessage={emptyMessage}
        afterScroll={afterScroll}
      >
        {showStage && activeLineForBody ? (
          <VoiceDialogueLearningStage
            accessToken={accessToken}
            lineBeforeActive={lineBeforeActive}
            projectRoles={projectRoles}
            roleInfo={roleInfo}
            role={role}
            current={current}
            activeLineForBody={activeLineForBody}
            listening={listening}
            showText={showText}
            revealedLineIds={revealedLineIds}
            transcript={transcript}
            interim={interim}
            result={result}
            passRatioPercent={passRatioPercent}
          />
        ) : null}
      </VoiceDialogueTrainerChrome>

      <VoiceDialogueTrainerSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settingsPanelProps={settingsPanelProps}
      />
    </>
  );
}
