import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState } from "@codemirror/state";
import {
  dropCursor,
  EditorView,
  highlightActiveLine,
  keymap,
  placeholder as cmPlaceholder,
} from "@codemirror/view";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { markdownHeadingSectionBlocks } from "./markdownHeadingSectionBlocks";
import { markdownHideKadrAnchors } from "./markdownHideKadrAnchors";
import { markdownParagraphLineGaps } from "./markdownParagraphLineGaps";
import { orchestraEditorRichTokens } from "./orchestraEditorRichTokens";
import { scriptMarkdownEditorSyntaxHighlighting } from "./scriptMarkdownEditorHighlight";

export type ScriptMarkdownEditorHandle = {
  focus: () => void;
  getDoc: () => string;
  getSelection: () => { from: number; to: number };
  setSelection: (anchor: number, head?: number) => void;
  applyDocument: (text: string, cursor: number) => void;
};

type Props = {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  onClipboardImagePaste?: (event: ClipboardEvent) => Promise<void>;
  /** Проект и токен для превью `orchestra-image:` в редакторе. */
  projectSlug?: string;
  accessToken?: string | null;
  /** Каналы света для подписей `{{light:N|…}}` в чипах. */
  lightChannels: string[];
  /** Клик по `[…](track:N)` / `[…](playlist:N)` в редакторе (числовой id). */
  onTrackLinkClick?: (trackId: number) => void;
  /** Карточки секций по `###` (режим notes / play / explication). */
  kadrSectionBlocks?: boolean;
};

/** Тема редактора: токены приложения, без gutter, active line без фона (чипы / inline-превью). */
const scriptMarkdownCodemirrorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "var(--color-bg-primary)",
      color: "var(--color-text-primary)",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-family-script-body)",
      fontSize: "14px",
      lineHeight: "1.5",
      minHeight: "280px",
    },
    ".cm-content": {
      caretColor: "var(--color-text-primary)",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      overflowWrap: "break-word",
    },
    ".cm-line": {
      padding: 0,
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--color-text-primary)",
    },
    ".cm-activeLine": {
      backgroundColor: "inherit",
    },
    ".cm-gutters": { display: "none" },
    ".cm-placeholder": { color: "rgba(148,163,184,0.75)" },
  },
  { dark: true },
);

export const ScriptMarkdownCodemirror = forwardRef<ScriptMarkdownEditorHandle, Props>(
  function ScriptMarkdownCodemirror(
    {
      id,
      value,
      onChange,
      placeholder: ph,
      className,
      onClipboardImagePaste,
      projectSlug,
      accessToken,
      lightChannels,
      onTrackLinkClick,
      kadrSectionBlocks = false,
    },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const lightChannelsRef = useRef(lightChannels);
    lightChannelsRef.current = lightChannels;
    const onTrackLinkClickRef = useRef(onTrackLinkClick);
    onTrackLinkClickRef.current = onTrackLinkClick;
    const imageCtxRef = useRef({ projectSlug: "", accessToken: null as string | null });
    imageCtxRef.current = {
      projectSlug: String(projectSlug ?? ""),
      accessToken: accessToken ?? null,
    };
    const lightChannelsKey = lightChannels.join("\0");
    const imageCtxKey = `${imageCtxRef.current.projectSlug}\0${imageCtxRef.current.accessToken ?? ""}`;
    const kadrSectionBlocksRef = useRef(kadrSectionBlocks);
    kadrSectionBlocksRef.current = kadrSectionBlocks;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const suppressOnChangeRef = useRef(false);
    const onClipboardImagePasteRef = useRef(onClipboardImagePaste);
    onClipboardImagePasteRef.current = onClipboardImagePaste;

    useImperativeHandle(ref, () => ({
      focus: () => {
        viewRef.current?.focus();
      },
      getDoc: () => viewRef.current?.state.doc.toString() ?? "",
      getSelection: () => {
        const view = viewRef.current;
        if (!view) return { from: 0, to: 0 };
        const r = view.state.selection.main;
        return { from: r.from, to: r.to };
      },
      setSelection: (anchor: number, head?: number) => {
        const view = viewRef.current;
        if (!view) return;
        view.focus();
        view.dispatch({
          selection: EditorSelection.single(anchor, head ?? anchor),
          scrollIntoView: true,
        });
      },
      applyDocument: (text: string, cursor: number) => {
        const view = viewRef.current;
        if (!view) return;
        view.focus();
        suppressOnChangeRef.current = true;
        try {
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: text },
            selection: EditorSelection.cursor(Math.max(0, Math.min(text.length, cursor))),
            scrollIntoView: true,
          });
        } finally {
          suppressOnChangeRef.current = false;
        }
      },
    }));

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      const start = String(value ?? "");
      const state = EditorState.create({
        doc: start,
        extensions: [
          history(),
          dropCursor(),
          highlightActiveLine(),
          EditorView.lineWrapping,
          markdownParagraphLineGaps,
          markdownHeadingSectionBlocks(() => kadrSectionBlocksRef.current),
          markdownHideKadrAnchors(() => kadrSectionBlocksRef.current),
          bracketMatching(),
          indentOnInput(),
          markdown(),
          scriptMarkdownEditorSyntaxHighlighting,
          orchestraEditorRichTokens(
            () => lightChannelsRef.current,
            () => onTrackLinkClickRef.current,
            () => imageCtxRef.current,
          ),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          ph ? cmPlaceholder(ph) : [],
          EditorView.domEventHandlers({
            paste: (event) => {
              if (!onClipboardImagePasteRef.current) return false;
              const items = Array.from(event.clipboardData?.items ?? []);
              if (!items.some((it) => it.type.startsWith("image/"))) return false;
              event.preventDefault();
              void onClipboardImagePasteRef.current(event);
              return true;
            },
          }),
          scriptMarkdownCodemirrorTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !suppressOnChangeRef.current) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      });

      const view = new EditorView({ state, parent: host });
      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once; parent remounts via key on step/field
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({});
    }, [kadrSectionBlocks]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const cur = view.state.doc.toString();
      const next = String(value ?? "");
      if (cur === next) return;
      suppressOnChangeRef.current = true;
      try {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: next },
          selection: EditorSelection.cursor(0),
          scrollIntoView: true,
        });
      } finally {
        suppressOnChangeRef.current = false;
      }
    }, [value]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const sel = view.state.selection;
      view.dispatch({ selection: sel });
    }, [lightChannelsKey]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const sel = view.state.selection;
      view.dispatch({ selection: sel });
    }, [imageCtxKey]);

    return (
      <div
        ref={hostRef}
        id={id}
        className={["script-markdown-cm", className].filter(Boolean).join(" ")}
      />
    );
  },
);
