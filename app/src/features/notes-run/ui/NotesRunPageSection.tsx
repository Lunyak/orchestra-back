import { useProject } from "../../project/model/project-context";
import { SpectacleTechChromePortal } from "../../spectacle/ui/spectacle-tech-chrome-slots";
import { useNotesRun } from "../model/useNotesRun";
import { NotesRunProvider, useNotesRunContext } from "../model/notes-run-context";
import { NotesRunCardModal } from "./NotesRunCardModal";
import { NotesRunCardStrip } from "./NotesRunCardStrip";
import { NotesRunOfflineMediaBar } from "./NotesRunOfflineMediaBar";
import { NotesRunChromeControls, NotesRunMeta } from "./NotesRunToolbar";
import "./notes-run.css";

function NotesRunBody() {
  const run = useNotesRunContext();
  return (
    <div className="notes-run notes-run--page">
      <SpectacleTechChromePortal
        left={<NotesRunChromeControls />}
        center={<NotesRunMeta />}
      />
      <NotesRunOfflineMediaBar />
      {run.liveStatus ? <p className="notes-run__status">{run.liveStatus}</p> : null}
      <div className="notes-run__main">
        <NotesRunCardStrip
          groups={run.sceneGroups}
          cardIndex={run.cardIndex}
          media={{
            playlist: run.playlist,
            sounds: run.sounds,
            videos: run.videos.map((v) => ({ id: Number(v.id), title: String(v.title ?? "") })),
            holdImages: run.holdImages.map((h) => ({ id: Number(h.id), title: String(h.title ?? "") })),
          }}
          projectorCtx={run.projectorMediaCtx}
          onSelectIndex={run.goToIndex}
          onInitFromScenes={run.initFromScenes}
        />
      </div>
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
        scenes={run.scenes}
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
