import cn from "classnames";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { ENABLE_3D_THEATER } from "../../../shared/build-features";
import { PageLoader } from "../../../shared/components/page-loader/PageLoader";
import { useProject } from "../../project/model/project-context";
import { useScene } from "../../scene";

const TheaterScene = lazy(() =>
  import("../../theater/ui/TheaterScene").then((mod) => ({ default: mod.TheaterScene })),
);

function TheaterFullscreenIcon({ expanded }: { expanded: boolean }) {
  if (expanded) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M9 9H4V4M15 9h5V4M9 15H4v5M15 15h5v5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4M15 21h4a2 2 0 0 0 2-2v-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SpectacleRunTheaterEmbed() {
  const { projectName } = useProject();
  const { theaterLayout, setTheaterLayout } = useScene();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((value) => !value);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isFullscreen]);

  if (!ENABLE_3D_THEATER) {
    return (
      <p className="spectacle-run-theater-embed__fallback">
        3D-театр отключён в сборке. Используйте вкладку «Расстановка» для плана софитов.
      </p>
    );
  }

  const fullscreenLabel = isFullscreen ? "Свернуть 3D-театр" : "3D-театр на весь экран";

  return (
    <div
      className={cn(
        "spectacle-run-theater-embed",
        isFullscreen && "spectacle-run-theater-embed--fullscreen",
      )}
    >
      <div className="spectacle-run-theater-embed__toolbar">
        <button
          type="button"
          className={cn(
            "spectacle-run-theater-embed__fullscreen-btn",
            isFullscreen && "spectacle-run-theater-embed__fullscreen-btn--active",
          )}
          aria-label={fullscreenLabel}
          title={isFullscreen ? "Свернуть" : "На весь экран"}
          aria-pressed={isFullscreen}
          onClick={toggleFullscreen}
        >
          <TheaterFullscreenIcon expanded={isFullscreen} />
        </button>
      </div>
      <Suspense fallback={<PageLoader variant="view" label="Загрузка 3D…" />}>
        <TheaterScene
          projectName={projectName ?? "fools"}
          theaterLayout={theaterLayout}
          onTheaterLayoutChange={setTheaterLayout}
          embeddedLightRehearsal
        />
      </Suspense>
    </div>
  );
}
