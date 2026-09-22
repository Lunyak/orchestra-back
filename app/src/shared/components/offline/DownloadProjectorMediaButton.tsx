import { useCallback, useState } from "react";
import { usePlaybookActions } from "../../../features/playbook";
import { isDesktopApp } from "../../platform/media-url";
import "./DownloadProjectorMediaButton.css";

type Props = {
  className?: string;
  buttonClassName?: string;
  onStatus?: (message: string) => void;
};

export function DownloadProjectorMediaButton({
  className,
  buttonClassName,
  onStatus,
}: Props) {
  const { downloadProjectorMediaForOffline } = usePlaybookActions();
  const [busy, setBusy] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const desktop = isDesktopApp();

  const handleClick = useCallback(async () => {
    setBusy(true);
    setProgressLabel(null);
    setLastMessage(null);
    try {
      const result = await downloadProjectorMediaForOffline({
        onProgress: (_current, _total, label) => setProgressLabel(label),
      });
      setLastMessage(result.message);
      onStatus?.(result.message);
    } catch (err) {
      const message = String((err as Error)?.message ?? "Не удалось скачать видео");
      setLastMessage(message);
      onStatus?.(message);
    } finally {
      setBusy(false);
      setProgressLabel(null);
    }
  }, [downloadProjectorMediaForOffline, onStatus]);

  if (!desktop) return null;

  return (
    <div className={className ?? "download-projector-media"}>
      <button
        type="button"
        className={buttonClassName ?? "download-projector-media__btn"}
        disabled={busy}
        onClick={() => void handleClick()}
        title="Сохранить все видео и заставки в папку проекта для работы без интернета"
      >
        {busy ? (progressLabel ? `Загрузка: ${progressLabel}` : "Скачивание…") : "Скачать видео локально"}
      </button>
      {lastMessage && !busy ? (
        <span className="download-projector-media__hint">{lastMessage}</span>
      ) : null}
    </div>
  );
}
