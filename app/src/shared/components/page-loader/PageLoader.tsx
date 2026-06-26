import React from "react";
import "./style.css";

export type PageLoaderVariant = "simple" | "spectacle" | "view";

export interface PageLoaderProps {
  variant?: PageLoaderVariant;
  /** Показывать левый сайдбар-заглушку (плейлист). */
  showLeftSidebar?: boolean;
  /** Показывать правый сайдбар-заглушку (сцены). */
  showRightSidebar?: boolean;
  /** Заглушка верхней панели (sounds-bar). */
  showTopBar?: boolean;
  /** Подпись для screen readers. */
  label?: string;
  className?: string;
}

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export function PageLoader({
  variant = "simple",
  showLeftSidebar = false,
  showRightSidebar = false,
  showTopBar = false,
  label = "Загрузка…",
  className,
}: PageLoaderProps) {
  if (variant === "view") {
    return (
      <div className={cx("page-loader", "page-loader--view", className)} role="status" aria-live="polite">
        <span className="page-loader__sr">{label}</span>
        <div className="page-loader__view">
          <div className="page-loader__line sk sk--w-40" />
          <div className="page-loader__line sk sk--w-85" />
          <div className="page-loader__line sk sk--w-70" />
          <div className="page-loader__grid">
            <div className="page-loader__tile sk" />
            <div className="page-loader__tile sk" />
            <div className="page-loader__tile sk" />
            <div className="page-loader__tile sk" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cx(
        "app-layout",
        "page-loader",
        variant === "spectacle" ? "page-loader--spectacle" : "page-loader--simple",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span className="page-loader__sr">{label}</span>

      {showLeftSidebar && (
        <aside className="page-loader__sidebar page-loader__sidebar--left" aria-hidden>
          <div className="page-loader__sidebar-title sk sk--w-65" />
          <div className="page-loader__sidebar-item sk" />
          <div className="page-loader__sidebar-item sk" />
          <div className="page-loader__sidebar-item sk" />
          <div className="page-loader__sidebar-item sk" />
          <div className="page-loader__sidebar-item sk" />
        </aside>
      )}

      <div className="app-content">
        {showTopBar && (
          <div className="page-loader__topbar" aria-hidden>
            <div className="page-loader__topbar-row">
              <div className="page-loader__pill sk sk--w-30" />
              <div className="page-loader__pill sk sk--w-20" />
              <div className="page-loader__pill sk sk--w-25" />
            </div>
          </div>
        )}

        <main className="main-content">
          <div className="page-loader__content" aria-hidden>
            <div className="page-loader__title sk sk--w-45" />
            <div className="page-loader__line sk sk--w-85" />
            <div className="page-loader__line sk sk--w-70" />
            <div className="page-loader__line sk sk--w-60" />
            <div className="page-loader__cards">
              <div className="page-loader__card sk" />
              <div className="page-loader__card sk" />
              <div className="page-loader__card sk" />
            </div>
          </div>
        </main>
      </div>

      {showRightSidebar && (
        <aside className="page-loader__sidebar page-loader__sidebar--right" aria-hidden>
          <div className="page-loader__sidebar-title sk sk--w-55" />
          <div className="page-loader__sidebar-item sk" />
          <div className="page-loader__sidebar-item sk" />
          <div className="page-loader__sidebar-item sk" />
          <div className="page-loader__sidebar-item sk" />
          <div className="page-loader__sidebar-item sk" />
          <div className="page-loader__sidebar-item sk" />
        </aside>
      )}
    </div>
  );
}

