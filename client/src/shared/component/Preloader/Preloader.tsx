import { FC } from "react";
import "./Preloader.css";

type PreloaderProps = {
  fullscreen?: boolean;
  label?: string;
  className?: string;
};

const Preloader: FC<PreloaderProps> = ({
  fullscreen = false,
  label = "Загрузка…",
  className = "",
}) => {
  const rootClassName = [
    "preloader",
    fullscreen ? "preloader--fullscreen" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName} role="status" aria-live="polite" aria-busy="true">
      <div className="loader" aria-hidden="true" />
      <span className="preloader__sr">{label}</span>
    </div>
  );
};

export default Preloader;

