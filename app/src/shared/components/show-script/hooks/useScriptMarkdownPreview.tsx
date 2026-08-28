import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import type { PluggableList } from "unified";
import { useProjectRolesQuery } from "../../../../features/project/api/project-api";
import {
  selectActiveSceneMarkdownContext,
  selectShowScriptMarkdownUi,
} from "../../../../features/show-script-markdown/model/show-script-markdown-slice";
import { useSceneActorAnnotations } from "../../../../features/show-script-markdown/model/use-scene-actor-annotations";
import { useAppSelector } from "../../../store/hooks";
import type { NewAnnotationDraft } from "../annotations/ActorAnnotationsPopover";
import { rehypeActorAnnotations } from "../annotations/rehypeActorAnnotations";
import { useAnnotationsPopoverPosition } from "./useAnnotationsPopoverPosition";
import {
  createRehypeScriptTokens,
  createRenderLightTokens,
} from "../utils/lightTokens";
import { expandKadrLabelBlockBreaks } from "../utils/expandKadrLabelBlockBreaks";
import { rehypeKadrSections } from "../utils/rehypeKadrSections";
import {
  type MarkdownKadrMediaLookup,
} from "../components/markdown-kadr-media-context";
import { rehypeStripLightKadrAnchors } from "../utils/rehypeStripLightKadrAnchors";
import { resolveLightFaders } from "../../light-console/light-console-data";
import { buildLightSchemeLookModel } from "../../light-console/light-scheme-preview";
import { applyKadrProjector } from "../../../../features/spectacle-run/model/apply-kadr-projector";
import { openProjectorWindow } from "../../../../features/projector/model/projector-playback-bridge";
import { LightSchemeLookCard } from "../../light-console/LightSchemeLookCard";
import {
  findKadrById,
  fadersForKadrDisplay,
  readSceneLightKadrs,
  scanMarkdownKadrSections,
} from "../../../../features/theater/model/light-kadrs";
import type { PlaylistPlayOptions } from "../../../../features/playbook/model/playbook-playback-bridge";
import "../../light-console/light-console.css";
import { isInteractiveMarkdownPreviewTarget } from "../components/markdown-preview-components";
import { normalizeRoleToken } from "../components/markdown-preview-kadr-parsing";
import {
  expandScriptLineParagraphBreaks,
  injectNbspParagraphsForTripleNewlines,
  markdownHasRoleLightOrPlayLineLabels,
  protectRoleLabelParentheticals,
} from "../components/markdown-preview-normalize";
import type {
  MarkdownLightboxState,
  MarkdownPreviewImageContextValue,
  MarkdownPreviewParagraphProps,
  SoundLinkPayload,
  TrackLinkPayload,
  VideoLinkPayload,
} from "../components/markdown-preview-types";
import { collectLightboxSlidesFromPreviewRoot } from "../components/MarkdownPreviewImage";
import {
  isAudioLink,
  normalizeTrackName,
  resolveHoldLink,
  resolveSoundLink,
  resolveTrackLink,
  resolveVideoLink,
  urlTransform,
} from "../components/markdown-preview-link-resolvers";

export type ScriptMarkdownPreviewProps = {
  projectName: string;
  sceneName?: string;
  onTrackLinkClick?: (trackId: number, options?: PlaylistPlayOptions) => void;
  onSoundLinkClick?: (soundId: number) => void;
  onCreateAnnotation: (draft: NewAnnotationDraft) => Promise<void>;
  onUpdateAnnotation: (id: string, noteText: string) => Promise<void>;
  onDeleteAnnotation: (id: string) => Promise<void>;
  newAnnotation: NewAnnotationDraft | null;
  setNewAnnotation: React.Dispatch<React.SetStateAction<NewAnnotationDraft | null>>;
  activeAnnotationId: string | null;
  setActiveAnnotationId: React.Dispatch<React.SetStateAction<string | null>>;
  /** Режим чтения: клик по тексту (не по кнопкам/ссылкам) включает редактирование. */
  readModeActivateEdit?: () => void;
  showSceneTitle?: boolean;
  isModeEditing?: boolean;
  onToggleModeEditing?: () => void;
};

