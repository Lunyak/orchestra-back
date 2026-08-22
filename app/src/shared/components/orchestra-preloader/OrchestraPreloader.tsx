import cn from "classnames";
import "./orchestra-preloader.css";

export type OrchestraPreloaderProps = {
  label?: string;
  className?: string;
  compact?: boolean;
};

export function OrchestraPreloader({
  label = "Загрузка…",
  className,
  compact = false,
}: OrchestraPreloaderProps) {
  return (
    <div
      className={cn(
        "orchestra-preloader",
        compact && "orchestra-preloader--compact",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="orchestra-preloader__stack">
        <div className="orchestra-preloader__icon" aria-hidden>
          <span className="orchestra-preloader__lamp" />
          <span className="orchestra-preloader__ring" />
        </div>
        <p className="orchestra-preloader__label">{label}</p>
      </div>
    </div>
  );
}
