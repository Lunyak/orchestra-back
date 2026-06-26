import cn from "classnames";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { useNavigate } from "react-router-dom";
import { useProjectRolesQuery } from "../../../../features/project/api/project-api";
import { readPlaybookRolesBySceneId } from "../../../../features/playbook/model/playbook-roles-storage";
import type { PlaybookRolesDataV1 } from "../../../../features/playbook";
import {
  selectActiveSceneMarkdownContext,
  selectShowScriptMarkdownUi,
} from "../../../../features/show-script-markdown/model/show-script-markdown-slice";
import { useSceneActorAnnotations } from "../../../../features/show-script-markdown/model/use-scene-actor-annotations";
import { Buttons } from "../../buttons/Buttons";
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
import { expandKadrLabelBlockBreaks } from "../utils/expandKadrLabelBlockBreaks";
import { rehypeKadrSections } from "../utils/rehypeKadrSections";
import { MarkdownTrackLink } from "./MarkdownTrackLink";
import {
  MarkdownKadrMediaContext,
  type MarkdownKadrMediaLookup,
} from "./markdown-kadr-media-context";
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
import type { LightFixture } from "../../../types/script";
import "../../light-console/light-console.css";
import {
  MarkdownKadrBodyContext,
  MarkdownKadrLightColumnContext,
  MarkdownKadrPictureColumnContext,
  MarkdownPreviewLightTokensBridgeContext,
  MarkdownPreviewParagraphBridgeContext,
} from "./markdown-preview-context";
import {
  isInteractiveMarkdownPreviewTarget,
  MarkdownKadrSection,
  MarkdownPreviewLi,
  MarkdownPreviewParagraph,
  MarkdownPreviewTrackLink,
  MarkdownPreviewUl,
} from "./markdown-preview-components";
import { normalizeRoleToken } from "./markdown-preview-kadr-parsing";
import {
  expandScriptLineParagraphBreaks,
  injectNbspParagraphsForTripleNewlines,
  looksLikeOpaqueMediaId,
  markdownHasRoleLightOrPlayLineLabels,
} from "./markdown-preview-normalize";
import type {
  MarkdownLightboxState,
  MarkdownPreviewImageContextValue,
  MarkdownPreviewParagraphProps,
  SoundLinkPayload,
  TrackLinkPayload,
  VideoLinkPayload,
} from "./markdown-preview-types";
import {
  collectLightboxSlidesFromPreviewRoot,
  MarkdownPreviewImage,
  MarkdownPreviewImageContext,
} from "./MarkdownPreviewImage";
export function ScriptMarkdownPreview({
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
}: {
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
}) {
  const dispatch = useAppDispatch();
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
  const annotationsLoadEnabled =
    ui.markdownMode !== "comments" &&
    ui.markdownMode !== "requisites" &&
    ui.markdownMode !== "light";
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
    if (annotationsMode && annotations.length > 0) return withKadrBreaks;
    return injectNbspParagraphsForTripleNewlines(withKadrBreaks);
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

  const resolveSoundIconSrc = useCallback((iconFile: string) => {
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
  }, [projectName]);

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
              (s) => String(s?.title ?? "").toLowerCase() === String(payload.name ?? "").toLowerCase(),
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

  const resolveSoundLink = (href?: string) => {
    if (!href) return null;
    const trimmed = href.trim();
    if (trimmed.startsWith("sound:") || trimmed.startsWith("sfx:")) {
      const payload = trimmed.replace(/^(sound|sfx):/i, "").trim();
      const id = Number(payload);
      if (Number.isFinite(id)) {
        return { id };
      }
      return payload ? { name: normalizeTrackName(payload) } : null;
    }
    return null;
  };

  const resolveVideoLink = (href?: string): VideoLinkPayload | null => {
    if (!href) return null;
    const trimmed = href.trim();
    if (!trimmed.startsWith("video:")) return null;
    const payload = trimmed.replace(/^video:/i, "").trim();
    const id = Number(payload);
    if (!Number.isFinite(id) || id <= 0) return null;
    return { id: Math.trunc(id) };
  };

  const resolveHoldLink = (href?: string): { id: number } | null => {
    if (!href) return null;
    const trimmed = href.trim();
    if (!trimmed.startsWith("hold:")) return null;
    const payload = trimmed.replace(/^hold:/i, "").trim();
    const id = Number(payload);
    if (!Number.isFinite(id) || id <= 0) return null;
    return { id: Math.trunc(id) };
  };

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

  const isAudioLink = (href?: string) => {
    if (!href) return false;
    return /\.(mp3|wav|ogg|m4a|flac)$/i.test(href.trim());
  };

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

  /** Блоки `.markdown-kadr` по заголовкам h1–h3 — и для текста пьесы (`play`), не только notes/explication. */
  const kadrLayoutEnabled =
    markdownMode === "notes" || markdownMode === "explication" || markdownMode === "play";
  /** Колонка картинки + свет — только в тех. карте, не в тексте пьесы и экспликации. */
  const kadrSplitLayoutEnabled = markdownMode === "notes";

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
      (item) =>
        String(item?.title ?? "").toLowerCase() === name.toLowerCase(),
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

  const rehypePlugins = useMemo(() => {
    const plugins: any[] = [rehypeStripLightKadrAnchors];
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

  const isRoleAttachedToCurrentScene = (roleId: string): boolean => {
    if (!currentScene?.id) return false;
    const sr = (playbookData as { sceneRoles?: PlaybookRolesDataV1 })?.sceneRoles;
    const bySceneId = readPlaybookRolesBySceneId(sr ?? null);
    const sceneMap = bySceneId[String(currentScene.id)];
    if (!sceneMap || typeof sceneMap !== "object") return false;
    return Boolean(sceneMap[String(roleId)]);
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
    const token = String(el.getAttribute("title") ?? "").trim();
    if (!token) return;
    const roleId = resolveRoleIdFromToken(token);
    if (!roleId) return;
    if (!isRoleAttachedToCurrentScene(roleId)) return;
    e.preventDefault();
    e.stopPropagation();
    navigate(`/role-workbook/${encodeURIComponent(roleId)}`);
  };

  return (
    <div
      className={cn(
        "markdown-preview",
        hasRoleOrLightLabels && "markdown-preview--has-line-labels",
        markdownMode === "play" && "markdown-preview--play-inline-labels",
        kadrLayoutEnabled && "markdown-preview--kadr",
        readModeActivateEdit && "markdown-preview--read-activatable",
      )}
      style={
        dialogLabelSlotPx != null
          ? ({ ["--dialog-label-slot-width" as any]: `${dialogLabelSlotPx}px` } as React.CSSProperties)
          : undefined
      }
    >
      <div
        ref={rootRef}
        onClick={handleSpeakerLabelClick}
        onPointerDownCapture={readModeActivateEdit ? onReadModePointerDown : undefined}
        onMouseUp={annotationsMode ? handleMarkdownMouseUp : undefined}
      >
        {showSceneTitle && currentScene?.title ? (
          <div className="script-scene-title">{currentScene.title}</div>
        ) : null}
        <MarkdownPreviewImageContext.Provider value={markdownPreviewImageCtx}>
        <MarkdownPreviewParagraphBridgeContext.Provider value={markdownParagraphProps}>
        <MarkdownPreviewLightTokensBridgeContext.Provider value={renderLightTokens}>
        <MarkdownKadrMediaContext.Provider value={kadrMediaLookup}>
        <ReactMarkdown
          urlTransform={urlTransform}
          remarkPlugins={[remarkBreaks]}
          rehypePlugins={rehypePlugins}
          components={{
            section: MarkdownKadrSection,
            div: ({
              className,
              children,
              node: _node,
              ...rest
            }: React.HTMLAttributes<HTMLDivElement> & { node?: unknown }) => {
              const cls = typeof className === "string" ? className : "";
              if (cls.includes("markdown-kadr__light")) {
                return (
                  <div className={className} {...rest}>
                    <MarkdownKadrLightColumnContext.Provider value>
                      {children}
                    </MarkdownKadrLightColumnContext.Provider>
                  </div>
                );
              }
              if (cls.includes("markdown-kadr__picture")) {
                return (
                  <div className={className} {...rest}>
                    <MarkdownKadrPictureColumnContext.Provider value>
                      {children}
                    </MarkdownKadrPictureColumnContext.Provider>
                  </div>
                );
              }
              if (cls.includes("markdown-kadr__body")) {
                return (
                  <div className={className} {...rest}>
                    <MarkdownKadrBodyContext.Provider value>
                      {children}
                    </MarkdownKadrBodyContext.Provider>
                  </div>
                );
              }
              return (
                <div className={className} {...rest}>
                  {children}
                </div>
              );
            },
            p: ({ children }: { children: React.ReactNode }) => (
              <MarkdownPreviewParagraph {...markdownParagraphProps}>
                {children}
              </MarkdownPreviewParagraph>
            ),
            ul: MarkdownPreviewUl,
            li: MarkdownPreviewLi,
            span: ({
              className,
              children,
              node: _node,
              ...rest
            }: React.HTMLAttributes<HTMLSpanElement> & {
              "data-lk-id"?: string;
              node?: unknown;
            }) => {
              const lkId = rest["data-lk-id"];
              if (className?.includes("markdown-light-split-host") && lkId) {
                return (
                  <span className="markdown-light-split-host">
                    {renderLightPanel(String(lkId))}
                  </span>
                );
              }
              return (
                <span className={className} {...rest}>
                  {children}
                </span>
              );
            },
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
                  <MarkdownPreviewTrackLink
                    resolved={resolved}
                    onTrackLinkClick={onTrackLinkClick}
                    playFromPayload={playFromPayload}
                  >
                    {children}
                  </MarkdownPreviewTrackLink>
                );
              }
              const resolvedSound = resolveSoundLink(href);
              if (resolvedSound && onSoundLinkClick) {
                return (
                  <button
                    type="button"
                    className="markdown-sound-link"
                    data-sound-id={"id" in resolvedSound ? String(resolvedSound.id) : undefined}
                    data-sound-name={"name" in resolvedSound ? String(resolvedSound.name) : undefined}
                    onClick={async () => {
                      if ("id" in resolvedSound) {
                        onSoundLinkClick(Number(resolvedSound.id));
                        return;
                      }
                      if ("name" in resolvedSound) {
                        toggleSoundFromPayload({ name: String(resolvedSound.name) });
                      }
                    }}
                  >
                    {children}
                  </button>
                );
              }
              const resolvedVideo = resolveVideoLink(href);
              if (resolvedVideo) {
                return (
                  <button
                    type="button"
                    className="markdown-video-link"
                    data-video-id={String(resolvedVideo.id)}
                    onClick={() => playVideoFromPayload(resolvedVideo)}
                  >
                    {children}
                  </button>
                );
              }
              const resolvedHold = resolveHoldLink(href);
              if (resolvedHold) {
                const hold = kadrMediaLookup.holdImages.find(
                  (h) => Number(h.id) === resolvedHold.id,
                );
                const label = String(hold?.title ?? "").trim();
                const display =
                  label && !looksLikeOpaqueMediaId(label) ? label : "Заставка";
                return (
                  <button
                    type="button"
                    className="markdown-hold-link"
                    data-hold-id={String(resolvedHold.id)}
                    onClick={() => playHoldFromPayload(resolvedHold.id)}
                  >
                    {display}
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
            img: ({
              node: _node,
              children: _children,
              ...imgProps
            }: React.ImgHTMLAttributes<HTMLImageElement> & {
              node?: unknown;
              children?: React.ReactNode;
            }) => <MarkdownPreviewImage {...imgProps} />,
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
            code: ({
              className,
              children,
              node,
              ...rest
            }: {
              className?: string;
              children: React.ReactNode;
              node?: unknown;
            } & React.HTMLAttributes<HTMLElement>) => {
              const classStr = String(className ?? "");
              const isCodeBlock =
                /\blanguage-/.test(classStr) ||
                String(children ?? "").includes("\n");

              if (!isCodeBlock) {
                const text = String(children ?? "").replace(/\n/g, " ").trim();
                return (
                  <code
                    className="markdown-inline-code-label"
                    title={text || undefined}
                    {...rest}
                  >
                    {text || children}
                  </code>
                );
              }
              return (
                <code className={className} {...rest}>
                  {children}
                </code>
              );
            },
          }}
        >
          {markdownForPreview || "*Пусто*"}
        </ReactMarkdown>
        </MarkdownKadrMediaContext.Provider>
        </MarkdownPreviewLightTokensBridgeContext.Provider>
        </MarkdownPreviewParagraphBridgeContext.Provider>
        </MarkdownPreviewImageContext.Provider>
      </div>

      {lightbox && (
        <div
          className="markdown-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр изображения"
          onClick={() => setLightbox(null)}
        >
          <div
            className="markdown-lightbox__content"
            onClick={(e) => e.stopPropagation()}
          >
            <Buttons.CloseButton
              variant="markdownLightbox"
              onClick={() => setLightbox(null)}
              aria-label="Закрыть"
              title="Закрыть"
            />
            <img
              key={lightbox.slides[lightbox.index]!.src}
              className="markdown-lightbox__img"
              src={lightbox.slides[lightbox.index]!.src}
              alt={lightbox.slides[lightbox.index]!.alt || ""}
            />
            {lightbox.slides.length > 1 ? (
              <>
                <button
                  type="button"
                  className="markdown-lightbox__nav markdown-lightbox__nav--prev"
                  aria-label="Предыдущее изображение"
                  title="Предыдущее (←)"
                  onClick={() =>
                    setLightbox((prev) =>
                      !prev || prev.slides.length <= 1
                        ? prev
                        : {
                            ...prev,
                            index: (prev.index - 1 + prev.slides.length) % prev.slides.length,
                          },
                    )
                  }
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="markdown-lightbox__nav markdown-lightbox__nav--next"
                  aria-label="Следующее изображение"
                  title="Следующее (→)"
                  onClick={() =>
                    setLightbox((prev) =>
                      !prev || prev.slides.length <= 1
                        ? prev
                        : { ...prev, index: (prev.index + 1) % prev.slides.length },
                    )
                  }
                >
                  ›
                </button>
                <div className="markdown-lightbox__counter" aria-live="polite">
                  {lightbox.index + 1} / {lightbox.slides.length}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

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


