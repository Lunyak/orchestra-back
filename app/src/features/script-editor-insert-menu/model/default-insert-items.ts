import type {
  ScriptEditorInsertItemDefinition,
  ScriptEditorInsertMenuContext,
  ScriptEditorInsertMenuRow,
  ScriptEditorInsertResolveResult,
} from "./types";

export const defaultScriptEditorInsertDefinitions: ScriptEditorInsertItemDefinition[] = [
  {
    id: "copy",
    label: "Копировать",
    group: "Буфер",
    resolve: (ctx): ScriptEditorInsertResolveResult => {
      if (!ctx.canCopySelection) {
        return { state: "disabled", reason: "Выдели текст в редакторе" };
      }
      return { state: "ok", pick: { kind: "copy-selection" } };
    },
  },
  {
    id: "paste",
    label: "Вставить",
    group: "Буфер",
    resolve: (ctx): ScriptEditorInsertResolveResult => {
      if (!ctx.canPasteFromClipboard) {
        return {
          state: "disabled",
          reason: "Вставка из буфера недоступна (нужен HTTPS или разрешение браузера)",
        };
      }
      return { state: "ok", pick: { kind: "paste-clipboard" } };
    },
  },
  {
    id: "selection-to-scene",
    label: "Выделение в новую сцену",
    group: "Буфер",
    resolve: (ctx): ScriptEditorInsertResolveResult => {
      if (!ctx.canCopySelection) {
        return { state: "disabled", reason: "Выдели текст в редакторе" };
      }
      return { state: "ok", pick: { kind: "create-scene-from-selection" } };
    },
  },
  {
    id: "track",
    label: "Трек",
    group: "Оркестр",
    resolve: (ctx): ScriptEditorInsertResolveResult => {
      if (ctx.playlistOptions.length === 0) {
        return { state: "disabled", reason: "В сцене нет треков в плейлисте" };
      }
      return {
        state: "ok",
        submenu: {
          children: ctx.playlistOptions.map((t) => ({
            id: `track:${t.id}`,
            label: t.title,
            pick: {
              kind: "snippet",
              text: `\n\n[${t.title}](track:${t.id})\n\n`,
            },
          })),
        },
      };
    },
  },
  {
    id: "sound",
    label: "Звук",
    group: "Оркестр",
    resolve: (ctx): ScriptEditorInsertResolveResult => {
      if (ctx.soundsOptions.length === 0) {
        return { state: "disabled", reason: "В сцене нет звуков" };
      }
      return {
        state: "ok",
        submenu: {
          children: ctx.soundsOptions.map((s) => ({
            id: `sound:${s.id}`,
            label: s.title,
            pick: {
              kind: "snippet",
              text: `\n\n{{sound:${s.id}|SFX}} [${s.title}](sound:${s.id})\n\n`,
            },
          })),
        },
      };
    },
  },
  {
    id: "light",
    label: "Свет в текст",
    group: "Оркестр",
    resolve: (ctx): ScriptEditorInsertResolveResult => ({
      state: "ok",
      submenu: {
        children: Array.from({ length: Math.max(8, ctx.lightChannels.length) }, (_, i) => {
          const slot = i + 1;
          const label = String(ctx.lightChannels[i] ?? "").split("|", 1)[0]?.trim();
          return {
            id: `light:${slot}`,
            label: label ? `${slot}: ${label}` : `Канал ${slot}`,
            pick: {
              kind: "snippet",
              text: `\n\n{{light:${slot}|${label || "СВЕТ"}}} — канал ${slot}\n\n`,
            },
          };
        }),
      },
    }),
  },
  {
    id: "heading2",
    label: "Заголовок ##",
    group: "Структура",
    resolve: () => ({
      state: "ok",
      pick: { kind: "snippet", text: `\n\n## \n\n` },
    }),
  },
  {
    id: "heading3",
    label: "Заголовок ###",
    group: "Структура",
    resolve: () => ({
      state: "ok",
      pick: { kind: "snippet", text: `\n\n### \n\n` },
    }),
  },
  {
    id: "hr",
    label: "Горизонтальная линия",
    group: "Структура",
    resolve: () => ({
      state: "ok",
      pick: { kind: "snippet", text: `\n\n---\n\n` },
    }),
  },
  {
    id: "bullet",
    label: "Пункт списка",
    group: "Структура",
    resolve: () => ({
      state: "ok",
      pick: { kind: "snippet", text: `\n- ` },
    }),
  },
  {
    id: "label-line",
    label: "Строка-метка (**…**:)",
    group: "Структура",
    resolve: () => ({
      state: "ok",
      pick: { kind: "snippet", text: `\n- **Метка**: ` },
    }),
  },
  {
    id: "image",
    label: "Картинка…",
    group: "Медиа",
    resolve: (ctx) => {
      if (!ctx.canInsertImage) {
        return { state: "disabled", reason: "Нужна авторизация для загрузки файла" };
      }
      return { state: "ok", pick: { kind: "insert-image" } };
    },
  },
];

export function buildScriptEditorInsertMenuRows(
  ctx: ScriptEditorInsertMenuContext,
  definitions: ScriptEditorInsertItemDefinition[] = defaultScriptEditorInsertDefinitions,
): ScriptEditorInsertMenuRow[] {
  const rows: ScriptEditorInsertMenuRow[] = [];
  let lastGroup: string | undefined;

  for (const def of definitions) {
    const resolved = def.resolve(ctx);
    const group = def.group;

    if (group && group !== lastGroup) {
      if (rows.length > 0) rows.push({ type: "separator" });
      lastGroup = group;
    }

    if (resolved.state === "disabled") {
      rows.push({
        type: "item",
        id: def.id,
        label: def.label,
        group,
        disabled: true,
        title: resolved.reason,
      });
      continue;
    }

    if (resolved.state === "ok" && "submenu" in resolved) {
      rows.push({
        type: "submenu",
        id: def.id,
        label: def.label,
        group,
        disabled: false,
        children: resolved.submenu.children,
      });
      continue;
    }

    if (resolved.state === "ok" && "pick" in resolved) {
      rows.push({
        type: "item",
        id: def.id,
        label: def.label,
        group,
        disabled: false,
        pick: resolved.pick,
      });
    }
  }

  return rows;
}

export function mergeInsertDefinitions(
  base: ScriptEditorInsertItemDefinition[],
  extra: ScriptEditorInsertItemDefinition[],
): ScriptEditorInsertItemDefinition[] {
  const seen = new Set(base.map((d) => d.id));
  const merged = base.slice();
  for (const item of extra) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}
