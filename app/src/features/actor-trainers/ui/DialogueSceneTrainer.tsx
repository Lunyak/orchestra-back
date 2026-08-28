import cn from "classnames";
import {
  useDialogueSceneTrainer,
  type DialogueSceneTrainerProps,
} from "../model/useDialogueSceneTrainer";
import { DialogueSceneLearningStage } from "./DialogueSceneLearningStage";
import { DialogueSceneTrainerChrome } from "./DialogueSceneTrainerChrome";
import "./dialogue-style.css";

export type { DialogueSceneTrainerProps };

export function DialogueSceneTrainer(props: DialogueSceneTrainerProps) {
  const vm = useDialogueSceneTrainer(props);
  const {
    role,
    roleInfo,
    projectRoles,
    accessToken,
    storageKey,
    allLines,
    doneIds,
    doneCount,
    total,
    left,
    allDone,
    hideUnspokenText,
    setHideUnspokenText,
    wordPoolHost,
    setWordPoolHost,
    activeExerciseIndex,
    activeExerciseIndexResolved,
    activeExercise,
    lineBeforeActive,
    exerciseByLineId,
    scriptLineRefs,
    showLearningStage,
    showScriptStrip,
    activeScriptLineIndex,
    emptyMessage,
    markDone,
    markUndone,
    nav,
    exercises,
  } = vm;

  const showStage = !emptyMessage && showLearningStage && Boolean(activeExercise);

  const afterScroll = (
    <>
      {showLearningStage ? (
        <div
          ref={setWordPoolHost}
          className="dialogue-word-dock"
          aria-label="Слова для текущей реплики"
        />
      ) : null}

      {showScriptStrip ? (
        <section className="dialogue-script-strip" aria-label="Полный сценарий">
          <div className="dialogue-script-strip__head">
            <span className="dialogue-script-strip__title">Сценарий</span>
            <span className="dialogue-script-strip__hint">
              {hideUnspokenText ? "непройденный текст скрыт" : "текущая фраза подсвечена"}
            </span>
          </div>
          <div className="dialogue-script-strip__scroll">
            {allLines.map((line, lineIndex) => {
              const isStage = line.kind === "stage";
              const exercise = exerciseByLineId.get(line.id) ?? null;
              const isMine = Boolean(exercise);
              const isActive = Boolean(activeExercise && activeExercise.lineId === line.id);
              const isPassedByPosition =
                allDone || (activeScriptLineIndex >= 0 && lineIndex < activeScriptLineIndex);
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
                  onClick={canJump ? () => nav.jumpToExercise(line.id) : undefined}
                  role={canJump ? "button" : undefined}
                  tabIndex={canJump ? 0 : undefined}
                  onKeyDown={
                    canJump
                      ? (event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          nav.jumpToExercise(line.id);
                        }
                      : undefined
                  }
                >
                  {isStage ? (
                    <span className="dialogue-script-strip__stage">{visibleText}</span>
                  ) : (
                    <>
                      <span className="dialogue-script-strip__role">{roleLabel}</span>
                      <span className="dialogue-script-strip__text">{visibleText}</span>
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
                Пройдено <b>{doneCount}</b> / {total} — <b>весь блок завершён</b>
              </>
            ) : (
              <>
                Пройдено <b>{doneCount}</b> / {total} (осталось {left})
                {activeExercise ? (
                  <>
                    {" "}
                    · сейчас реплика <b>{activeExerciseIndexResolved + 1}</b>
                  </>
                ) : null}
              </>
            )}
          </div>
          {activeExercise?.sceneTitle ? (
            <div className="dialogue-toolbar-scene">
              Сцена <b>{activeExercise.sceneTitle}</b>
            </div>
          ) : null}
        </div>
      </footer>
    </>
  );

  return (
    <DialogueSceneTrainerChrome
      allDone={allDone}
      hideUnspokenText={hideUnspokenText}
      onToggleHideUnspokenText={() => setHideUnspokenText((value) => !value)}
      activeExerciseIndex={activeExerciseIndex}
      exercisesCount={exercises.length}
      left={left}
      onGoPrevMyLine={nav.goPrevMyLine}
      onGoNextMyLine={nav.goNextMyLine}
      onGoNextUndone={nav.goNextUndone}
      storageKey={storageKey}
      onResetProgressAll={nav.resetProgressAll}
      emptyMessage={emptyMessage}
      afterScroll={afterScroll}
    >
      {showStage && activeExercise ? (
        <DialogueSceneLearningStage
          accessToken={accessToken}
          lineBeforeActive={lineBeforeActive}
          projectRoles={projectRoles}
          roleInfo={roleInfo}
          role={role}
          activeExercise={activeExercise}
          wordPoolHost={wordPoolHost}
          onDone={() => markDone(activeExercise.id)}
          onResetDone={() => markUndone(activeExercise.id)}
        />
      ) : null}
    </DialogueSceneTrainerChrome>
  );
}
