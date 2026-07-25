import { useEffect, useRef, useState, type RefObject } from "react";
import {
  lightKadrsStableKey,
  readSceneLightKadrs,
} from "../../../../features/theater/model/light-kadrs";
import { migrateSceneLightKadrsFromMarkdown } from "../../../../features/spectacle-run/model/migrate-kadrs-from-markdown";
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
  const { currentScene, updateSceneField } = args;
  const lastSyncedLightKadrsKeyRef = useRef("");
  const [activeLightKadrId, setActiveLightKadrId] = useState<string | null>(null);

  useEffect(() => {
    if (currentScene?.id == null) {
      setActiveLightKadrId(null);
      lastSyncedLightKadrsKeyRef.current = "";
      return;
    }
    const prev = readSceneLightKadrs(currentScene);
    const migrated = migrateSceneLightKadrsFromMarkdown(currentScene);
    const syncKey = `${currentScene.id}:${lightKadrsStableKey(migrated)}`;
    if (lightKadrsStableKey(prev) === lightKadrsStableKey(migrated)) {
      lastSyncedLightKadrsKeyRef.current = syncKey;
      return;
    }
    if (lastSyncedLightKadrsKeyRef.current === syncKey) return;
    lastSyncedLightKadrsKeyRef.current = syncKey;
    updateSceneField(currentScene.id, "lightKadrs", migrated);
  }, [currentScene?.id, currentScene?.lightKadrs, currentScene?.markdown, updateSceneField]);

  useEffect(() => {
    const kadrs = readSceneLightKadrs(currentScene);
    if (kadrs.kadrs.length === 0) {
      setActiveLightKadrId(null);
      return;
    }
    setActiveLightKadrId((prev) => {
      if (prev && kadrs.kadrs.some((kadr) => kadr.id === prev)) return prev;
      return kadrs.kadrs[0]?.id ?? null;
    });
  }, [currentScene?.id, currentScene?.lightKadrs]);

  return { activeLightKadrId, setActiveLightKadrId };
}
