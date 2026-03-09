import { ImgHTMLAttributes, useMemo, useState } from "react";
import Preloader from "../Preloader/Preloader";
import "./ImageWithPreloader.css";

type ImageWithPreloaderProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "className" | "onLoad" | "onError"
> & {
  /** wrapper class */
  className?: string;
  /** img class */
  imgClassName?: string;
  /** spinner size in px */
  spinnerSize?: number;
  onLoad?: ImgHTMLAttributes<HTMLImageElement>["onLoad"];
  onError?: ImgHTMLAttributes<HTMLImageElement>["onError"];
};

export function ImageWithPreloader({
  className,
  imgClassName,
  spinnerSize = 56,
  onLoad,
  onError,
  ...imgProps
}: ImageWithPreloaderProps) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");

  const rootClassName = useMemo(() => {
    return ["img-with-preloader", className].filter(Boolean).join(" ");
  }, [className]);

  const imgCn = useMemo(() => {
    return ["img-with-preloader__img", imgClassName].filter(Boolean).join(" ");
  }, [imgClassName]);

  return (
    <div
      className={rootClassName}
      data-state={state}
      style={{ ["--img-preloader-size" as any]: `${spinnerSize}px` }}
    >
      {state === "loading" && (
        <Preloader className="img-with-preloader__spinner" label="Загрузка изображения…" />
      )}
      <img
        {...imgProps}
        className={imgCn}
        onLoad={(e) => {
          setState("loaded");
          onLoad?.(e);
        }}
        onError={(e) => {
          setState("error");
          onError?.(e);
        }}
      />
    </div>
  );
}

