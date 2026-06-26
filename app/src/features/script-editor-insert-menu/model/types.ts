export type ScriptEditorInsertMenuContext = {
  playlistOptions: { id: number; title: string }[];
  soundsOptions: { id: number; title: string }[];
  lightChannels: string[];
  /** Текущий markdown сцены — для нумерации «Картина N». */
  activeMarkdown: string;
  /** Есть ли токен для загрузки картинки. */
  canInsertImage: boolean;
  /** В редакторе есть ненулевое выделение — для «Копировать». */
  canCopySelection: boolean;
  /** Доступен ли чтение буфера (Clipboard API) — для «Вставить». */
  canPasteFromClipboard: boolean;
};

export type ScriptEditorInsertMenuPick =
  | { kind: "snippet"; text: string }
  | { kind: "insert-image" }
  | { kind: "copy-selection" }
  | { kind: "paste-clipboard" }
  | { kind: "create-scene-from-selection" };

export type ScriptEditorInsertSubmenuChild = {
  id: string;
  label: string;
  pick: ScriptEditorInsertMenuPick;
};

export type ScriptEditorInsertResolveResult =
  | { state: "disabled"; reason: string }
  | { state: "ok"; pick: ScriptEditorInsertMenuPick }
  | { state: "ok"; submenu: { children: ScriptEditorInsertSubmenuChild[] } };

export type ScriptEditorInsertItemDefinition = {
  id: string;
  label: string;
  group?: string;
  resolve: (ctx: ScriptEditorInsertMenuContext) => ScriptEditorInsertResolveResult;
};

export type ScriptEditorInsertMenuRow =
  | { type: "separator" }
  | {
      type: "item";
      id: string;
      label: string;
      group?: string;
      disabled: boolean;
      title?: string;
      pick?: ScriptEditorInsertMenuPick;
    }
  | {
      type: "submenu";
      id: string;
      label: string;
      group?: string;
      disabled: boolean;
      title?: string;
      children: ScriptEditorInsertSubmenuChild[];
    };
