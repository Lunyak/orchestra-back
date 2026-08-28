import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import {
  buildScriptEditorInsertMenuRows,
  type ScriptEditorInsertItemDefinition,
  type ScriptEditorInsertMenuPick,
} from "../../../../features/script-editor-insert-menu";
import {
  collapseExtraBlankLines,
  subscribeScriptCollapseBlankLines,
  subscribeScriptMarkdownStyle,
  subscribeScriptTokenizeRequests,
  applyMarkdownStyle,
  wrapMarkdownMatchesAsTokens,
  wrapNextMarkdownMatchAsToken,
} from "../../app-editor-menubar";
import { ensureProject } from "../../../../sync/api/projects";
import { uploadProjectFile } from "../../../../sync/api/files";
import { pasteProjectImageMarkdownSnippetFromClipboard } from "../../../project-assets/pasteProjectImageMarkdownSnippetFromClipboard";
import type { ScriptScene } from "../../../types/script";
import type { ScriptMarkdownEditorHandle } from "../components/ScriptMarkdownCodemirror";
import { insertAtSelection } from "../utils/insertAtCursor";

type UseShowScriptMarkdownInsertArgs = {
  projectSlug: string;
  sceneName: string;
  accessToken: string | null;
  currentScene: ScriptScene | undefined;
  activeMarkdown: string | undefined;
  activeMarkdownField: keyof ScriptScene;
  playlistOptions: Array<{ id: number; title: string }>;
  soundsOptions: Array<{ id: number; title: string }>;
  lightChannels: string[];
  scriptEditorInsertDefinitions: ScriptEditorInsertItemDefinition[];
  markdownRef: RefObject<ScriptMarkdownEditorHandle | null>;
  updateSceneField: <K extends keyof ScriptScene>(
    id: number,
    field: K,
    value: ScriptScene[K],
  ) => void;
  onCreateSceneFromSelection?: (
    sourceSceneId: number,
    selectedText: string,
    remainderText: string,
    targetField: "markdown" | "playMarkdown" | "explicationMarkdown",
  ) => void;
};

