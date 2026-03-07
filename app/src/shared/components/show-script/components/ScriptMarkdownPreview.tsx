import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { fetchProjectRolesThunk, selectProjectRoles } from "../../../../features/profile/model/profileRolesSlice";
import type { SceneRolesDataV1 } from "../../../../features/scene";
import {
  selectActiveStepMarkdownContext,
  selectAnnotations,
  selectShowScriptMarkdownUi,
} from "../../../../features/show-script-markdown/model/show-script-markdown-slice";
import type { ActorAnnotation } from "../../../../sync/api";
import { getPlayUrl } from "../../../../sync/api";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import {
  ActorAnnotationsPopover,
  type NewAnnotationDraft,
} from "../annotations/ActorAnnotationsPopover";
import { rehypeActorAnnotations } from "../annotations/rehypeActorAnnotations";
import { useAnnotationsPopoverPosition } from "../hooks/useAnnotationsPopoverPosition";
import {
  createRehypeScriptTokens,
  createRenderLightTokens,
} from "../utils/lightTokens";

const EMPTY_ANNOTATIONS: ActorAnnotation[] = [];

const LINE_LABEL_CLASSNAMES = new Set([
  "markdown-speaker-label", // roles: [[ЕЛЕНА]]
  "markdown-light-chip", // lights: {{light:1}}
  "markdown-play-label", // music: {{play:123}}
]);

type LineLabelKind = "role" | "light" | "play";

function markdownHasRoleLightOrPlayLineLabels(markdown: string): boolean {
  const raw = String(markdown ?? "");
  if (!raw.trim()) return false;
  // Avoid false-positives from examples in code fences.
  const withoutCodeFences = raw.replace(/```[\s\S]*?```/g, "");

  // We treat "line labels" as tokens that are typically placed at the beginning of a paragraph.
  // - roles: [[ЕЛЕНА]]
  // - lights: {{light:1}} / {{blackout}}
  // - play: {{play:123}}
  const re =
    /(^|\n)\s*(\[\[\s*[^\]]+?\s*]]|\{\{\s*(?:light|blackout|play)\b[^}]*}})/i;
  return re.test(withoutCodeFences);
}

function isIgnorableLeadingNode(node: React.ReactNode): boolean {
  if (node == null || typeof node === "boolean") return true;
  if (typeof node === "string") {
    // Treat NBSP / ZWSP as whitespace too
    return /^[\s\u00A0\u200B\u200C\u200D\uFEFF]*$/.test(node);
  }
  if (React.isValidElement(node)) {
    return node.type === "br";
  }
  return false;
}

function isLineLabelElement(node: unknown): node is React.ReactElement {
  if (!React.isValidElement(node)) return false;
  const className = (node.props as any)?.className;
  if (typeof className === "string") {
    for (const part of className.split(/\s+/)) {
      if (LINE_LABEL_CLASSNAMES.has(part)) return true;
    }
    return false;
  }
  if (Array.isArray(className)) return className.some((c) => LINE_LABEL_CLASSNAMES.has(String(c)));
  return false;
}

function getLineLabelKind(el: React.ReactElement): LineLabelKind | null {
  const className = (el.props as any)?.className;
  const parts =
    typeof className === "string"
      ? className.split(/\s+/)
      : Array.isArray(className)
        ? className.map((c) => String(c))
        : [];
  if (parts.includes("markdown-speaker-label")) return "role";
  if (parts.includes("markdown-light-chip")) return "light";
  if (parts.includes("markdown-play-label")) return "play";
  return null;
}

type TrackLinkPayload = { id: number } | { name: string };

function getLeadingTrackPayload(children: React.ReactNode): TrackLinkPayload | null {
  const flat = flattenInertSpans(React.Children.toArray(children));
  let i = 0;
  while (i < flat.length) {
    const n = flat[i];
    if (isIgnorableLeadingNode(n)) {
      i += 1;
      continue;
    }
    break;
  }
  const candidate = flat[i];
  if (!React.isValidElement(candidate)) return null;
  const className = (candidate.props as any)?.className;
  const classStr = Array.isArray(className) ? className.join(" ") : String(className ?? "");
  if (!/\bmarkdown-track-link\b/.test(classStr)) return null;
  const rawId = (candidate.props as any)?.["data-track-id"];
  const rawName = (candidate.props as any)?.["data-track-name"];
  const id = Number(rawId);
  if (Number.isFinite(id) && id > 0) return { id };
  const name = String(rawName ?? "").trim();
  if (name) return { name };
  return null;
}

