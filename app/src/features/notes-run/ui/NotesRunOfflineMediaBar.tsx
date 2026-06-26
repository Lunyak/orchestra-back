import { ProjectMediaPageLink } from "../../project-media/ui/ProjectMediaPageSection";
import { useNotesRunContext } from "../model/notes-run-context";
import { useAppSelector } from "../../../shared/store/hooks";

export function NotesRunOfflineMediaBar() {
  const run = useNotesRunContext();
  const videoCount = run.videos.length;
  const holdCount = run.holdImages.length;
  const trackCount = useAppSelector((s) => s.playbook.playbookData?.playlist?.length ?? 0);
  const soundCount = useAppSelector((s) => s.playbook.playbookData?.sounds?.length ?? 0);

  return (
    <div className="notes-run__offline-bar" role="region" aria-label="Медиа прогона">
      <div className="notes-run__offline-bar-text">
        <strong className="notes-run__offline-bar-title">Медиа</strong>
        <span>
          {videoCount} видео, {holdCount} заставок, {trackCount} треков, {soundCount} звуков — из{" "}
          <ProjectMediaPageLink className="notes-run__offline-bar-link" />
          . Там же: папка с диска или синхронизация с сервером.
        </span>
      </div>
    </div>
  );
}
