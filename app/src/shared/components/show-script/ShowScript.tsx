import React, { useCallback, useMemo } from 'react';
import { useProject } from "../../../features/project";
import { usePlaybook } from "../../../features/playbook";
import { isScenarioWithoutMaterial } from "../../../features/playbook/model/scenario-material";
import { ScriptEmptyMaterialPrompt } from "../../../features/playbook/ui/ScriptEmptyMaterialPrompt";
import { useScriptUI } from '../../../features/script-ui';
import { showScriptMarkdownActions } from "../../../features/show-script-markdown/model/show-script-markdown-slice";
import { useAppDispatch } from "../../store/hooks";
import {
  ScriptScene,
} from "../../types/script";
import { ShowScriptMarkdownSection } from "./components/ShowScriptMarkdownSection";
import { SpectacleScriptToolsDock } from "../../../features/spectacle/ui/SpectacleScriptToolsDock";
import './style.css';


export const ShowScript: React.FC = () => {
  const dispatch = useAppDispatch();
  const { projectName } = useProject();
  const projectSlug = projectName || "fools";
  const sceneName = "script";

  const {
    scenes,
    currentPage,
    updateScene,
    createSceneFromSelection,
    handleTrackLinkClick,
    handleSoundLinkClick,
    hasLocalEdits,
    realtimePullDeferred,
    realtimePullDeferredReason,
    clearRealtimePullDeferred,
    syncFromServer,
    seedScenarioFromPlayText,
  } = usePlaybook();

  const {
    setIsEditing,
  } = useScriptUI();

  const showEmptyMaterialPrompt = useMemo(
    () => isScenarioWithoutMaterial(scenes),
    [scenes],
  );

  const handleImportMaterial = useCallback(
    (text: string) => {
      seedScenarioFromPlayText(text);
      setIsEditing(true);
      dispatch(
        showScriptMarkdownActions.setMarkdownMode({
          projectSlug,
          sceneName,
          mode: "play",
        }),
      );
    },
    [dispatch, projectSlug, sceneName, seedScenarioFromPlayText, setIsEditing],
  );

  const currentScene = scenes[currentPage];
  const updateSceneField = <K extends keyof ScriptScene>(
    id: number,
    field: K,
    value: ScriptScene[K],
  ) => {
    updateScene(id, { [field]: value } as Partial<ScriptScene>);
  };

  const handleCreateSceneFromSelection = (
    sourceSceneId: number,
    selectedText: string,
    remainderText: string,
    targetField: "markdown" | "playMarkdown" | "explicationMarkdown",
  ) => {
    createSceneFromSelection({
      sourceSceneId,
      targetField,
      selectedText,
      remainderText,
    });
  };

  return (
    <div className="show-script">
      <div className="script-content">
        {realtimePullDeferred ? (
          <div className="realtime-banner" role="status" aria-live="polite">
            <div className="realtime-banner__text">
              {hasLocalEdits || realtimePullDeferredReason === "local_edits"
                ? "Есть обновления на сервере. Авто‑обновление отложено, пока есть локальные правки."
                : realtimePullDeferredReason === "settings_pause"
                  ? "Есть обновления на сервере. Авто‑подтягивание отключено в настройках (можно подтянуть вручную)."
                  : realtimePullDeferredReason === "confirm_declined"
                    ? "Есть обновления на сервере. Вы отказались от автоматического подтягивания."
                    : "Есть обновления из другого окна. Можно подтянуть сейчас."}
            </div>
            <div className="realtime-banner__actions">
              <button
                className="realtime-banner__btn"
                onClick={() => syncFromServer(null, projectSlug)}
                disabled={hasLocalEdits}
                title={hasLocalEdits ? "Сначала дождитесь сохранения локальных правок" : "Подтянуть обновления"}
              >
                Подтянуть
              </button>
              <button className="realtime-banner__btn realtime-banner__btn--secondary" onClick={clearRealtimePullDeferred}>
                Скрыть
              </button>
            </div>
          </div>
        ) : null}

        {showEmptyMaterialPrompt ? (
          <ScriptEmptyMaterialPrompt onImport={handleImportMaterial} />
        ) : (
        <ShowScriptMarkdownSection
          projectSlug={projectSlug}
          sceneName={sceneName}
          inlineMarkdownTabs={false}
          updateSceneField={updateSceneField}
          onTrackLinkClick={handleTrackLinkClick}
          onSoundLinkClick={handleSoundLinkClick}
          onCreateSceneFromSelection={handleCreateSceneFromSelection}
          renderBody={({ markdownPane }) =>
            currentScene ? (
              <div className="script-scene-editor">
                <div className="script-scene-body">
                  <div className="script-scene-main">
                    {markdownPane}
                    <SpectacleScriptToolsDock
                      projectSlug={projectSlug}
                      sceneName={sceneName}
                    />
                  </div>
                </div>
              </div>
            ) : null
          }
        />
        )}
      </div>
    </div >
  );
};
