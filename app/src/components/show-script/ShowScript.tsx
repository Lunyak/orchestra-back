import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ScriptRequisite, ScriptStep } from "../../shared/types/script";
import { getDesktopApi } from "../../shared/platform/desktop-api";
import { pruneSceneImages } from "../../shared/utils/markdownImages";
import {
  createActorAnnotation,
  deleteActorAnnotation,
  ensureProject,
  getActorStepNote,
  listActorAnnotations,
  updateActorAnnotation,
  upsertActorStepNote,
  type ActorAnnotation,
  type ActorAnnotationField,
} from "../../sync/api";
import './style.css';

interface ShowScriptProps {
  steps?: ScriptStep[];
  title?: string;
  projectName?: string;
  sceneName?: string;
  currentPage?: number;
  onStepsChange?: (steps: ScriptStep[]) => void;
  isEditing?: boolean;
  onTrackLinkClick?: (trackId: number) => void;
  showRequisites?: boolean;
  canSave?: boolean;
}

export const ShowScript: React.FC<ShowScriptProps> = ({
  steps: initialSteps,
  title = 'Сценарий спектакля',
  projectName = 'fools',
  sceneName = 'script',
  currentPage: controlledPage,
  onStepsChange,
  isEditing: controlledEditing,
  onTrackLinkClick,
  showRequisites: controlledShowRequisites,
  canSave = true,
}) => {
  const [localPage, setLocalPage] = useState(0);
  const [localSteps, setLocalSteps] = useState<ScriptStep[]>(
    initialSteps || [
      {
        id: 1,
        title: 'Шаг 1',
        markdown:
          'Тестовый шаг.\n\n![Свет](./assets/light.png)\n\n[Музыка](./assets/intro.mp3)',
        requisites: [],
      },
    ]
  );
  const markdownRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const hasMountedRef = useRef(false);
  const [playlistOptions, setPlaylistOptions] = useState<
    { id: number; title: string }[]
  >([]);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [lightChannels, setLightChannels] = useState<string[]>(
    Array.from({ length: 9 }, () => '')
  );
  const [selectedLightSlot, setSelectedLightSlot] = useState(1);
  const [newRequisite, setNewRequisite] = useState('');
  const [markdownMode, setMarkdownMode] = useState<'notes' | 'play'>('notes');
  const requisitesClipboardRef = useRef<ScriptRequisite[] | null>(null);
  const steps = initialSteps ?? localSteps;
  const setSteps = onStepsChange ?? setLocalSteps;
  const currentPage = controlledPage ?? localPage;
  const isEditing = controlledEditing ?? false;
  const showRequisites = controlledShowRequisites ?? false;

  // Личные заметки актёра (тетрадь) к шагу
  const [actorNoteText, setActorNoteText] = useState('');
  const [actorNoteLoading, setActorNoteLoading] = useState(false);
  const [actorNoteSaving, setActorNoteSaving] = useState(false);
  const [actorNoteError, setActorNoteError] = useState<string | null>(null);
  const actorNoteSaveTimerRef = useRef<number | null>(null);
  const actorNoteLoadedKeyRef = useRef<string | null>(null);
  const actorNoteLoadedTextRef = useRef<string>('');

  const [annotationsMode, setAnnotationsMode] = useState(false);
  const [annotations, setAnnotations] = useState<ActorAnnotation[]>([]);
  const [annotationsLoading, setAnnotationsLoading] = useState(false);
  const [annotationsError, setAnnotationsError] = useState<string | null>(null);
  const [newAnnotation, setNewAnnotation] = useState<{
    start: number;
    end: number;
    selectedText: string;
    noteText: string;
  } | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const newAnnotationTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const annotationsRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!onStepsChange && initialSteps && initialSteps.length > 0) {
      setLocalSteps(initialSteps);
      setLocalPage((prev) => Math.min(prev, initialSteps.length - 1));
    }
  }, [initialSteps, onStepsChange]);

  useEffect(() => {
    if (!isEditing) return;
    let isCancelled = false;
    const loadPlaylist = async () => {
      const desktopApi = getDesktopApi();
      if (!desktopApi) {
        setPlaylistOptions([]);
        return;
      }
      try {
        const scene = await desktopApi.readProjectScene(projectName, sceneName);
        if (isCancelled) return;
        const nextOptions = (scene?.playlist || [])
          .filter((item: { id?: number; title?: string }) => item?.id != null)
          .map((item: { id: number; title?: string }) => ({
            id: item.id,
            title: item.title || `Трек ${item.id}`,
          }));
        setPlaylistOptions(nextOptions);
        if (nextOptions.length > 0 && selectedTrackId == null) {
          setSelectedTrackId(nextOptions[0].id);
        }
      } catch (err) {
        if (!isCancelled) {
          setPlaylistOptions([]);
        }
      }
    };
    void loadPlaylist();
    return () => {
      isCancelled = true;
    };
  }, [isEditing, projectName, sceneName, selectedTrackId]);

  useEffect(() => {
    let isCancelled = false;
    const loadLightChannels = async () => {
      const desktopApi = getDesktopApi();
      if (!desktopApi) {
        setLightChannels(Array.from({ length: 9 }, () => ''));
        return;
      }
      try {
        const scene = await desktopApi.readProjectScene(projectName, sceneName);
        if (isCancelled) return;
        const next =
          Array.isArray(scene?.lightChannels) && scene.lightChannels.length > 0
            ? scene.lightChannels.map((value: unknown) =>
              typeof value === 'number' ? String(value) : String(value ?? '')
            )
            : [];
        const normalized = Array.from({ length: 9 }, (_, index) => next[index] ?? '');
        setLightChannels(normalized);
      } catch (err) {
        if (!isCancelled) {
          setLightChannels(Array.from({ length: 9 }, () => ''));
        }
      }
    };
    void loadLightChannels();
    return () => {
      isCancelled = true;
    };
  }, [projectName, sceneName]);

  const saveScene = useCallback(async () => {
    const desktopApi = getDesktopApi();
    if (!desktopApi) return;
    try {
      const current = await desktopApi.readProjectScene(projectName, sceneName);
      const images = pruneSceneImages(current?.images as Record<string, { remoteKey?: string; remoteUrl?: string }> | undefined, steps);
      const payload = { ...current, name: title, steps, lightChannels, images };
      const result = await desktopApi.saveProjectScene(
        projectName,
        sceneName,
        payload,
      );
      if (!result?.ok) {
        console.error("Failed to save scene:", result?.error);
        return;
      }
      console.log("Scene saved:", result.path);
    } catch (err) {
      console.error("Failed to save scene:", err);
    }
  }, [projectName, sceneName, steps, title, lightChannels]);

  useEffect(() => {
    if (!canSave || steps.length === 0) return;
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void saveScene();
    }, 600);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [canSave, saveScene, steps.length]);

  const resolveImageSrc = (src?: string) => {
    if (!src) return src;

    let path = src.trim().replace(/^\.?\//, '');

    if (!path.startsWith('images/')) {
      return src;
    }

    path = path.replace(/^images\//, '').replace(/^\/+/, '');

    // Кодируем каждый сегмент пути отдельно (самый безопасный способ)
    const pathSegments = path.split('/').map(segment =>
      encodeURIComponent(segment)
    );

    const encodedPath = pathSegments.join('/');

    const baseUrl = new URL(`project-images://${encodeURIComponent(projectName)}/`);
    baseUrl.pathname = `/${encodedPath}`;

    return baseUrl.toString();
  };

  const parseLightChannel = (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return { label: '', color: null as string | null };
    }
    const [labelPart, colorPart] = trimmed.split('|', 2);
    return {
      label: labelPart?.trim() ?? '',
      color: colorPart?.trim() ?? null,
    };
  };

  const resolveLightColor = (
    label: string,
    channelColor?: string | null,
    override?: string
  ): string | null => {
    const raw = (override ?? channelColor ?? label).trim().toLowerCase();
    if (!raw) return null;
    if (raw.startsWith('#') || raw.startsWith('rgb') || raw.startsWith('hsl')) {
      return raw;
    }
    const palette: Record<string, string> = {
      blue: '#2563eb',
      red: '#ef4444',
      green: '#22c55e',
      yellow: '#f59e0b',
      white: '#f8fafc',
      black: '#0f172a',
      orange: '#f97316',
      purple: '#a855f7',
      pink: '#ec4899',
      cyan: '#22d3ee',
      magenta: '#d946ef',
      'синий': '#2563eb',
      'голубой': '#38bdf8',
      'красный': '#ef4444',
      'зеленый': '#22c55e',
      'желтый': '#f59e0b',
      'белый': '#f8fafc',
      'черный': '#0f172a',
      'оранжевый': '#f97316',
      'фиолетовый': '#a855f7',
      'розовый': '#ec4899',
    };
    return palette[raw] ?? null;
  };

  const getReadableTextColor = (color?: string | null): string | undefined => {
    if (!color) return undefined;
    const hex = color.startsWith('#') ? color.slice(1) : '';
    if (hex.length !== 6) return undefined;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return undefined;
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.6 ? '#0f172a' : '#f8fafc';
  };

  const renderLightChip = (
    label: string,
    color: string | null,
    key: string
  ) => {
    const textColor = getReadableTextColor(color);
    return (
      <span
        key={key}
        className="markdown-light-chip"
        style={{
          backgroundColor: color || undefined,
          color: textColor || undefined,
          borderColor: color ? 'transparent' : undefined,
        }}
      >
        {label}
      </span>
    );
  };

  const renderLightTokens = (
    node: React.ReactNode,
    keyPrefix = 'light'
  ): React.ReactNode => {
    if (typeof node === 'string') {
      const pattern =
        /(\{\{\s*(light|blackout)\s*(?::\s*(\d+))?\s*(?:\|\s*([^}]+?))?\s*}})|(\[\[\s*([^\]]+?)\s*]])/gi;
      const result: React.ReactNode[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      let counter = 0;
      while ((match = pattern.exec(node)) !== null) {
        const [raw, , rawType, rawIndex, rawColor, , rawLabel] = match;
        const start = match.index;
        if (start > lastIndex) {
          result.push(node.slice(lastIndex, start));
        }
        if (rawLabel != null) {
          const normalized = String(rawLabel).trim();
          const text = normalized ? normalized.toUpperCase() : '…';
          result.push(
            <span
              key={`${keyPrefix}-${counter}-lbl`}
              className="markdown-speaker-label"
              title={normalized}
            >
              {text}
            </span>
          );
        } else if (rawType?.toLowerCase() === 'blackout') {
          const label = 'Блекаут';
          const color = resolveLightColor(label, '#000000', rawColor) ?? '#000000';
          result.push(renderLightChip(label, color, `${keyPrefix}-${counter}-b`));
        } else {
          const index = Number(rawIndex);
          if (Number.isFinite(index) && index >= 1 && index <= 8) {
            const channelValue = lightChannels[index - 1] ?? '';
            const parsed = parseLightChannel(channelValue);
            const label = parsed.label ? parsed.label : String(index);
            const color = resolveLightColor(label, parsed.color, rawColor);
            result.push(
              renderLightChip(label, color, `${keyPrefix}-${counter}-${index}`)
            );
          } else {
            result.push(raw);
          }
        }
        counter += 1;
        lastIndex = start + raw.length;
      }
      if (lastIndex < node.length) {
        result.push(node.slice(lastIndex));
      }
      return result;
    }
    if (Array.isArray(node)) {
      return node.flatMap((child, index) =>
        renderLightTokens(child, `${keyPrefix}-${index}`)
      );
    }
    if (React.isValidElement(node)) {
      if (node.type === 'code' || node.type === 'pre') return node;
      if (node.props?.children == null) return node;
      return React.cloneElement(
        node,
        node.props,
        renderLightTokens(node.props.children, `${keyPrefix}-child`)
      );
    }
    return node;
  };

  const urlTransform = (url: string) => {
    const trimmed = url.trim().toLowerCase();
    if (trimmed.startsWith('javascript:')) {
      return '';
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

  const insertAtCursor = (text: string) => {
    const step = steps[currentPage];
    if (!step) return;
    const textarea = markdownRef.current;
    const field: keyof ScriptStep =
      markdownMode === 'play' ? 'playMarkdown' : 'markdown';
    const currentValue = (step[field] ?? '') as string;
    if (!textarea) {
      updateStep(step.id, field, `${currentValue}${text}`);
      return;
    }

    const start = textarea.selectionStart ?? currentValue.length;
    const end = textarea.selectionEnd ?? start;
    const nextValue = currentValue.slice(0, start) + text + currentValue.slice(end);
    updateStep(step.id, field, nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + text.length;
      textarea.setSelectionRange(pos, pos);
    });
  };

  const handlePasteImage = async (
    event: React.ClipboardEvent<HTMLTextAreaElement>,
  ) => {
    const desktopApi = getDesktopApi();
    if (!desktopApi) return;
    if (!event.clipboardData) return;
    const items = Array.from(event.clipboardData.items || []);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;

    event.preventDefault();
    try {
      const buffer = await file.arrayBuffer();
      const res = await desktopApi.addProjectImage(
        projectName,
        buffer,
        file.type,
        file.name,
      );
      if (!res?.ok) {
        console.error("Failed to paste image:", res?.error);
        return;
      }
      const markdownPath = res.markdownPath as string;
      const filename = markdownPath.replace(/^\.?\//, "").replace(/^images\/?/, "").trim() || markdownPath.split("/").pop() || "image.png";
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const projectIdKey = `projectId:${projectName}`;
      let projectId = typeof window !== "undefined" ? localStorage.getItem(projectIdKey) : null;
      if (accessToken && !projectId) {
        try {
          const project = await ensureProject(accessToken, projectName, `Проект ${projectName}`);
          projectId = project.id;
          if (typeof window !== "undefined") localStorage.setItem(projectIdKey, projectId);
        } catch (_) {}
      }
      if (accessToken && projectId) {
        try {
          const api = getDesktopApi();
          if (api?.invoke) {
            const up = (await api.invoke("upload-project-file", {
              projectName,
              file: filename,
              accessToken,
              projectId,
              type: "image",
            })) as { ok?: boolean; key?: string; url?: string };
            if (up?.ok && up?.url) {
              const current = await desktopApi.readProjectScene(projectName, sceneName);
              const images = { ...(current?.images as Record<string, { remoteKey?: string; remoteUrl?: string }> | undefined), [filename]: { remoteKey: up.key, remoteUrl: up.url } };
              await desktopApi.saveProjectScene(projectName, sceneName, { ...current, images });
            }
          }
        } catch (err) {
          console.error("Markdown image upload failed:", err);
        }
      }
      const markdownSnippet = `\n\n![image](${markdownPath})\n\n`;
      insertAtCursor(markdownSnippet);
    } catch (err) {
      console.error("Failed to paste image:", err);
    }
  };

  const updateStep = <K extends keyof ScriptStep>(
    id: number,
    field: K,
    value: ScriptStep[K],
  ) => {
    setSteps(
      steps.map((step) => (step.id === id ? { ...step, [field]: value } : step))
    );
  };

  const insertLightChannel = () => {
    const slotNumber = Number(selectedLightSlot);
    if (!Number.isFinite(slotNumber)) return;
    const clamped = Math.max(1, Math.min(8, Math.trunc(slotNumber)));
    insertAtCursor(`\n\nСВЕТ — канал {{light:${clamped}}}\n\n`);
  };


  const currentStep = steps[currentPage];
  const currentRequisites = currentStep?.requisites ?? [];
  const activeMarkdownField: keyof ScriptStep =
    markdownMode === 'play' ? 'playMarkdown' : 'markdown';
  const activeMarkdown = (currentStep?.[activeMarkdownField] ?? '') as string;
  const activeField = (activeMarkdownField === 'playMarkdown'
    ? 'playMarkdown'
    : 'markdown') as ActorAnnotationField;

  // Пометки недоступны в режиме редактирования (там textarea).
  useEffect(() => {
    if (isEditing && annotationsMode) {
      setAnnotationsMode(false);
      setNewAnnotation(null);
      setActiveAnnotationId(null);
    }
  }, [annotationsMode, isEditing]);

  const actorNoteKey =
    currentStep?.id != null ? `${projectName}:${sceneName}:${currentStep.id}` : null;

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
    return pointRange.toString().length;
  };

  const handleMarkdownMouseUp = () => {
    if (!annotationsMode) return;
    const root = annotationsRootRef.current;
    if (!root) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    if (!root.contains(range.commonAncestorContainer)) return;

    const start = computeRenderedOffset(root, range, true);
    const end = computeRenderedOffset(root, range, false);
    const s = Math.min(start, end);
    const e = Math.max(start, end);
    const selectedText = String(sel.toString() ?? "").trim();
    if (!selectedText) return;

    setNewAnnotation({ start: s, end: e, selectedText, noteText: "" });
    setActiveAnnotationId(null);
    setTimeout(() => newAnnotationTextareaRef.current?.focus(), 0);
  };

  // Аннотации: загрузка для текущего шага + поля (markdown / playMarkdown)
  useEffect(() => {
    if (!actorNoteKey || currentStep?.id == null) {
      setAnnotations([]);
      setAnnotationsError(null);
      setAnnotationsLoading(false);
      setNewAnnotation(null);
      setActiveAnnotationId(null);
      return;
    }
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      setAnnotations([]);
      setAnnotationsError(null);
      setAnnotationsLoading(false);
      return;
    }
    let cancelled = false;
    setAnnotationsLoading(true);
    setAnnotationsError(null);
    listActorAnnotations(token, {
      projectSlug: projectName,
      sceneName,
      stepId: currentStep.id,
      field: activeField,
    })
      .then((res) => {
        if (cancelled) return;
        setAnnotations(res.annotations ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setAnnotations([]);
        setAnnotationsError('Не удалось загрузить пометки');
      })
      .finally(() => {
        if (!cancelled) setAnnotationsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [actorNoteKey, activeField, currentStep?.id, projectName, sceneName]);

  // Загрузка заметки при смене шага
  useEffect(() => {
    if (!actorNoteKey || currentStep?.id == null) {
      actorNoteLoadedKeyRef.current = null;
      actorNoteLoadedTextRef.current = '';
      setActorNoteText('');
      setActorNoteError(null);
      setActorNoteLoading(false);
      return;
    }
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      actorNoteLoadedKeyRef.current = actorNoteKey;
      actorNoteLoadedTextRef.current = '';
      setActorNoteText('');
      setActorNoteError(null);
      setActorNoteLoading(false);
      return;
    }

    let cancelled = false;
    setActorNoteLoading(true);
    setActorNoteError(null);
    getActorStepNote(token, {
      projectSlug: projectName,
      sceneName,
      stepId: currentStep.id,
    })
      .then((res) => {
        if (cancelled) return;
        const next = String(res?.note?.text ?? '');
        actorNoteLoadedKeyRef.current = actorNoteKey;
        actorNoteLoadedTextRef.current = next;
        setActorNoteText(next);
      })
      .catch(() => {
        if (cancelled) return;
        actorNoteLoadedKeyRef.current = actorNoteKey;
        actorNoteLoadedTextRef.current = '';
        setActorNoteText('');
        setActorNoteError('Не удалось загрузить заметку');
      })
      .finally(() => {
        if (!cancelled) setActorNoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [actorNoteKey, currentStep?.id, projectName, sceneName]);

  // Автосохранение заметки (debounce)
  useEffect(() => {
    if (!actorNoteKey || currentStep?.id == null) return;
    if (actorNoteLoadedKeyRef.current !== actorNoteKey) return;
    if (actorNoteLoading) return;

    const currentLoaded = actorNoteLoadedTextRef.current ?? '';
    if (actorNoteText === currentLoaded) return;

    if (actorNoteSaveTimerRef.current) {
      window.clearTimeout(actorNoteSaveTimerRef.current);
    }

    actorNoteSaveTimerRef.current = window.setTimeout(() => {
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) return;
      setActorNoteSaving(true);
      setActorNoteError(null);
      upsertActorStepNote(token, {
        projectSlug: projectName,
        sceneName,
        stepId: currentStep.id,
        text: actorNoteText,
      })
        .then((res) => {
          const saved = String(res?.note?.text ?? '');
          actorNoteLoadedTextRef.current = saved;
          setActorNoteText(saved);
        })
        .catch(() => {
          setActorNoteError('Не удалось сохранить заметку');
        })
        .finally(() => setActorNoteSaving(false));
    }, 600);

    return () => {
      if (actorNoteSaveTimerRef.current) {
        window.clearTimeout(actorNoteSaveTimerRef.current);
      }
    };
  }, [
    actorNoteKey,
    actorNoteLoading,
    actorNoteText,
    currentStep?.id,
    projectName,
    sceneName,
  ]);

  const toggleRequisite = (requisiteId: number) => {
    if (!currentStep) return;
    const nextRequisites = currentRequisites.map((item) =>
      item.id === requisiteId ? { ...item, checked: !item.checked } : item
    );
    updateStep(currentStep.id, 'requisites', nextRequisites);
  };

  const removeRequisite = (requisiteId: number) => {
    if (!currentStep) return;
    const nextRequisites = currentRequisites.filter((item) => item.id !== requisiteId);
    updateStep(currentStep.id, 'requisites', nextRequisites);
  };

  const addRequisite = () => {
    if (!currentStep) return;
    const label = newRequisite.trim();
    if (!label) return;
    const nextId =
      currentRequisites.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
    const nextItem: ScriptRequisite = { id: nextId, label, checked: false };
    updateStep(currentStep.id, 'requisites', [...currentRequisites, nextItem]);
    setNewRequisite('');
  };

  const copyRequisites = () => {
    if (!currentStep) return;
    requisitesClipboardRef.current = currentRequisites.map((item) => ({ ...item }));
  };

  const resetRequisites = () => {
    setSteps(
      steps.map((step) => ({
        ...step,
        requisites: (step.requisites ?? []).map((item) => ({
          ...item,
          checked: false,
        })),
      }))
    );
  };

  const pasteRequisites = () => {
    if (!currentStep || !requisitesClipboardRef.current) return;
    const cloned = requisitesClipboardRef.current.map((item) => ({ ...item }));
    updateStep(currentStep.id, 'requisites', cloned);
  };

  const hasCopiedRequisites = requisitesClipboardRef.current != null;

  return (
    <div className="show-script">
      <div className="script-content">
        <div className="script-header">
          <div className="script-actions">
            {isEditing && (
              <div className="script-track-insert">
                <select
                  className="script-track-select"
                  value={selectedTrackId ?? undefined}
                  onChange={(event) => setSelectedTrackId(Number(event.target.value))}
                >
                  {playlistOptions.length === 0 && (
                    <option value="">Треки не найдены</option>
                  )}
                  {playlistOptions.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const target = playlistOptions.find(
                      (item) => item.id === selectedTrackId,
                    );
                    if (!target) return;
                    insertAtCursor(`\n\n[${target.title}](track:${target.id})\n\n`);
                  }}
                  disabled={playlistOptions.length === 0}
                >
                  Вставить трек
                </button>
              </div>
            )}
            {isEditing && (
              <div className="script-light-panel">
                <div className="script-light-grid">
                  {lightChannels.map((value, index) => (
                    <label key={`light-${index + 1}`} className="script-light-cell">
                      <input
                        type="text"
                        inputMode="numeric"
                        className="script-light-input"
                        value={value}
                        onChange={(event) => {
                          const next = [...lightChannels];
                          next[index] = event.target.value;
                          setLightChannels(next);
                        }}
                        placeholder={`${index + 1}`}
                      />
                    </label>
                  ))}
                </div>
                <div className="script-light-insert">
                  <select
                    className="script-track-select"
                    value={selectedLightSlot}
                    onChange={(event) => setSelectedLightSlot(Number(event.target.value))}
                  >
                    {Array.from({ length: 8 }, (_, index) => (
                      <option key={`slot-${index + 1}`} value={index + 1}>
                        Шаблон {index + 1}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={insertLightChannel}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        insertLightChannel();
                      }
                    }}
                  >
                    Вставить свет
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {currentStep && (
          <div className="script-step-editor">
            {isEditing ? (
              <div className="form-group">
                <label htmlFor={`title-${currentStep.id}`}></label>
                <input
                  id={`title-${currentStep.id}`}
                  type="text"
                  className="form-input"
                  value={currentStep.title}
                  onChange={(e) => updateStep(currentStep.id, 'title', e.target.value)}
                  placeholder="Введите название шага"
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 10, marginTop: 10 }}>
                  <div />
                  <label style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>Длительность (мин)</div>
                    <input
                      type="number"
                      min={1}
                      max={480}
                      step={1}
                      className="form-input"
                      value={currentStep.durationMin ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (!raw) {
                          updateStep(currentStep.id, "durationMin", undefined);
                          return;
                        }
                        const n = Number(raw);
                        if (!Number.isFinite(n)) return;
                        const clamped = Math.max(1, Math.min(480, Math.trunc(n)));
                        updateStep(currentStep.id, "durationMin", clamped);
                      }}
                      placeholder="например 10"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="script-step-title">{currentStep.title}</div>
            )}

            <div className="script-step-body">
              <div className="script-markdown-pane">
                <div className="script-markdown-toggle">
                  <button
                    type="button"
                    className="script-markdown-toggle-btn"
                    data-active={markdownMode === 'notes'}
                    onClick={() => setMarkdownMode('notes')}
                  >
                    Схема
                  </button>
                  <button
                    type="button"
                    className="script-markdown-toggle-btn"
                    data-active={markdownMode === 'play'}
                    onClick={() => setMarkdownMode('play')}
                  >
                    Текст
                  </button>
                </div>
                {isEditing ? (
                  <div className="form-group form-group-grow">
                    <label htmlFor={`markdown-${currentStep.id}`}></label>
                    <textarea
                      id={`markdown-${currentStep.id}`}
                      className="form-textarea"
                      ref={markdownRef}
                      value={activeMarkdown}
                      onChange={(e) =>
                        updateStep(currentStep.id, activeMarkdownField, e.target.value)
                      }
                      onPaste={handlePasteImage}
                      placeholder={
                        markdownMode === 'play'
                          ? 'Текст пьесы для этого шага'
                          : 'Текст, изображения и ссылки на музыку'
                      }
                      rows={12}
                    />
                    <div className="actor-annotations-toolbar" style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        className="actor-annotations-btn"
                        data-active="false"
                        disabled
                        title="Пометки работают в режиме просмотра (выйдите из редактирования шага)"
                      >
                        Пометки
                      </button>
                      <div className="actor-annotations-meta">
                        Выйдите из редактирования, чтобы выделять текст и делать пометки
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="form-group">
                    <div className="markdown-preview">
                      <div className="actor-annotations-toolbar">
                        <button
                          type="button"
                          className="actor-annotations-btn"
                          data-active={annotationsMode ? "true" : "false"}
                          onClick={() => setAnnotationsMode((p) => !p)}
                          title="Включить режим пометок: выдели текст и добавь заметку"
                        >
                          Пометки
                        </button>
                        <div className="actor-annotations-meta">
                          {annotationsLoading
                            ? "загрузка…"
                            : annotationsError
                              ? annotationsError
                              : `пометок: ${annotations.length}`}
                        </div>
                      </div>

                      <div
                        ref={annotationsRootRef}
                        onMouseUp={annotationsMode ? handleMarkdownMouseUp : undefined}
                      >
                        <ReactMarkdown
                        urlTransform={urlTransform}
                        rehypePlugins={
                          annotationsMode
                            ? [
                                [
                                  rehypeActorAnnotations,
                                  { annotations, activeId: activeAnnotationId },
                                ],
                              ]
                            : []
                        }
                        components={{
                          p: ({ children }: { children: React.ReactNode }) => (
                            <p>{renderLightTokens(children)}</p>
                          ),
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
                          blockquote: ({
                            children,
                          }: {
                            children: React.ReactNode;
                          }) => <blockquote>{renderLightTokens(children)}</blockquote>,
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
                                  onClick={async () => {
                                    if (resolved.id != null) {
                                      onTrackLinkClick(Number(resolved.id));
                                      return;
                                    }
                                    if (!resolved.name) return;
                                    const fromCache = playlistOptions.find(
                                      (item) =>
                                        String(item?.title ?? "").toLowerCase() ===
                                        String(resolved.name ?? "").toLowerCase(),
                                    );
                                    if (fromCache?.id != null) {
                                      onTrackLinkClick(Number(fromCache.id));
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
                          img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
                            const { src, alt, ...rest } = props;
                            return (
                              <img
                                src={resolveImageSrc(src)}
                                alt={alt || ''}
                                style={{
                                  maxHeight: 800,
                                  maxWidth: '100%',
                                  height: 'auto',
                                }}
                                {...rest}
                              />
                            );
                          },
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
                                  setActiveAnnotationId((prev) =>
                                    prev === id ? null : id,
                                  );
                                  setNewAnnotation(null);
                                }}
                              >
                                {children}
                              </mark>
                            );
                          },
                        }}
                      >
                        {activeMarkdown || '*Пусто*'}
                      </ReactMarkdown>
                      </div>

                      {annotationsMode ? (
                        <div className="actor-annotations-panel">
                          {newAnnotation ? (
                            <div className="actor-annotations-card">
                              <div className="actor-annotations-card-title">
                                Новая пометка
                              </div>
                              <div className="actor-annotations-quote">
                                “{newAnnotation.selectedText.slice(0, 240)}”
                              </div>
                              <textarea
                                className="actor-annotations-input"
                                ref={newAnnotationTextareaRef}
                                value={newAnnotation.noteText}
                                onChange={(e) =>
                                  setNewAnnotation((p) =>
                                    p ? { ...p, noteText: e.target.value } : p,
                                  )
                                }
                                placeholder="Напиши заметку…"
                                rows={3}
                              />
                              <div className="actor-annotations-actions">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const token =
                                      typeof window !== "undefined"
                                        ? localStorage.getItem("accessToken")
                                        : null;
                                    if (!token || !currentStep?.id) return;
                                    const noteText = newAnnotation.noteText.trim();
                                    if (!noteText) return;
                                    try {
                                      const { annotation } =
                                        await createActorAnnotation(token, {
                                          projectSlug: projectName,
                                          sceneName,
                                          stepId: currentStep.id,
                                          field: activeField,
                                          startOffset: newAnnotation.start,
                                          endOffset: newAnnotation.end,
                                          selectedText: newAnnotation.selectedText,
                                          noteText,
                                        });
                                      setAnnotations((prev) =>
                                        [...prev, annotation].sort(
                                          (a, b) =>
                                            a.startOffset - b.startOffset ||
                                            a.endOffset - b.endOffset,
                                        ),
                                      );
                                      setNewAnnotation(null);
                                    } catch {
                                      setAnnotationsError("Не удалось создать пометку");
                                    }
                                  }}
                                >
                                  Сохранить пометку
                                </button>
                                <button
                                  type="button"
                                  className="actor-annotations-btn-secondary"
                                  onClick={() => setNewAnnotation(null)}
                                >
                                  Отмена
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {activeAnnotationId ? (
                            <ActorAnnotationDetails
                              annotation={
                                annotations.find((a) => a.id === activeAnnotationId) ??
                                null
                              }
                              onClose={() => setActiveAnnotationId(null)}
                              onUpdate={async (id, noteText) => {
                                const token =
                                  typeof window !== "undefined"
                                    ? localStorage.getItem("accessToken")
                                    : null;
                                if (!token) return;
                                const { annotation } = await updateActorAnnotation(
                                  token,
                                  id,
                                  { noteText },
                                );
                                setAnnotations((prev) =>
                                  prev.map((a) => (a.id === id ? annotation : a)),
                                );
                              }}
                              onDelete={async (id) => {
                                const token =
                                  typeof window !== "undefined"
                                    ? localStorage.getItem("accessToken")
                                    : null;
                                if (!token) return;
                                await deleteActorAnnotation(token, id);
                                setAnnotations((prev) => prev.filter((a) => a.id !== id));
                                setActiveAnnotationId(null);
                              }}
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                <div className="actor-note-panel">
                  <div className="actor-note-head">
                    <div className="actor-note-title">Моя заметка к шагу</div>
                    <div className="actor-note-meta">
                      {actorNoteLoading
                        ? 'загрузка…'
                        : actorNoteSaving
                          ? 'сохраняю…'
                          : actorNoteError
                            ? 'ошибка'
                            : actorNoteText.trim()
                              ? 'сохранено'
                              : '—'}
                    </div>
                  </div>
                  <textarea
                    className="actor-note-textarea"
                    value={actorNoteText}
                    onChange={(e) => setActorNoteText(e.target.value)}
                    placeholder="Сюда можно писать свои пометки к этому шагу (видно только вам)"
                    rows={4}
                  />
                  {actorNoteError && (
                    <div className="actor-note-error">{actorNoteError}</div>
                  )}
                </div>
              </div>
              {showRequisites && (
                <aside className="requisites-panel">
                  <div className="requisites-header">
                    <span>Реквизит</span>
                    <div className="requisites-actions">
                      <button
                        type="button"
                        className="requisites-action-btn"
                        onClick={copyRequisites}
                        disabled={currentRequisites.length === 0}
                        title="Скопировать реквизит"
                      >
                        С
                      </button>

                      <button
                        type="button"
                        className="requisites-action-btn"
                        onClick={pasteRequisites}
                        disabled={!hasCopiedRequisites}
                        title="Вставить реквизит"
                      >
                        P
                      </button>
                      <button
                        type="button"
                        className="requisites-action-btn"
                        onClick={resetRequisites}
                        disabled={currentRequisites.length === 0}
                        title="Сбросить отметки на всех шагах"
                      >
                        D
                      </button>
                    </div>
                  </div>
                  {isEditing && (
                    <div className="requisites-add">
                      <input
                        type="text"
                        value={newRequisite}
                        onChange={(event) => setNewRequisite(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            addRequisite();
                          }
                        }}
                        placeholder="Добавить реквизит"
                      />
                      <button type="button" onClick={addRequisite}>
                        +
                      </button>
                    </div>
                  )}
                  <div className="requisites-list">
                    {currentRequisites.length === 0 ? (
                      <div className="requisites-empty">Нет реквизита</div>
                    ) : (
                      currentRequisites.map((item) => (
                        <label key={item.id} className="requisite-item">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => toggleRequisite(item.id)}
                          />
                          <span>{item.label}</span>
                          {isEditing && (
                            <button
                              type="button"
                              className="requisite-remove"
                              onClick={() => removeRequisite(item.id)}
                            >
                              ×
                            </button>
                          )}
                        </label>
                      ))
                    )}
                  </div>
                </aside>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

type HastNode =
  | { type: "root"; children?: HastNode[] }
  | { type: "element"; tagName: string; properties?: any; children?: HastNode[] }
  | { type: "text"; value: string }
  | { type: string; [k: string]: any };

function rehypeActorAnnotations(opts: {
  annotations: ActorAnnotation[];
  activeId: string | null;
}) {
  const input = (opts.annotations ?? [])
    .slice()
    .filter((a) => a && typeof a.id === "string")
    .map((a) => ({
      id: a.id,
      start: Math.max(0, Math.trunc(Number(a.startOffset))),
      end: Math.max(0, Math.trunc(Number(a.endOffset))),
    }))
    .filter((a) => Number.isFinite(a.start) && Number.isFinite(a.end) && a.end > a.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  return function transformer(tree: HastNode) {
    let pos = 0;
    let idx = 0;

    const wrap = (id: string, text: string) =>
      ({
        type: "element",
        tagName: "mark",
        properties: {
          className: ["actor-annotations-mark"],
          "data-anno-id": id,
          "data-active": opts.activeId === id ? "true" : "false",
        },
        children: [{ type: "text", value: text }],
      }) as HastNode;

    const walk = (node: HastNode): HastNode => {
      if (!node) return node;
      if (node.type === "text") {
        const value = String((node as any).value ?? "");
        const len = value.length;
        if (len === 0) return node;

        // fast-forward annotations that already ended
        while (idx < input.length && input[idx].end <= pos) idx += 1;
        if (idx >= input.length) {
          pos += len;
          return node;
        }

        const startPos = pos;
        const endPos = pos + len;
        if (input[idx].start >= endPos) {
          pos += len;
          return node;
        }

        const out: HastNode[] = [];
        let localCursor = 0;
        while (idx < input.length) {
          const a = input[idx];
          if (a.start >= endPos) break;
          const s = Math.max(a.start, startPos) - startPos;
          const e = Math.min(a.end, endPos) - startPos;
          if (e <= localCursor) {
            idx += 1;
            continue;
          }
          if (s > localCursor) {
            out.push({ type: "text", value: value.slice(localCursor, s) } as HastNode);
          }
          out.push(wrap(a.id, value.slice(s, e)));
          localCursor = e;
          if (a.end <= endPos) idx += 1;
          // если аннотация заканчивается позже — это overlap, пока игнорируем продолжение
        }
        if (localCursor < len) {
          out.push({ type: "text", value: value.slice(localCursor) } as HastNode);
        }

        pos += len;
        if (out.length === 1) return out[0];
        return { type: "element", tagName: "span", properties: {}, children: out } as HastNode;
      }

      const children = (node as any).children;
      if (Array.isArray(children)) {
        const nextChildren: HastNode[] = [];
        for (const child of children) {
          const next = walk(child);
          // flatten span wrappers we introduced only if safe? keep as-is
          nextChildren.push(next);
        }
        (node as any).children = nextChildren;
      }
      return node;
    };

    walk(tree);
  };
}

function ActorAnnotationDetails({
  annotation,
  onClose,
  onUpdate,
  onDelete,
}: {
  annotation: ActorAnnotation | null;
  onClose: () => void;
  onUpdate: (id: string, noteText: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [text, setText] = useState(annotation?.noteText ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(annotation?.noteText ?? "");
    setError(null);
    setSaving(false);
  }, [annotation?.id]);

  if (!annotation) return null;

  return (
    <div className="actor-annotations-card">
      <div className="actor-annotations-card-head">
        <div className="actor-annotations-card-title">Пометка</div>
        <button type="button" className="actor-annotations-x" onClick={onClose}>
          ×
        </button>
      </div>
      {annotation.selectedText ? (
        <div className="actor-annotations-quote">
          “{String(annotation.selectedText).slice(0, 240)}”
        </div>
      ) : null}
      <textarea
        className="actor-annotations-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
      />
      {error ? <div className="actor-annotations-error">{error}</div> : null}
      <div className="actor-annotations-actions">
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            const next = text.trim();
            if (!next) return;
            setSaving(true);
            setError(null);
            try {
              await onUpdate(annotation.id, next);
            } catch {
              setError("Не удалось сохранить");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Сохраняю…" : "Сохранить"}
        </button>
        <button
          type="button"
          className="actor-annotations-btn-danger"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await onDelete(annotation.id);
            } catch {
              setError("Не удалось удалить");
            } finally {
              setSaving(false);
            }
          }}
        >
          Удалить
        </button>
      </div>
    </div>
  );
}
