import { lazy, Suspense } from "react";
import { ENABLE_3D_THEATER } from "../../../shared/build-features";
import { PageLoader } from "../../../shared/components/page-loader/PageLoader";
import { useProject } from "../../project/model/project-context";
import { useScene } from "../../scene";

const TheaterScene = lazy(() =>
  import("../../theater/ui/TheaterScene").then((mod) => ({ default: mod.TheaterScene })),
);

export function SpectacleRunTheaterEmbed() {
  const { projectName } = useProject();
  const { theaterLayout, setTheaterLayout } = useScene();

  if (!ENABLE_3D_THEATER) {
    return (
      <p className="spectacle-run-theater-embed__fallback">
        3D-театр отключён в сборке. Используйте вкладку «Расстановка» для плана софитов.
      </p>
    );
  }

  return (
    <div className="spectacle-run-theater-embed">
      <Suspense fallback={<PageLoader variant="view" label="Загрузка 3D…" />}>
        <TheaterScene
          projectName={projectName ?? "fools"}
          theaterLayout={theaterLayout}
          onTheaterLayoutChange={setTheaterLayout}
          embeddedLightRehearsal
        />
      </Suspense>
      <p className="spectacle-run-theater-embed__hint">
        Софиты: выберите луч в 3D и наведите цель; пульт и картины — ниже.
      </p>
    </div>
  );
}
