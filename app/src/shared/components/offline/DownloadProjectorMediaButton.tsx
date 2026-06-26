import { useCallback, useState } from "react";
import { usePlaybook } from "../../../features/playbook";
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
  const { downloadProjectorMediaForOffline } = usePlaybook();
  const [busy, setBusy] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const desktop = isDesktopApp();

  const handleClick = useCallback(async () => {
    if (!desktop) {
      const message = "Откройте приложение через npm run dev:desktop (окно Electron, не браузер)";
      setLastMessage(message);
      onStatus?.(message);
      return;
    }
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
  }, [desktop, downloadProjectorMediaForOffline, onStatus]);

  return (
    <div className={className ?? "download-projector-media"}>
      <button
        type="button"
        className={buttonClassName ?? "download-projector-media__btn"}
        disabled={busy}
        onClick={() => void handleClick()}
        title={
          desktop
            ? "Сохранить все видео и заставки в папку проекта для работы без интернета"
            : "Доступно только в десктоп-приложении Electron"
        }
      >
        {busy ? (progressLabel ? `Загрузка: ${progressLabel}` : "Скачивание…") : "Скачать видео локально"}
      </button>
      {lastMessage && !busy ? (
        <span className="download-projector-media__hint">{lastMessage}</span>
      ) : null}
    </div>
  );
}
