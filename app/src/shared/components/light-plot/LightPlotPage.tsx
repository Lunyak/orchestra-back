import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { usePlaybook } from "../../../features/playbook";
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
  const { scenes, setCurrentPage } = usePlaybook();

  const openTechCard = useCallback(
    (sceneIndex?: number) => {
      if (!projectName) return;
      if (sceneIndex != null && sceneIndex >= 0 && sceneIndex < scenes.length) {
        setCurrentPage(sceneIndex);
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
    [dispatch, navigate, projectName, setCurrentPage, scenes.length],
  );

  return (
    <div className="light-plot-page">
      <SpectacleRunPageSection onOpenTechCard={openTechCard} />
    </div>
  );
};