function flattenInertSpans(nodes: React.ReactNode[]): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  for (const n of nodes) {
    if (
      React.isValidElement(n) &&
      (n.type === "span" || n.type === React.Fragment) &&
      n.props &&
      (n.props as any).className == null &&
      (n.props as any).style == null &&
      (n.props as any).title == null &&
      (n.props as any).id == null
    ) {
      out.push(...flattenInertSpans(React.Children.toArray((n.props as any).children)));
      continue;
    }
    out.push(n);
  }
  return out;
}

function splitLeadingLineLabel(
  children: React.ReactNode,
): {
  label: React.ReactElement | null;
  rest: React.ReactNode[];
  kind: LineLabelKind | null;
} {
  const flat = flattenInertSpans(React.Children.toArray(children));
  let i = 0;
  while (i < flat.length) {
    const n = flat[i];
    if (isIgnorableLeadingNode(n)) {
      i += 1;
      continue;
    }
    break;
  }
  const candidate = flat[i];
  if (!isLineLabelElement(candidate)) {
    return { label: null, rest: flat, kind: null };
  }
  const rest = flat.slice(i + 1);
  return { label: candidate, rest, kind: getLineLabelKind(candidate) };
}

function normalizeRoleToken(v: string) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

export function ScriptMarkdownPreview({
  projectName,
  sceneName = "script",
  onTrackLinkClick,
  onCreateAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  newAnnotation,
  setNewAnnotation,
  activeAnnotationId,
  setActiveAnnotationId,
}: {
  projectName: string;
  sceneName?: string;
  onTrackLinkClick?: (trackId: number) => void;
  onCreateAnnotation: (draft: NewAnnotationDraft) => Promise<void>;
  onUpdateAnnotation: (id: string, noteText: string) => Promise<void>;
  onDeleteAnnotation: (id: string) => Promise<void>;
  newAnnotation: NewAnnotationDraft | null;
  setNewAnnotation: React.Dispatch<React.SetStateAction<NewAnnotationDraft | null>>;
  activeAnnotationId: string | null;
  setActiveAnnotationId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const ui = useAppSelector((s) => selectShowScriptMarkdownUi(s, projectName, sceneName));
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const roles = useAppSelector(selectProjectRoles);
  const sceneData = useAppSelector((s) => (s as any).scene?.sceneData ?? null) as any;
  const { activeMarkdown: markdown, currentStep, activeField } = useAppSelector((s) =>
    selectActiveStepMarkdownContext(s, projectName, sceneName),
  );
  const annotations = useAppSelector((s) => {
    if (currentStep?.id == null) return EMPTY_ANNOTATIONS;
    const cacheKey = `${projectName}:${sceneName}:${currentStep.id}:${activeField}`;
    return selectAnnotations(s, cacheKey).items;
  });
  const annotationsMode = ui.annotationsMode;
  const playlistOptions = ui.playlistOptions;
  const lightChannels = ui.lightChannels;

  useEffect(() => {
    if (!accessToken || !projectName) return;
    void dispatch(fetchProjectRolesThunk({ accessToken, projectName }));
  }, [accessToken, projectName, dispatch]);

  const imageUrlCacheRef = useRef(new Map<string, string>());

  const { rootRef, popoverRef, position, setAnchorFromRect, requestClose } =
    useAnnotationsPopoverPosition({
      enabled: annotationsMode,
      activeAnnotationId,
      isOpen: Boolean(newAnnotation || activeAnnotationId),
    });

  const resolveImageSrc = (src?: string) => {
    if (!src) return src;

    let path = src.trim().replace(/^\.?\//, "");

    if (!path.startsWith("images/")) {
      return src;
    }

    path = path.replace(/^images\//, "").replace(/^\/+/, "");

    const pathSegments = path.split("/").map((segment) => encodeURIComponent(segment));
    const encodedPath = pathSegments.join("/");

    let projectId: string | null = null;
    if (typeof window !== "undefined") {
      try {
        projectId = window.localStorage.getItem(`projectId:${projectName}`);
      } catch {
        // ignore
      }
    }

    const baseUrl = new URL(`project-images://${encodeURIComponent(projectName)}/`);
    baseUrl.pathname = projectId
      ? `/${encodeURIComponent(projectId)}/${encodedPath}`
      : `/${encodedPath}`;

    return baseUrl.toString();
  };

  const resolveRemoteImageUrl = async (key: string): Promise<string | null> => {
    const cached = imageUrlCacheRef.current.get(key);
    if (cached) return cached;
    const token =
      accessToken ??
      (typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null);
    if (!token) return null;
    try {
      const { url } = await getPlayUrl(token, key);
      if (url) imageUrlCacheRef.current.set(key, url);
      return url ?? null;
    } catch {
      return null;
    }
  };

  const MarkdownImage = (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    const { src, alt, ...rest } = props;
    const raw = String(src ?? "").trim();
    const initial =
      raw.startsWith("orchestra-image:") ? "" : (resolveImageSrc(raw) || raw);
    const [resolved, setResolved] = useState<string>(initial);

    useEffect(() => {
      let cancelled = false;
      const run = async () => {
        const s = String(src ?? "").trim();
        if (!s) return;
        if (s.startsWith("orchestra-image:")) {
          const encoded = s.replace(/^orchestra-image:/i, "").trim();
          const key = decodeURIComponent(encoded);
          const url = await resolveRemoteImageUrl(key);
          if (!cancelled && url) setResolved(url);
          return;
        }
        // local images/ path
        const local = resolveImageSrc(s);
        if (!cancelled) setResolved(local || s);
      };
      void run();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src, accessToken]);

    return (
      <img
        src={resolved}
        alt={alt || ""}
        style={{
          maxHeight: 800,
          maxWidth: "100%",
          height: "auto",
        }}
        {...rest}
      />
    );
  };

  const urlTransform = (url: string) => {
    const trimmed = url.trim().toLowerCase();
    if (trimmed.startsWith("javascript:")) {
      return "";
    }
    return url;
  };

  const normalizeTrackName = (value: string) => {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1).trim();
    }
    return trimmed;
  };

  const resolveTrackLink = (href?: string) => {
    if (!href) return null;
    const trimmed = href.trim();
    if (trimmed.startsWith("track:")) {
      const payload = trimmed.replace(/^track:/i, "").trim();
      const id = Number(payload);
      if (Number.isFinite(id)) {
        return { id };
      }
      return payload ? { name: normalizeTrackName(payload) } : null;
    }
    if (trimmed.startsWith("playlist:")) {
      const payload = trimmed.replace(/^playlist:/i, "").trim();
      const id = Number(payload);
      if (Number.isFinite(id)) {
        return { id };
      }
      return payload ? { name: normalizeTrackName(payload) } : null;
    }
    return null;
  };

  const isAudioLink = (href?: string) => {
    if (!href) return false;
    return /\.(mp3|wav|ogg|m4a|flac)$/i.test(href.trim());
  };

  const renderLightTokens = useMemo(
    () => createRenderLightTokens(lightChannels),
    [lightChannels],
  );
  const rehypeScriptTokens = useMemo(
    () => createRehypeScriptTokens(lightChannels),
    [lightChannels],
  );

  const hasRoleOrLightLabels = useMemo(
    () => markdownHasRoleLightOrPlayLineLabels(markdown || ""),
    [markdown],
  );

  const playFromPayload = (payload: TrackLinkPayload) => {
    if (!onTrackLinkClick) return;
    if ("id" in payload) {
      onTrackLinkClick(Number(payload.id));
      return;
    }
    const name = String(payload.name ?? "").trim();
    if (!name) return;
    const fromCache = playlistOptions.find(
      (item) =>
        String(item?.title ?? "").toLowerCase() === name.toLowerCase(),
    );
    if (fromCache?.id != null) {
      onTrackLinkClick(Number(fromCache.id));
    }
  };

  const rangeTextLength = (range: Range) => {
    const fragment = range.cloneContents();
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
    let len = 0;
    while (walker.nextNode()) {
      len += (walker.currentNode.nodeValue ?? "").length;
    }
    return len;
  };

  const computeRenderedOffset = (
    root: HTMLElement,
    range: Range,
    atStart: boolean,
  ) => {
    const pointRange = document.createRange();
    pointRange.selectNodeContents(root);
    if (atStart) {
      pointRange.setEnd(range.startContainer, range.startOffset);
    } else {
      pointRange.setEnd(range.endContainer, range.endOffset);
    }
    return rangeTextLength(pointRange);
  };

  const handleMarkdownMouseUp = () => {
    if (!annotationsMode) return;
    const root = rootRef.current;
    if (!root) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    if (!root.contains(range.commonAncestorContainer)) return;

    const anchorRect = range.getBoundingClientRect();
    const start = computeRenderedOffset(root, range, true);
    const end = computeRenderedOffset(root, range, false);
    const s = Math.min(start, end);
    const e = Math.max(start, end);
    const selectedText = String(sel.toString() ?? "").trim();
    if (!selectedText) return;

    setAnchorFromRect(anchorRect);
    setNewAnnotation({ start: s, end: e, selectedText, noteText: "" });
    setActiveAnnotationId(null);
  };

  const resolveRoleIdFromToken = (token: string): string | null => {
    const t = normalizeRoleToken(token);
    if (!t) return null;
    const exactTitle = roles.find((r) => normalizeRoleToken(String((r as any)?.title ?? "")) === t) ?? null;
    if (exactTitle) return String((exactTitle as any).id);
    const exactKey = roles.find((r) => normalizeRoleToken(String((r as any)?.key ?? "")) === t) ?? null;
    if (exactKey) return String((exactKey as any).id);
    const byAlias =
      roles.find((r) =>
        (Array.isArray((r as any)?.aliases) ? (r as any).aliases : []).some(
          (a: any) => normalizeRoleToken(String(a ?? "")) === t,
        ),
      ) ?? null;
    if (byAlias) return String((byAlias as any).id);
    return null;
  };

  const isRoleAttachedToCurrentStep = (roleId: string): boolean => {
    if (!currentStep?.id) return false;
    const sr = (sceneData as any)?.sceneRoles as SceneRolesDataV1 | undefined;
    if (!sr || (sr as any).v !== 1) return false;
    const stepMap = (sr as any).byStepId?.[String(currentStep.id)];
    if (!stepMap || typeof stepMap !== "object") return false;
    return Boolean(stepMap[String(roleId)]);
  };

  const handleSpeakerLabelClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && String(sel.toString() ?? "").trim()) {
      return; // allow text selection without navigation
    }
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const playEl = target.closest?.(".markdown-play-label") as HTMLElement | null;
    if (playEl && onTrackLinkClick) {
      const rawId = playEl.getAttribute("data-track-id");
      const rawName = playEl.getAttribute("data-track-name");
      const id = Number(rawId);
      if (Number.isFinite(id) && id > 0) {
        e.preventDefault();
        e.stopPropagation();
        playFromPayload({ id });
        return;
      }
      const name = String(rawName ?? "").trim();
      if (name) {
        e.preventDefault();
        e.stopPropagation();
        playFromPayload({ name });
        return;
      }
    }

    const el = target.closest?.(".markdown-speaker-label") as HTMLElement | null;
    if (!el) return;
    const token = String(el.getAttribute("title") ?? "").trim();
    if (!token) return;
    const roleId = resolveRoleIdFromToken(token);
    if (!roleId) return;
    if (!isRoleAttachedToCurrentStep(roleId)) return;
    e.preventDefault();
    e.stopPropagation();
    navigate(`/role-workbook/${encodeURIComponent(roleId)}`);
  };

  return (
    <div
      className={
        hasRoleOrLightLabels
          ? "markdown-preview markdown-preview--has-line-labels"
          : "markdown-preview"
      }
    >
      <div
        ref={rootRef}
        onClick={handleSpeakerLabelClick}
        onMouseUp={annotationsMode ? handleMarkdownMouseUp : undefined}
      >
        <div className="script-step-title">{currentStep?.title}</div>
        <ReactMarkdown
          urlTransform={urlTransform}
          rehypePlugins={
            annotationsMode
              ? [
                rehypeScriptTokens,
                [rehypeActorAnnotations, { annotations, activeId: activeAnnotationId }],
              ]
              : []
          }
          components={{
            p: ({ children }: { children: React.ReactNode }) => {
              const rendered = renderLightTokens(children);
              const { label, rest, kind } = splitLeadingLineLabel(rendered);
              const leadingTrack = onTrackLinkClick ? getLeadingTrackPayload(rendered) : null;
              if (!label) {
                if (leadingTrack) {
                  const alignClass = hasRoleOrLightLabels
                    ? "markdown-dialog-line--track-align"
                    : "markdown-dialog-line--track-compact";
                  return (
                    <p className={`markdown-dialog-line markdown-dialog-line--label-track ${alignClass}`}>
                      <span className="markdown-dialog-label" aria-hidden="true">
                        <button
                          type="button"
                          className="markdown-track-play"
                          title="Воспроизвести"
                          onClick={() => playFromPayload(leadingTrack)}
                        >
                          ▶
                        </button>
                      </span>
                      <span className="markdown-dialog-text">{rendered}</span>
                    </p>
                  );
                }

                if (!hasRoleOrLightLabels) {
                  return <p>{rendered}</p>;
                }
                return (
                  <p className="markdown-dialog-line markdown-dialog-line--no-label">
                    <span className="markdown-dialog-label" aria-hidden="true" />
                    <span className="markdown-dialog-text">{rendered}</span>
                  </p>
                );
              }
              const kindClass =
                kind === "light"
                  ? "markdown-dialog-line--label-light"
                  : kind === "play"
                    ? "markdown-dialog-line--label-play"
                  : "markdown-dialog-line--label-role";
              return (
                <p className={`markdown-dialog-line ${kindClass}`}>
                  <span className="markdown-dialog-label">{label}</span>
                  <span className="markdown-dialog-text">{rest}</span>
                </p>
              );
            },
            li: ({ children }: { children: React.ReactNode }) => (
              <li>{renderLightTokens(children)}</li>
            ),
            h1: ({ children }: { children: React.ReactNode }) => (
              <h1>{renderLightTokens(children)}</h1>
            ),
            h2: ({ children }: { children: React.ReactNode }) => (
              <h2>{renderLightTokens(children)}</h2>
            ),
            h3: ({ children }: { children: React.ReactNode }) => (
              <h3>{renderLightTokens(children)}</h3>
            ),
            h4: ({ children }: { children: React.ReactNode }) => (
              <h4>{renderLightTokens(children)}</h4>
            ),
            h5: ({ children }: { children: React.ReactNode }) => (
              <h5>{renderLightTokens(children)}</h5>
            ),
            h6: ({ children }: { children: React.ReactNode }) => (
              <h6>{renderLightTokens(children)}</h6>
            ),
            blockquote: ({ children }: { children: React.ReactNode }) => (
              <blockquote>{renderLightTokens(children)}</blockquote>
            ),
            td: ({ children }: { children: React.ReactNode }) => (
              <td>{renderLightTokens(children)}</td>
            ),
            th: ({ children }: { children: React.ReactNode }) => (
              <th>{renderLightTokens(children)}</th>
            ),
            a: ({
              href,
              children,
              ...rest
            }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
              const resolved = resolveTrackLink(href);
              if (resolved && onTrackLinkClick) {
                return (
                  <button
                    type="button"
                    className="markdown-track-link"
                    data-track-id={"id" in resolved ? String(resolved.id) : undefined}
                    data-track-name={"name" in resolved ? String(resolved.name) : undefined}
                    onClick={async () => {
                      if ("id" in resolved) {
                        onTrackLinkClick(Number(resolved.id));
                        return;
                      }
                      if ("name" in resolved) {
                        playFromPayload({ name: String(resolved.name) });
                      }
                    }}
                  >
                    {children}
                  </button>
                );
              }
              if (isAudioLink(href)) {
                return (
                  <a
                    href={href}
                    className="markdown-track-link markdown-audio-link"
                    {...rest}
                  >
                    {children}
                  </a>
                );
              }
              return (
                <a href={href} {...rest}>
                  {children}
                </a>
              );
            },
            img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
              <MarkdownImage {...props} />
            ),
            mark: ({ node, children, ...rest }: any) => {
              const id = (node as any)?.properties?.["data-anno-id"] as
                | string
                | undefined;
              return (
                <mark
                  {...rest}
                  onClick={(e) => {
                    if (!id) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setAnchorFromRect(
                      (e.currentTarget as HTMLElement).getBoundingClientRect(),
                    );
                    setActiveAnnotationId((prev) => (prev === id ? null : id));
                    setNewAnnotation(null);
                  }}
                >
                  {children}
                </mark>
              );
            },
          }}
        >
          {markdown || "*Пусто*"}
        </ReactMarkdown>
      </div>

      {annotationsMode ? (
        <ActorAnnotationsPopover
          position={position}
          popoverRef={popoverRef}
          newAnnotation={newAnnotation}
          setNewAnnotation={setNewAnnotation}
          activeAnnotationId={activeAnnotationId}
          setActiveAnnotationId={setActiveAnnotationId}
          annotations={annotations}
          onCreate={onCreateAnnotation}
          onUpdate={onUpdateAnnotation}
          onDelete={onDeleteAnnotation}
          onRequestClose={requestClose}
        />
      ) : null}
    </div>
  );
}

