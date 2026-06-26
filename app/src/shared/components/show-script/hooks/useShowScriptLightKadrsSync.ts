import { useEffect, useRef, useState, type RefObject } from "react";
import {
  findKadrSectionAtOffset,
  lightKadrsStableKey,
  readSceneLightKadrs,
  syncLightKadrsFromMarkdown,
} from "../../../../features/theater/model/light-kadrs";
import type { ScriptScene } from "../../../types/script";
import type { ScriptMarkdownEditorHandle } from "../components/ScriptMarkdownCodemirror";

export function useShowScriptLightKadrsSync(args: {
  currentScene: ScriptScene | undefined;
  activeMarkdown: string | undefined;
  isEditing: boolean;
  updateSceneField: <K extends keyof ScriptScene>(
    id: number,
    field: K,
    value: ScriptScene[K],
  ) => void;
  markdownRef: RefObject<ScriptMarkdownEditorHandle | null>;
}) {
  const { currentScene, activeMarkdown, isEditing, updateSceneField, markdownRef } = args;
  const lastSyncedLightKadrsKeyRef = useRef("");
  const [activeLightKadrId, setActiveLightKadrId] = useState<string | null>(null);

  useEffect(() => {
    if (currentScene?.id == null) {
      setActiveLightKadrId(null);
      lastSyncedLightKadrsKeyRef.current = "";
      return;
    }
    const markdown = String(currentScene.markdown ?? "");
    const prev = readSceneLightKadrs(currentScene);
    const synced = syncLightKadrsFromMarkdown({ markdown, kadrs: prev });
    const syncKey = `${currentScene.id}:${markdown.length}:${lightKadrsStableKey(synced)}`;
    if (lightKadrsStableKey(prev) === lightKadrsStableKey(synced)) {
      lastSyncedLightKadrsKeyRef.current = syncKey;
      return;
    }
    if (lastSyncedLightKadrsKeyRef.current === syncKey) return;
    lastSyncedLightKadrsKeyRef.current = syncKey;
    updateSceneField(currentScene.id, "lightKadrs", synced);
  }, [currentScene?.id, currentScene?.lightKadrs, currentScene?.markdown, updateSceneField]);

  useEffect(() => {
    const ed = markdownRef.current;
    const sel = ed?.getSelection();
    const offset = sel?.from ?? String(activeMarkdown ?? "").length;
    const section = findKadrSectionAtOffset(String(activeMarkdown ?? ""), offset);
    const nextId = section?.id ?? null;
    setActiveLightKadrId((prev) => (prev === nextId ? prev : nextId));
  }, [activeMarkdown, isEditing, markdownRef]);

  return { activeLightKadrId, setActiveLightKadrId };
}
