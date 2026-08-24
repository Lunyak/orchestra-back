import { useCompactKadrStrip } from "@shared/hooks/useCompactKadrStrip";
import cn from "classnames";
import { useProject } from "../../project/model/project-context";
import { SpectacleTechChromePortal } from "../../spectacle/ui/spectacle-tech-chrome-slots";
import { useNotesRun } from "../model/useNotesRun";
import { NotesRunProvider, useNotesRunContext } from "../model/notes-run-context";
import { NotesRunCardModal } from "./NotesRunCardModal";
import { NotesRunCardStrip } from "./NotesRunCardStrip";
import { NotesRunChromeControls, NotesRunMeta } from "./NotesRunToolbar";
import { NotesRunWideLayoutBridge } from "./NotesRunWideLayoutBridge";
import "../../spectacle-run/ui/style.css";
import "./notes-run.css";

function NotesRunBody() {
  const run = useNotesRunContext();
  const compactStrip = useCompactKadrStrip();
  const stripLayout = compactStrip ? "classic" : run.stripLayout;
  const liveStatusText = run.liveStatus?.trim() ?? "";
  const isProjectorOpenCloseStatus =
    liveStatusText.toLowerCase().includes("проектор открыт") ||
    liveStatusText.toLowerCase().includes("проектор закрыт");
  const visibleLiveStatus =
    liveStatusText && (!compactStrip || !isProjectorOpenCloseStatus)
      ? liveStatusText
      : null;

  return (
    <div className={cn("notes-run", "notes-run--page", compactStrip && "notes-run--compact-strip")}>
      <NotesRunWideLayoutBridge />
      <SpectacleTechChromePortal
        left={<NotesRunChromeControls />}
        center={<NotesRunMeta />}
      />
      {visibleLiveStatus ? <p className="notes-run__status">{visibleLiveStatus}</p> : null}
      <div className="notes-run__main">
        <NotesRunCardStrip
          groups={run.sceneGroups}
          cardIndex={run.cardIndex}
          layout={stripLayout}
          notesOverlay={run.stripNotesOverlay}
          plainCover={run.stripPlainCover}
          lightConsoleOpen={run.stripLightConsoleOpen}
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
