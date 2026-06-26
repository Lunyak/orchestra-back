import cn from "classnames";
import { useProject } from "../../project/model/project-context";
import { useNotesRun } from "../model/useNotesRun";
import { NotesRunProvider, useNotesRunContext } from "../model/notes-run-context";
import { NotesRunCardModal } from "./NotesRunCardModal";
import { NotesRunCardStrip } from "./NotesRunCardStrip";
import { NotesRunOfflineMediaBar } from "./NotesRunOfflineMediaBar";
import "./notes-run.css";

function NotesRunToolbar() {
  const run = useNotesRunContext();
  return (
    <div className="notes-run__toolbar">
      <div className="notes-run__toolbar-group">
        <button type="button" className="notes-run__btn notes-run__btn--primary" onClick={run.startRun}>
          Старт
        </button>
        <button
          type="button"
          className="notes-run__btn"
          onClick={run.togglePause}
          disabled={!run.runActive}
        >
          {run.paused ? "Продолжить" : "Пауза"}
        </button>
        <button type="button" className="notes-run__btn" onClick={run.openCreateModal}>
          Добавить
        </button>
        <button type="button" className="notes-run__btn" onClick={run.openEditModal} disabled={!run.currentCard}>
          Редактировать
        </button>
        <button type="button" className="notes-run__btn notes-run__btn--danger" onClick={run.deleteCurrentCard} disabled={!run.currentCard}>
          Удалить
        </button>
        <button type="button" className="notes-run__btn" onClick={run.initFromScenes}>
          Из сцен сценария
        </button>
      </div>
      <div className="notes-run__toolbar-group">
        {run.isProjectorOpen ? (
          <button type="button" className="notes-run__btn" onClick={run.closeProjector}>
            Закрыть проектор
          </button>
        ) : (
          <button type="button" className="notes-run__btn" onClick={run.openProjector}>
            Проектор
          </button>
        )}
        <span className="notes-run__toolbar-counter" aria-live="polite">
          {run.cards.length === 0
            ? "0 карточек"
            : `${run.cardIndex + 1} / ${run.cards.length}`}
        </span>
      </div>
    </div>
  );
}

function NotesRunNav() {
  const run = useNotesRunContext();
  const transition = run.currentCard?.transitionText?.trim() || "";
  return (
    <div className="notes-run__nav" aria-label="Навигация по карточкам">
      <button
        type="button"
        className="notes-run__nav-btn"
        disabled={!run.canGoPrev}
        onClick={run.goPrev}
      >
        ◀ Назад
      </button>
      <div className="notes-run__nav-center">
        {transition ? <span className="notes-run__nav-transition">{transition}</span> : null}
        <span className="notes-run__nav-counter">
          {run.cards.length === 0
            ? "—"
            : `${run.cardIndex + 1} / ${run.cards.length}`}
        </span>
      </div>
      <button
        type="button"
        className={cnNavForward(run.canGoNext)}
        disabled={!run.canGoNext}
        onClick={run.goNext}
      >
        Вперёд ▶
      </button>
    </div>
  );
}

function cnNavForward(canGoNext: boolean) {
  return cn(
    "notes-run__nav-btn",
    "notes-run__nav-btn--forward",
    canGoNext && "notes-run__nav-btn--primary",
  );
}

function NotesRunBody() {
  const run = useNotesRunContext();
  return (
    <div className="notes-run">
      <NotesRunOfflineMediaBar />
      <NotesRunToolbar />
      {run.liveStatus ? <p className="notes-run__status">{run.liveStatus}</p> : null}
      <div className="notes-run__main">
        <NotesRunCardStrip
          cards={run.cards}
          cardIndex={run.cardIndex}
          media={{
            playlist: run.playlist,
            sounds: run.sounds,
            videos: run.videos.map((v) => ({ id: Number(v.id), title: String(v.title ?? "") })),
            holdImages: run.holdImages.map((h) => ({ id: Number(h.id), title: String(h.title ?? "") })),
          }}
          projectorCtx={run.projectorMediaCtx}
          onSelectIndex={run.goToIndex}
        />
      </div>
      <NotesRunNav />
      <NotesRunCardModal
        isOpen={run.modalOpen}
        mode={run.modalMode}
        initialDraft={run.modalDraft}
        cardNo={
          run.modalMode === "edit"
            ? (run.currentCard?.cardNo ?? run.cardIndex + 1)
            : run.createInsertAfterIndex == null
              ? 1
              : run.createInsertAfterIndex + 2
        }
        playlist={run.playlist}
        sounds={run.sounds}
        videos={run.videos}
        holdImages={run.holdImages}
        projectorCtx={run.projectorMediaCtx}
        onClose={run.closeModal}
        onSubmit={run.submitModal}
      />
    </div>
  );
}

export function NotesRunPageSection() {
  const { projectName } = useProject();
  const run = useNotesRun(projectName ?? "");
  return (
    <NotesRunProvider value={run}>
      <NotesRunBody />
    </NotesRunProvider>
  );
}
