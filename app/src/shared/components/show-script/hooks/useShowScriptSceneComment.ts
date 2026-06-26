import { useCallback, useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import {
  loadActorSceneNote,
  saveActorSceneNote,
  selectActorNote,
} from "../../../../features/show-script/model/show-script-slice";

export function useShowScriptSceneComment(args: {
  projectSlug: string;
  sceneName: string;
  sceneId: number | undefined;
}) {
  const { projectSlug, sceneName, sceneId } = args;
  const dispatch = useAppDispatch();
  const [sceneCommentDraft, setSceneCommentDraft] = useState("");

  const sceneCommentCacheKey =
    sceneId != null ? `${projectSlug}:${sceneName}:${sceneId}` : null;
  const sceneCommentEntry = useAppSelector((s) =>
    sceneCommentCacheKey ? selectActorNote(s, sceneCommentCacheKey) : null,
  );

  useEffect(() => {
    setSceneCommentDraft(sceneCommentEntry?.text ?? "");
  }, [sceneCommentEntry?.text, sceneCommentCacheKey]);

  useEffect(() => {
    if (sceneId == null || !sceneCommentCacheKey) return;
    void dispatch(
      loadActorSceneNote({
        cacheKey: sceneCommentCacheKey,
        projectSlug,
        sceneName,
        sceneId,
      }),
    );
  }, [dispatch, projectSlug, sceneId, sceneCommentCacheKey, sceneName]);

  const saveSceneComment = useCallback(() => {
    if (sceneId == null || !sceneCommentCacheKey) return;
    const next = sceneCommentDraft.trim();
    if (next === String(sceneCommentEntry?.text ?? "").trim()) return;
    void dispatch(
      saveActorSceneNote({
        cacheKey: sceneCommentCacheKey,
        projectSlug,
        sceneName,
        sceneId,
        text: next,
      }),
    );
  }, [
    dispatch,
    projectSlug,
    sceneCommentCacheKey,
    sceneCommentDraft,
    sceneCommentEntry?.text,
    sceneId,
    sceneName,
  ]);

  return {
    sceneCommentDraft,
    setSceneCommentDraft,
    sceneCommentEntry,
    saveSceneComment,
  };
}