export function useScriptMarkdownPreview({
  projectName,
  sceneName = "script",
  onTrackLinkClick,
  onSoundLinkClick,
  onCreateAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  newAnnotation,
  setNewAnnotation,
  activeAnnotationId,
  setActiveAnnotationId,
  readModeActivateEdit,
  showSceneTitle = true,
  isModeEditing = false,
  onToggleModeEditing,
}: ScriptMarkdownPreviewProps) {
  const navigate = useNavigate();
  const ui = useAppSelector((s) => selectShowScriptMarkdownUi(s, projectName, sceneName));
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const { data: rolesRes } = useProjectRolesQuery(projectName, {
    skip: !accessToken || !projectName,
  });
  const roles = rolesRes?.roles ?? [];
  const playbookData = useAppSelector((s) => s.playbook.playbookData);
  const { activeMarkdown: markdown, currentScene, activeField } = useAppSelector((s) =>
    selectActiveSceneMarkdownContext(s, projectName, sceneName),
  );
  const annotationsLoadEnabled = ui.markdownMode !== "comments";
  const { items: annotations } = useSceneActorAnnotations({
    projectSlug: projectName,
    sceneName,
    sceneId: currentScene?.id,
    field: activeField,
    enabled: annotationsLoadEnabled,
  });
  const annotationsMode = ui.annotationsMode;

  const markdownForPreview = useMemo(() => {
    const expanded = expandScriptLineParagraphBreaks(
      String(markdown ?? ""),
      annotationsMode,
      annotations.length,
    );
    const withKadrBreaks = expandKadrLabelBlockBreaks(expanded);
    const withProtectedRemarks = protectRoleLabelParentheticals(withKadrBreaks);
    if (annotationsMode && annotations.length > 0) return withProtectedRemarks;
    return injectNbspParagraphsForTripleNewlines(withProtectedRemarks);
  }, [markdown, annotationsMode, annotations.length]);

  const onReadModePointerDown = (e: React.PointerEvent) => {
    if (!readModeActivateEdit) return;
    if (annotationsMode && e.detail < 2) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (isInteractiveMarkdownPreviewTarget(e.target)) return;
    readModeActivateEdit();
  };
  const markdownMode = ui.markdownMode;
  const playlistOptions = ui.playlistOptions;
  const soundsOptions = ui.soundsOptions;
  const soundsOptionsRef = useRef(soundsOptions);
  soundsOptionsRef.current = soundsOptions;
  const lightChannels = ui.lightChannels;

  const [lightbox, setLightbox] = useState<MarkdownLightboxState | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightbox(null);
        return;
      }
      if (lightbox.slides.length <= 1) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setLightbox((prev) =>
          !prev || prev.slides.length <= 1
            ? prev
            : { ...prev, index: (prev.index + 1) % prev.slides.length },
        );
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setLightbox((prev) =>
          !prev || prev.slides.length <= 1
            ? prev
            : {
                ...prev,
                index: (prev.index - 1 + prev.slides.length) % prev.slides.length,
              },
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox]);

  const imageUrlCacheRef = useRef(new Map<string, string>());

  const { rootRef, popoverRef, position, setAnchorFromRect, requestClose } =
    useAnnotationsPopoverPosition({
      enabled: annotationsMode,
      activeAnnotationId,
      isOpen: Boolean(newAnnotation || activeAnnotationId),
    });

  const openLightbox = useCallback((src: string, alt: string) => {
    const slides = collectLightboxSlidesFromPreviewRoot(rootRef.current);
    if (slides.length === 0) {
      setLightbox({ slides: [{ src, alt }], index: 0 });
      return;
    }
    const idx = slides.findIndex((s) => s.src === src);
    setLightbox({ slides, index: idx >= 0 ? idx : 0 });
  }, []);

  const [dialogLabelSlotPx, setDialogLabelSlotPx] = useState<number | null>(null);
  const dialogLabelSlotPxRef = useRef<number | null>(null);

  const resolveImageSrc = useCallback(
    (src?: string) => {
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
    },
    [projectName],
  );

  const resolveSoundIconSrc = useCallback(
    (iconFile: string) => {
      const safe = String(iconFile ?? "").trim();
      if (!safe) return "";
      let projectId: string | null = null;
      if (typeof window !== "undefined") {
        try {
          projectId = window.localStorage.getItem(`projectId:${projectName}`);
        } catch {
          // ignore
        }
      }
      const url = new URL(`project-sound-icons://${encodeURIComponent(projectName)}/`);
      const encodedFile = encodeURIComponent(safe);
      url.pathname = projectId
        ? `/${encodeURIComponent(projectId)}/${encodedFile}`
        : `/${encodedFile}`;
      return url.toString();
    },
    [projectName],
  );

  // soundsOptions из Redux часто новый [] по ссылке → без ref контекст картинок меняется каждый рендер и play-url дергается снова.
  const resolveSoundIconFromPayload = useCallback(
    (payload: SoundLinkPayload): string | null => {
      const opts = soundsOptionsRef.current;
      const byId =
        "id" in payload
          ? opts.find((s) => Number(s?.id) === Number(payload.id)) ?? null
          : null;
      const byName =
        "name" in payload
          ? opts.find(
              (s) =>
                String(s?.title ?? "").toLowerCase() ===
                String(payload.name ?? "").toLowerCase(),
            ) ?? null
          : null;
      const sound = byId ?? byName;
      if (!sound) return null;
      const remote = String(sound.iconRemoteUrl ?? "").trim();
      if (remote && /^https?:\/\//i.test(remote)) return remote;
      const icon = String(sound.icon ?? "").trim();
      if (icon) return resolveSoundIconSrc(icon);
      return null;
    },
    [resolveSoundIconSrc],
  );

  const markdownPreviewImageCtx = useMemo<MarkdownPreviewImageContextValue>(
    () => ({
      accessToken,
      playUrlCache: imageUrlCacheRef,
      resolveImageSrc,
      resolveSoundIconFromPayload,
      openLightbox,
    }),
    [accessToken, resolveImageSrc, resolveSoundIconFromPayload, openLightbox],
  );

  const kadrMediaLookup = useMemo<MarkdownKadrMediaLookup>(
    () => ({
      projectSlug: projectName,
      videos: Array.isArray(playbookData?.videos) ? playbookData.videos : [],
      holdImages: Array.isArray(playbookData?.holdImages) ? playbookData.holdImages : [],
      projector: playbookData?.projector ?? null,
    }),
    [projectName, playbookData?.videos, playbookData?.holdImages, playbookData?.projector],
  );

  const playVideoFromPayload = useCallback(
    (payload: VideoLinkPayload) => {
      const videoId = Math.trunc(Number(payload.id) || 0);
      if (videoId <= 0) return;
      openProjectorWindow();
      applyKadrProjector(
        { mode: "video", videoId },
        {
          projectSlug: projectName,
          videos: playbookData?.videos,
          holdImages: playbookData?.holdImages,
          projector: playbookData?.projector ?? null,
        },
      );
    },
    [projectName, playbookData?.videos, playbookData?.holdImages, playbookData?.projector],
  );

  const playHoldFromPayload = useCallback(
    (holdId?: number | null) => {
      openProjectorWindow();
      const resolvedId =
        holdId != null && Math.trunc(Number(holdId) || 0) > 0
          ? Math.trunc(Number(holdId))
          : undefined;
      applyKadrProjector(
        resolvedId != null ? { mode: "hold", holdId: resolvedId } : { mode: "hold" },
        {
          projectSlug: projectName,
          videos: playbookData?.videos,
          holdImages: playbookData?.holdImages,
          projector: playbookData?.projector ?? null,
        },
      );
    },
    [projectName, playbookData?.videos, playbookData?.holdImages, playbookData?.projector],
  );

  const markdownKadrSections = useMemo(
    () => scanMarkdownKadrSections(markdownForPreview),
    [markdownForPreview],
  );
  const markdownKadrIdLookups = useMemo(
    () => markdownKadrSections.map((s) => ({ kadrNo: s.kadrNo, id: s.id })),
    [markdownKadrSections],
  );
  const kadrBlackoutIds = useMemo(
    () =>
      readSceneLightKadrs(currentScene)
        .kadrs.filter((k) => k.blackout)
        .map((k) => k.id),
    [currentScene],
  );

  const renderLightPanel = useCallback(
    (kadrId: string) => {
      const kadrs = readSceneLightKadrs(currentScene);
      const kadr = findKadrById(kadrs, kadrId);
      if (!kadr) return null;
      const section = markdownKadrSections.find((s) => s.id === kadrId) ?? null;
      const baseFaders = resolveLightFaders(playbookData?.lightFaders);
      const displayFaders = fadersForKadrDisplay(kadr, baseFaders);
      const lightPlot = currentScene?.lightPlot ?? [];
      const lookModel = buildLightSchemeLookModel({
        kadr,
        sectionTitle: section?.headingTitle,
        lightPlot,
        lightChannels,
        lightFaders: displayFaders,
        lightPrograms: playbookData?.lightPrograms ?? null,
        lightChannelRoles: playbookData?.lightChannelRoles ?? null,
      });
      return (
        <LightSchemeLookCard
          lookModel={lookModel}
          lightChannels={lightChannels}
          activeKadr={kadr}
          lightFaders={displayFaders}
          boardFaders={baseFaders}
          spotlights={currentScene?.theaterSpotlights ?? []}
        />
      );
    },
    [
      currentScene,
      lightChannels,
      markdownKadrSections,
      playbookData?.lightChannelRoles,
      playbookData?.lightFaders,
      playbookData?.lightPrograms,
      currentScene?.lightPlot,
      currentScene?.theaterSpotlights,
    ],
  );

  const renderLightTokens = useMemo(
    () => createRenderLightTokens(lightChannels, { renderLightPanel }),
    [lightChannels, renderLightPanel],
  );
  const rehypeScriptTokens = useMemo(
    () => createRehypeScriptTokens(lightChannels, { renderLightPanel }),
    [lightChannels, renderLightPanel],
  );

  /** Блоки `.markdown-kadr` по заголовкам h1–h3 — текст пьесы и экспликация. */
  const kadrLayoutEnabled =
    markdownMode === "explication" || markdownMode === "play";
  const kadrSplitLayoutEnabled = false;

  const hasRoleOrLightLabels = useMemo(
    () => markdownHasRoleLightOrPlayLineLabels(markdown || ""),
    [markdown],
  );

  useLayoutEffect(() => {
    /* Вкладка «Текст»: без общей колонки по max-width всех лейблов — как в редакторе. */
    if (!hasRoleOrLightLabels || markdownMode === "play") {
      dialogLabelSlotPxRef.current = null;
      setDialogLabelSlotPx(null);
      return;
    }

    const root = rootRef.current;
    if (!root) return;

    const MIN = 56;
    const MAX = 220;

    const compute = () => {
      const labels = Array.from(
        root.querySelectorAll<HTMLElement>(".markdown-dialog-label"),
      );
      let max = 0;
      for (const label of labels) {
        const child = label.firstElementChild as HTMLElement | null;
        if (!child) continue;
        const w = child.getBoundingClientRect().width;
        if (Number.isFinite(w)) max = Math.max(max, Math.ceil(w));
      }
      const next = Math.max(MIN, Math.min(MAX, max || MIN));
      const prev = dialogLabelSlotPxRef.current;
      if (prev == null || Math.abs(prev - next) > 2) {
        dialogLabelSlotPxRef.current = next;
        setDialogLabelSlotPx(next);
      }
    };

    let roRaf: number | null = null;
    const scheduleCompute = () => {
      if (roRaf != null) return;
      roRaf = requestAnimationFrame(() => {
        roRaf = null;
        compute();
      });
    };

    scheduleCompute();
    const ro = new ResizeObserver(scheduleCompute);
    ro.observe(root);
    return () => {
      if (roRaf != null) cancelAnimationFrame(roRaf);
      ro.disconnect();
    };
  }, [hasRoleOrLightLabels, markdown, markdownForPreview, kadrLayoutEnabled, markdownMode]);

  const playFromPayload = (payload: TrackLinkPayload) => {
    if (!onTrackLinkClick) return;
    if ("id" in payload) {
      onTrackLinkClick(Number(payload.id));
      return;
    }
    const name = String(payload.name ?? "").trim();
    if (!name) return;
    const fromCache = playlistOptions.find(
      (item) => String(item?.title ?? "").toLowerCase() === name.toLowerCase(),
    );
    if (fromCache?.id != null) {
      onTrackLinkClick(Number(fromCache.id));
    }
  };

  const toggleSoundFromPayload = (payload: SoundLinkPayload) => {
    if (!onSoundLinkClick) return;
    if ("id" in payload) {
      onSoundLinkClick(Number(payload.id));
      return;
    }
    const name = String(payload.name ?? "").trim();
    if (!name) return;
    const fromCache = soundsOptions.find(
      (item) => String(item?.title ?? "").toLowerCase() === name.toLowerCase(),
    );
    if (fromCache?.id != null) {
      onSoundLinkClick(Number(fromCache.id));
    }
  };

  const markdownParagraphProps = useMemo(
    (): Omit<MarkdownPreviewParagraphProps, "children"> => ({
      renderLightTokens,
      renderLightPanel,
      hasRoleOrLightLabels,
      playInlineLabels: markdownMode === "play",
      onTrackLinkClick,
      onSoundLinkClick,
      playFromPayload,
      toggleSoundFromPayload,
      playVideoFromPayload,
      playHoldFromPayload,
      resolveSoundIconFromPayload,
    }),
    [
      renderLightTokens,
      renderLightPanel,
      hasRoleOrLightLabels,
      markdownMode,
      onTrackLinkClick,
      onSoundLinkClick,
      playFromPayload,
      toggleSoundFromPayload,
      playVideoFromPayload,
      playHoldFromPayload,
      resolveSoundIconFromPayload,
    ],
  );

  const rehypePlugins = useMemo((): PluggableList => {
    const plugins: PluggableList = [rehypeStripLightKadrAnchors];
    if (kadrLayoutEnabled || annotationsMode) {
      plugins.push(rehypeScriptTokens);
    }
    if (annotationsMode) {
      plugins.push([rehypeActorAnnotations, { annotations, activeId: activeAnnotationId }]);
    }
    if (kadrLayoutEnabled) {
      plugins.push([
        rehypeKadrSections,
        {
          enabled: true,
          headingMaxLevel: 3,
          kadrIdLookups: markdownKadrIdLookups,
          kadrBlackoutIds,
          splitLayoutEnabled: kadrSplitLayoutEnabled,
        },
      ]);
    }
    return plugins;
  }, [
    annotationsMode,
    rehypeScriptTokens,
    annotations,
    activeAnnotationId,
    kadrLayoutEnabled,
    kadrSplitLayoutEnabled,
    markdownKadrIdLookups,
    kadrBlackoutIds,
  ]);

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
    const exactTitle =
      roles.find((r) => normalizeRoleToken(String(r.title ?? "")) === t) ?? null;
    if (exactTitle) return String(exactTitle.id);
    const exactKey =
      roles.find((r) => normalizeRoleToken(String(r.key ?? "")) === t) ?? null;
    if (exactKey) return String(exactKey.id);
    const byAlias =
      roles.find((r) =>
        (Array.isArray(r.aliases) ? r.aliases : []).some(
          (a) => normalizeRoleToken(String(a ?? "")) === t,
        ),
      ) ?? null;
    if (byAlias) return String(byAlias.id);
    return null;
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

    const soundEl = target.closest?.(".markdown-sound-label") as HTMLElement | null;
    if (soundEl && onSoundLinkClick) {
      const rawId = soundEl.getAttribute("data-sound-id");
      const rawName = soundEl.getAttribute("data-sound-name");
      const id = Number(rawId);
      if (Number.isFinite(id) && id > 0) {
        e.preventDefault();
        e.stopPropagation();
        toggleSoundFromPayload({ id });
        return;
      }
      const name = String(rawName ?? "").trim();
      if (name) {
        e.preventDefault();
        e.stopPropagation();
        toggleSoundFromPayload({ name });
        return;
      }
    }

    const videoEl = target.closest?.(".markdown-video-label") as HTMLElement | null;
    if (videoEl) {
      const rawId = videoEl.getAttribute("data-video-id");
      const id = Number(rawId);
      if (Number.isFinite(id) && id > 0) {
        e.preventDefault();
        e.stopPropagation();
        playVideoFromPayload({ id: Math.trunc(id) });
        return;
      }
    }

    const holdEl = target.closest?.(".markdown-kadr-hold-chip") as HTMLElement | null;
    if (holdEl) {
      e.preventDefault();
      e.stopPropagation();
      const rawId = holdEl.getAttribute("data-hold-id");
      const id = Number(rawId);
      playHoldFromPayload(Number.isFinite(id) && id > 0 ? Math.trunc(id) : null);
      return;
    }

    const el = target.closest?.(".markdown-speaker-label") as HTMLElement | null;
    if (!el) return;
    const token = String(el.getAttribute("title") ?? el.textContent ?? "").trim();
    if (!token) return;
    const roleId = resolveRoleIdFromToken(token);
    if (!roleId) return;
    e.preventDefault();
    e.stopPropagation();
    navigate(`/role-workbook/${encodeURIComponent(roleId)}`);
  };

  const sceneTitleText = String(currentScene?.title ?? "").trim();
  const hasSceneTitle =
    showSceneTitle &&
    (onToggleModeEditing != null || Boolean(sceneTitleText));

  const annotationsPopoverProps = {
    position,
    popoverRef,
    newAnnotation,
    setNewAnnotation,
    activeAnnotationId,
    setActiveAnnotationId,
    annotations,
    onCreate: onCreateAnnotation,
    onUpdate: onUpdateAnnotation,
    onDelete: onDeleteAnnotation,
    onRequestClose: requestClose,
  };

  return {
    markdownForPreview,
    rehypePlugins,
    urlTransform,
    lightbox,
    setLightbox,
    dialogLabelSlotPx,
    rootRef,
    annotationsMode,
    annotationsPopoverProps,
    setAnchorFromRect,
    markdownPreviewImageCtx,
    markdownParagraphProps,
    renderLightTokens,
    renderLightPanel,
    kadrMediaLookup,
    kadrLayoutEnabled,
    hasRoleOrLightLabels,
    markdownMode,
    hasSceneTitle,
    sceneTitleText,
    currentSceneTitle: String(currentScene?.title ?? ""),
    isModeEditing,
    onToggleModeEditing,
    readModeActivateEdit,
    onReadModePointerDown,
    handleMarkdownMouseUp,
    handleSpeakerLabelClick,
    onTrackLinkClick,
    onSoundLinkClick,
    playFromPayload,
    toggleSoundFromPayload,
    playVideoFromPayload,
    playHoldFromPayload,
    resolveTrackLink,
    resolveSoundLink,
    resolveVideoLink,
    resolveHoldLink,
    resolveSoundIconFromPayload,
    isAudioLink,
    normalizeTrackName,
    setNewAnnotation,
    setActiveAnnotationId,
  };
}
