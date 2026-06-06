import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useScene } from "../../../features/scene";
import { useProject } from "../../../features/project/model/project-context";
import { useAppDispatch } from "../../../shared/store/hooks";
import { showScriptMarkdownActions } from "../../../features/show-script-markdown/model/show-script-markdown-slice";
import { SpectacleRunPageSection } from "../../../features/spectacle-run/ui/SpectacleRunPageSection";
import "../../../features/spectacle-run/ui/style.css";
import "../light-console/light-console.css";
import "./style.css";

const SCRIPT_SCENE_NAME = "script";

export const LightPlotPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { projectName } = useProject();
  const { steps, setCurrentPage } = useScene();

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
      navigate("/");
    },
    [dispatch, navigate, projectName, setCurrentPage, steps.length],
  );

  return (
    <div className="light-plot-page">
      <SpectacleRunPageSection onOpenTechCard={openTechCard} />
    </div>
  );
};
