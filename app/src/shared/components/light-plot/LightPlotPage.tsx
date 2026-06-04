import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useScene } from "../../../features/scene";
import { useProject } from "../../../features/project/model/project-context";
import { useScriptUI } from "../../../features/script-ui";
import { useAppDispatch } from "../../../shared/store/hooks";
import { showScriptMarkdownActions } from "../../../features/show-script-markdown/model/show-script-markdown-slice";
import { mergeLightPlotFromSpotlights } from "../../../features/theater/model/theater-light-channel-link";
import type { ScriptStep } from "../../types/script";
import { useAppSelector } from "../../../shared/store/hooks";
import { SpectacleRunPageSection } from "../../../features/spectacle-run/ui/SpectacleRunPageSection";
import "../../../features/spectacle-run/ui/style.css";
import "../light-console/light-console.css";
import "./style.css";

const SCRIPT_SCENE_NAME = "script";
const LIGHT_GRID_COLS = 12;
const LIGHT_GRID_ROWS = 20;

export const LightPlotPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { projectName } = useProject();
  const { setIsEditing } = useScriptUI();
  const { steps, currentPage, updateStep, setCurrentPage } = useScene();
  const theaterLayout = useAppSelector((state) => state.scene.theaterLayout);

  const currentStep = steps[currentPage];
  const lightPlot = currentStep?.lightPlot ?? [];
  const spotlights = currentStep?.theaterSpotlights ?? [];

  const syncFromTheater = useCallback(() => {
    if (!currentStep || spotlights.length === 0) return;
    const merged = mergeLightPlotFromSpotlights(
      spotlights,
      lightPlot,
      theaterLayout,
      LIGHT_GRID_COLS,
      LIGHT_GRID_ROWS,
    );
    const normalized = merged.map((item) => ({
      ...item,
      label: item.label?.trim() || `Софит ${item.id}`,
      channel: item.channel?.trim() ?? "",
      x: Math.max(1, Math.min(LIGHT_GRID_COLS, Math.trunc(item.x))),
      y: Math.max(1, Math.min(LIGHT_GRID_ROWS, Math.trunc(item.y))),
      angle: Number.isFinite(item.angle) ? item.angle : 0,
      length: Number.isFinite(item.length) ? item.length : 54,
    }));
    updateStep(currentStep.id, { lightPlot: normalized } as Partial<ScriptStep>);
  }, [currentStep, lightPlot, spotlights, theaterLayout, updateStep]);

  const openTechCard = useCallback(
    (stepIndex?: number) => {
      if (!projectName) return;
      if (stepIndex != null && stepIndex >= 0 && stepIndex < steps.length) {
        setCurrentPage(stepIndex);
      }
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(
            `showScript:markdownMode:${projectName}:${SCRIPT_SCENE_NAME}`,
            "notes",
          );
        }
      } catch {
        // ignore
      }
      dispatch(
        showScriptMarkdownActions.setMarkdownMode({
          projectSlug: projectName,
          sceneName: SCRIPT_SCENE_NAME,
          mode: "notes",
        }),
      );
      setIsEditing(true);
      navigate("/");
    },
    [dispatch, navigate, projectName, setCurrentPage, setIsEditing, steps.length],
  );

  return (
    <div className="light-plot-page">
      <SpectacleRunPageSection
        onOpenTechCard={openTechCard}
        onSyncPlotFrom3d={syncFromTheater}
      />
    </div>
  );
};