export function useShowScriptMarkdownInsert(args: UseShowScriptMarkdownInsertArgs) {
  const {
    projectSlug,
    sceneName,
    accessToken,
    currentScene,
    activeMarkdown,
    activeMarkdownField,
    playlistOptions,
    soundsOptions,
    lightChannels,
    scriptEditorInsertDefinitions,
    markdownRef,
    updateSceneField,
    onCreateSceneFromSelection,
  } = args;

  const [insertMenu, setInsertMenu] = useState<{ x: number; y: number } | null>(null);

  const insertIntoActiveMarkdown = useCallback(
    (text: string) => {
      if (!currentScene) return;

      const ed = markdownRef.current;
      const currentValue = ed?.getDoc() ?? String(activeMarkdown ?? "");
      const sel = ed?.getSelection();

      const { value: nextValue, cursor } = insertAtSelection({
        value: currentValue,
        insert: text,
        selectionStart: sel?.from,
        selectionEnd: sel?.to,
      });

      if (ed) {
        ed.applyDocument(nextValue, cursor);
      } else {
        updateSceneField(currentScene.id, activeMarkdownField, nextValue);
      }
    },
    [activeMarkdown, activeMarkdownField, currentScene, markdownRef, updateSceneField],
  );

  useEffect(() => {
    return subscribeScriptTokenizeRequests(({ query, mode }) => {
      if (!currentScene) return { value: String(activeMarkdown ?? ""), count: 0 };

      const ed = markdownRef.current;
      const currentValue = ed?.getDoc() ?? String(activeMarkdown ?? "");
      const selection = ed?.getSelection();
      const result =
        mode === "next"
          ? wrapNextMarkdownMatchAsToken(currentValue, query, selection?.to ?? 0)
          : wrapMarkdownMatchesAsTokens(currentValue, query);

      if (result.count === 0) return result;

      if (ed) {
        const cursor = result.selection?.to ?? selection?.to ?? 0;
        ed.applyDocument(result.value, cursor);
        if (result.selection) {
          ed.setSelection(result.selection.from, result.selection.to);
        }
      } else {
        updateSceneField(currentScene.id, activeMarkdownField, result.value);
      }

      return result;
    });
  }, [activeMarkdown, activeMarkdownField, currentScene, markdownRef, updateSceneField]);

  useEffect(() => {
    return subscribeScriptCollapseBlankLines(() => {
      if (!currentScene) {
        return collapseExtraBlankLines(String(activeMarkdown ?? ""));
      }

      const ed = markdownRef.current;
      const currentValue = ed?.getDoc() ?? String(activeMarkdown ?? "");
      const result = collapseExtraBlankLines(currentValue);

      if (result.value === currentValue) return result;

      if (ed) {
        const selection = ed.getSelection();
        const cursor = Math.min(selection?.to ?? result.value.length, result.value.length);
        ed.applyDocument(result.value, cursor);
      } else {
        updateSceneField(currentScene.id, activeMarkdownField, result.value);
      }

      return result;
    });
  }, [activeMarkdown, activeMarkdownField, currentScene, markdownRef, updateSceneField]);

  useEffect(() => {
    return subscribeScriptMarkdownStyle((action) => {
      const ed = markdownRef.current;
      const currentValue = ed?.getDoc() ?? String(activeMarkdown ?? "");
      const selection = ed?.getSelection() ?? {
        from: currentValue.length,
        to: currentValue.length,
      };
      const result = applyMarkdownStyle(
        currentValue,
        selection.from,
        selection.to,
        action,
      );

      if (!currentScene) return result;

      if (ed) {
        ed.applyDocument(result.value, result.selection.to);
        ed.setSelection(result.selection.from, result.selection.to);
      } else {
        updateSceneField(currentScene.id, activeMarkdownField, result.value);
      }

      return result;
    });
  }, [activeMarkdown, activeMarkdownField, currentScene, markdownRef, updateSceneField]);

  const handleInsertImage = useCallback(async () => {
    if (!currentScene) return;
    const token =
      accessToken ??
      (typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null);
    if (!token) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = false;
    input.onchange = async () => {
      const file = input.files?.[0] ?? null;
      if (!file) return;
      try {
        const project = await ensureProject(token, projectSlug, `Проект ${projectSlug}`);
        const { key } = await uploadProjectFile(token, {
          projectId: project.id,
          type: "image",
          file,
        });
        const alt = file.name.replace(/\.[^.]+$/, "") || "image";
        const snippet = `\n\n![${alt}](orchestra-image:${encodeURIComponent(key)})\n\n`;
        insertIntoActiveMarkdown(snippet);
      } catch (e) {
        console.error("insert image failed:", e);
      }
    };
    input.click();
  }, [accessToken, currentScene, insertIntoActiveMarkdown, projectSlug]);

  const tokenForAssets =
    accessToken ??
    (typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null);

  const insertMenuRows = useMemo(() => {
    if (!insertMenu) return [];
    const ed = markdownRef.current;
    const sel = ed?.getSelection();
    const canCopySelection = Boolean(ed && sel && sel.from !== sel.to);
    const canPasteFromClipboard =
      typeof navigator !== "undefined" &&
      Boolean(navigator.clipboard && typeof navigator.clipboard.readText === "function");
    return buildScriptEditorInsertMenuRows(
      {
        playlistOptions,
        soundsOptions,
        lightChannels,
        activeMarkdown: String(activeMarkdown ?? ""),
        canInsertImage: Boolean(tokenForAssets),
        canCopySelection,
        canPasteFromClipboard,
      },
      scriptEditorInsertDefinitions,
    );
  }, [
    activeMarkdown,
    insertMenu,
    lightChannels,
    markdownRef,
    playlistOptions,
    scriptEditorInsertDefinitions,
    soundsOptions,
    tokenForAssets,
  ]);

  const copyEditorSelection = useCallback(async () => {
    const ed = markdownRef.current;
    if (!ed) return;
    const doc = ed.getDoc();
    const { from, to } = ed.getSelection();
    if (from === to) return;
    const sliceFrom = Math.min(from, to);
    const sliceTo = Math.max(from, to);
    const text = doc.slice(sliceFrom, sliceTo);
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error("copy failed:", e);
    }
  }, [markdownRef]);

  const pasteFromClipboard = useCallback(async () => {
    if (!markdownRef.current) return;
    try {
      const text = await navigator.clipboard.readText();
      insertIntoActiveMarkdown(text);
    } catch (e) {
      console.error("paste failed:", e);
    }
  }, [insertIntoActiveMarkdown, markdownRef]);

  const handleInsertMenuPick = useCallback(
    (pick: ScriptEditorInsertMenuPick) => {
      if (pick.kind === "snippet") {
        insertIntoActiveMarkdown(pick.text);
        return;
      }
      if (pick.kind === "copy-selection") {
        void copyEditorSelection();
        return;
      }
      if (pick.kind === "paste-clipboard") {
        void pasteFromClipboard();
        return;
      }
      if (pick.kind === "create-scene-from-selection") {
        const ed = markdownRef.current;
        if (!ed || !currentScene) return;
        const selection = ed.getSelection();
        if (!selection) return;
        const selectionFrom = Math.min(selection.from, selection.to);
        const selectionTo = Math.max(selection.from, selection.to);
        if (selectionFrom === selectionTo) return;
        const currentValue = ed.getDoc();
        const selectedText = currentValue.slice(selectionFrom, selectionTo);
        if (!selectedText || !onCreateSceneFromSelection) return;
        const { value: remainderText } = insertAtSelection({
          value: currentValue,
          insert: "",
          selectionStart: selectionFrom,
          selectionEnd: selectionTo,
        });
        onCreateSceneFromSelection(
          currentScene.id,
          selectedText,
          remainderText,
          activeMarkdownField as "markdown" | "playMarkdown" | "explicationMarkdown",
        );
        return;
      }
      void handleInsertImage();
    },
    [
      activeMarkdownField,
      copyEditorSelection,
      currentScene,
      handleInsertImage,
      insertIntoActiveMarkdown,
      markdownRef,
      onCreateSceneFromSelection,
      pasteFromClipboard,
    ],
  );

  const handleClipboardImagePaste = useCallback(
    async (event: ClipboardEvent) => {
      const pasted = await pasteProjectImageMarkdownSnippetFromClipboard(event, {
        projectSlug,
        sceneName,
        accessToken,
      });
      if (!pasted) return;
      insertIntoActiveMarkdown(pasted.snippet);
    },
    [accessToken, insertIntoActiveMarkdown, projectSlug, sceneName],
  );

  return {
    insertMenu,
    setInsertMenu,
    insertMenuRows,
    handleInsertMenuPick,
    handleClipboardImagePaste,
    insertIntoActiveMarkdown,
  };
}
