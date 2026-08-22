import cn from "classnames";
import { OrchestraPreloader } from "../orchestra-preloader/OrchestraPreloader";

export type PageLoaderVariant = "simple" | "spectacle" | "view" | "orchestra";

export interface PageLoaderProps {
  variant?: PageLoaderVariant;
  label?: string;
  className?: string;
}

export function PageLoader({
  variant = "simple",
  label = "Загрузка…",
  className,
}: PageLoaderProps) {
  const compact = variant === "view";

  return (
    <OrchestraPreloader
      label={label}
      compact={compact}
      className={cn("page-loader", `page-loader--${variant}`, className)}
    />
  );
}
