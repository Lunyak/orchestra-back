import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlaybook } from "../../playbook";
import { invokePlaylistPause, invokePlaylistPlay, invokeSoundPlay } from "../../playbook/model/playbook-playback-bridge";
import type { KadrProjectorCue } from "../../theater/model/kadr-projector";
import { normalizeHoldImages } from "../../projector/model/playbook-projector-persist";
import type { ProjectorMediaContext } from "../../projector/model/projector-media";
import {
  closeProjectorWindow,
  ensureProjectorOutputOpen,
  isProjectorWindowOpen,
  notifyProjectorReady,
  pauseProjectorVideo,
  pingProjectorOutput,
  subscribeProjectorOutputErrors,
  subscribeProjectorPlayback,
} from "../../projector/model/projector-playback-bridge";
import { applyKadrProjector, showProjectorHold } from "../../spectacle-run/model/apply-kadr-projector";
import { resolveKadrProjectorVideoOptions } from "../../theater/model/kadr-projector";
import {
  applyNotesRunDraft,
  buildEmptyNotesRunDraft,
  buildNotesRunCardsFromScenes,
  buildNotesRunDraftFromCard,
  loadNotesRun,
  renumberNotesRunCards,
  saveNotesRun,
} from "./notes-run-storage";
import type { NotesRunCardDraft, NotesRunCardV1, NotesRunDataV1 } from "./notes-run-types";
import {
  getProjectMediaFolderInfo,
  scanProjectMediaFolder,
} from "../../../shared/platform/project-media-folder";

function isKeyboardTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function resolvePlaylistTrack(
  playlist: Array<{ id: number; title?: string }>,
  trackId: number,
) {
  const byId = playlist.find((track) => Number(track.id) === Number(trackId));
  if (byId) return byId;
  return playlist[Number(trackId) - 1] ?? null;
}

export function useNotesRun(projectName: string) {
  const { playbookData, scenes, isPlaybookReady } = usePlaybook();
  const [notesRun, setNotesRun] = useState<NotesRunDataV1>({ v: 1, cards: [] });
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  /** Прогон не стартует сам при открытии страницы — только по кнопке «Старт». */
  const [runActive, setRunActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editCardId, setEditCardId] = useState<string | null>(null);
  /** Индекс карточки, после которой вставляем новую (create). */
  const [createInsertAfterIndex, setCreateInsertAfterIndex] = useState<number | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [isProjectorOpen, setIsProjectorOpen] = useState(false);
  const [projectorVideoMuted, setProjectorVideoMuted] = useState<Record<number, boolean>>({});
  const [projectorVideoVolume, setProjectorVideoVolume] = useState<Record<number, number>>({});

  const pausedRef = useRef(paused);
  const runActiveRef = useRef(runActive);
  const cardIndexRef = useRef(cardIndex);
  const notesRunRef = useRef(notesRun);
  pausedRef.current = paused;
  runActiveRef.current = runActive;
  cardIndexRef.current = cardIndex;
  notesRunRef.current = notesRun;

  useEffect(() => {
    let cancelled = false;
    setNotesLoaded(false);
    setRunActive(false);
    setPaused(false);
    const loadInitial = async () => {
      let data = await loadNotesRun(projectName);
      if (cancelled) return;
      if (data.cards.length === 0 && projectName) {
        const folderInfo = await getProjectMediaFolderInfo(projectName);
        if (folderInfo.path) {
          await scanProjectMediaFolder(projectName);
          if (cancelled) return;
          data = await loadNotesRun(projectName);
        }
      }
      if (cancelled) return;
      setNotesRun(data);
      setCardIndex(0);
      setNotesLoaded(true);
    };
    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, [projectName]);

  const reloadFromFolder = useCallback(async () => {
    const data = await loadNotesRun(projectName);
    setNotesRun(data);
    setCardIndex(0);
    setNotesLoaded(true);
    return data;
  }, [projectName]);

  const cards = notesRun.cards;
  const clampedIndex = cards.length === 0 ? 0 : Math.min(cardIndex, cards.length - 1);
  const currentCard = cards[clampedIndex] ?? null;

  const projectorMediaCtx = useMemo<ProjectorMediaContext>(
    () => ({
      projectSlug: projectName,
      videos: playbookData?.videos ?? [],
      holdImages: normalizeHoldImages(playbookData?.holdImages, playbookData?.projector ?? undefined),
      projector: playbookData?.projector ?? null,
    }),
    [projectName, playbookData?.holdImages, playbookData?.projector, playbookData?.videos],
  );

  const persistCards = useCallback(
    async (nextCards: NotesRunCardV1[]) => {
      const nextData: NotesRunDataV1 = {
        v: 1,
        cards: renumberNotesRunCards(nextCards),
      };
      setNotesRun(nextData);
      try {
        await saveNotesRun(projectName, nextData);
      } catch (err) {
        console.error("[notes-run] save failed:", err);
        setLiveStatus(
          String((err as Error)?.message ?? "Не удалось сохранить карточки"),
        );
      }
    },
    [projectName],
  );

  const resolveProjectorVideoMuted = useCallback(
    (videoId: number) => projectorVideoMuted[Number(videoId)] ?? false,
    [projectorVideoMuted],
  );

  const resolveProjectorVideoVolume = useCallback(
    (videoId: number) => {
      const stored = projectorVideoVolume[Number(videoId)];
      if (stored != null && Number.isFinite(stored)) return Math.max(0, Math.min(1, stored));
      return resolveProjectorVideoMuted(videoId) ? 0 : 1;
    },
    [projectorVideoMuted, projectorVideoVolume],
  );

  const playlist = playbookData?.playlist ?? [];

  const applyCardPlayback = useCallback(
    async (card: NotesRunCardV1 | null) => {
      if (!card || pausedRef.current || !runActiveRef.current) return;

      if (card.playTrackId) {
        const track = resolvePlaylistTrack(playlist, card.playTrackId);
        if (!track) {
          setLiveStatus(
            `Трек #${card.playTrackId} не найден в плейлисте (проверьте привязку в карточке)`,
          );
        } else {
          invokePlaylistPlay(card.playTrackId, { continueIfPlaying: false });
        }
      }

      for (const soundId of card.soundIds) {
        if (soundId > 0) invokeSoundPlay(soundId);
      }

      const cue = card.projectorCue;
      if (cue) {
        const open = await ensureProjectorOutputOpen({ focus: false });
        if (open) setIsProjectorOpen(true);
        await applyKadrProjector(
          cue,
          projectorMediaCtx,
          resolveKadrProjectorVideoOptions(cue, {
            resolveMuted: resolveProjectorVideoMuted,
            resolveVolume: resolveProjectorVideoVolume,
          }),
        );
      }
    },
    [playlist, projectorMediaCtx, resolveProjectorVideoMuted, resolveProjectorVideoVolume],
  );

  const applyingRef = useRef(false);

  useEffect(() => {
    if (!runActive || paused) return;
    if (!notesLoaded || !isPlaybookReady || applyingRef.current) return;
    if (currentCard?.playTrackId && playlist.length === 0) return;
    void applyCardPlayback(currentCard);
  }, [
    runActive,
    isPlaybookReady,
    notesLoaded,
    playlist.length,
    clampedIndex,
    currentCard?.id,
    currentCard?.playTrackId,
    paused,
    applyCardPlayback,
  ]);

  useEffect(() => {
    if (cards.length === 0) {
      if (cardIndex !== 0) setCardIndex(0);
      return;
    }
    if (cardIndex > cards.length - 1) {
      setCardIndex(cards.length - 1);
    }
  }, [cardIndex, cards.length]);

  useEffect(() => {
    const unsubReady = notifyProjectorReady();
    const unsubErrors = subscribeProjectorOutputErrors((error) => {
      setLiveStatus(`Проектор: ${error.message}`);
    });
    void pingProjectorOutput().then((alive) => {
      if (alive) setIsProjectorOpen(true);
    });
    return () => {
      unsubReady();
      unsubErrors();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIsProjectorOpen(isProjectorWindowOpen());
    }, 800);
    return () => window.clearInterval(timer);
  }, []);

  const goToIndex = useCallback((index: number) => {
    if (cards.length === 0) return;
    const next = Math.max(0, Math.min(cards.length - 1, index));
    if (next === cardIndexRef.current) return;
    setCardIndex(next);
  }, [cards.length]);

  const goPrev = useCallback(() => goToIndex(clampedIndex - 1), [clampedIndex, goToIndex]);
  const goNext = useCallback(() => goToIndex(clampedIndex + 1), [clampedIndex, goToIndex]);

  const startRun = useCallback(() => {
    if (cards.length === 0) {
      setLiveStatus("Добавьте карточки для прогона");
      return;
    }
    runActiveRef.current = true;
    pausedRef.current = false;
    setRunActive(true);
    setPaused(false);
    applyingRef.current = true;
    void applyCardPlayback(cards[clampedIndex]).finally(() => {
      applyingRef.current = false;
    });
    setLiveStatus("Прогон запущен");
  }, [applyCardPlayback, cards, clampedIndex]);

  const togglePause = useCallback(() => {
    if (!runActiveRef.current) return;
    if (pausedRef.current) {
      pausedRef.current = false;
      setPaused(false);
      void applyCardPlayback(cards[cardIndexRef.current] ?? null);
      setLiveStatus("Продолжаем");
      return;
    }
    pausedRef.current = true;
    setPaused(true);
    invokePlaylistPause();
    pauseProjectorVideo();
    setLiveStatus("Пауза");
  }, [applyCardPlayback, cards]);

  const openProjector = useCallback(async () => {
    const open = await ensureProjectorOutputOpen({ focus: true });
    if (!open) {
      setLiveStatus("Разрешите всплывающие окна для проектора");
      return;
    }
    setIsProjectorOpen(true);
    showProjectorHold(projectorMediaCtx);
    setLiveStatus("Проектор открыт — кликните по экрану, если видео не стартует");
  }, [projectorMediaCtx]);

  useEffect(() => {
    if (!runActive || !isProjectorWindowOpen()) return;
    const videoCount = playbookData?.videos?.length ?? 0;
    const holdCount = playbookData?.holdImages?.length ?? 0;
    if (videoCount === 0 && holdCount === 0) return;
    showProjectorHold(projectorMediaCtx);
  }, [
    runActive,
    playbookData?.holdImages?.length,
    playbookData?.videos?.length,
    projectorMediaCtx,
  ]);

  const closeProjector = useCallback(() => {
    closeProjectorWindow();
    setIsProjectorOpen(false);
    setLiveStatus("Проектор закрыт");
  }, []);

  const openCreateModal = useCallback(() => {
    setModalMode("create");
    setEditCardId(null);
    setCreateInsertAfterIndex(cards.length === 0 ? null : clampedIndex);
    setModalOpen(true);
  }, [cards.length, clampedIndex]);

  const openEditModal = useCallback(() => {
    const card = cards[clampedIndex];
    if (!card) return;
    setModalMode("edit");
    setEditCardId(card.id);
    setModalOpen(true);
  }, [cards, clampedIndex]);

  const closeModal = useCallback(() => setModalOpen(false), []);

  const submitModal = useCallback(
    (draft: NotesRunCardDraft) => {
      const prevCards = notesRunRef.current.cards;
      const prevIds = new Set(prevCards.map((c) => c.id));
      const insertAtIndex =
        modalMode === "create"
          ? createInsertAfterIndex == null
            ? 0
            : createInsertAfterIndex + 1
          : undefined;
      const next = applyNotesRunDraft(
        prevCards,
        modalMode === "edit" ? editCardId : null,
        draft,
        insertAtIndex != null ? { insertAtIndex } : undefined,
      );
      void persistCards(next.cards);
      if (modalMode === "create") {
        const created = next.cards.find((c) => !prevIds.has(c.id));
        if (created) setCardIndex(next.cards.findIndex((c) => c.id === created.id));
      }
      setModalOpen(false);
      setLiveStatus(modalMode === "edit" ? "Карточка сохранена" : "Карточка создана");
    },
    [createInsertAfterIndex, editCardId, modalMode, persistCards],
  );

  const deleteCurrentCard = useCallback(() => {
    const card = cards[clampedIndex];
    if (!card) return;
    if (!window.confirm(`Удалить карточку ${card.cardNo}?`)) return;
    const next = renumberNotesRunCards(cards.filter((c) => c.id !== card.id));
    void persistCards(next);
    setCardIndex(Math.max(0, clampedIndex - 1));
    setLiveStatus("Карточка удалена");
  }, [cards, clampedIndex, persistCards]);

  const initFromScenes = useCallback(() => {
    if (scenes.length === 0) {
      setLiveStatus("В сценарии нет сцен");
      return;
    }
    if (
      cards.length > 0 &&
      !window.confirm("Заменить текущие карточки списком из сцен сценария?")
    ) {
      return;
    }
    const next = buildNotesRunCardsFromScenes(scenes);
    void persistCards(next.cards);
    setCardIndex(0);
    setLiveStatus(`Создано ${next.cards.length} карточек по сценам`);
  }, [cards.length, persistCards, scenes]);

  const modalDraft = useMemo(() => {
    if (modalMode === "edit" && editCardId) {
      const card = cards.find((c) => c.id === editCardId);
      if (card) return buildNotesRunDraftFromCard(card);
    }
    const firstScene = scenes[0];
    const draft = buildEmptyNotesRunDraft();
    if (firstScene?.title) draft.sceneLabel = firstScene.title;
    return draft;
  }, [cards, editCardId, modalMode, scenes]);

  useEffect(() => {
    if (cards.length === 0 || modalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (isKeyboardTypingTarget(event.target)) return;
      event.preventDefault();
      if (event.key === "ArrowLeft") goPrev();
      else goNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cards.length, goNext, goPrev, modalOpen]);

  return {
    cards,
    cardIndex: clampedIndex,
    currentCard,
    runActive,
    paused,
    liveStatus,
    setLiveStatus,
    isProjectorOpen,
    notesLoaded,
    createInsertAfterIndex,
    modalOpen,
    modalMode,
    modalDraft,
    projectorMediaCtx,
    playlist: (playbookData?.playlist ?? []).map((t) => ({ id: t.id, title: t.title ?? "" })),
    sounds: (playbookData?.sounds ?? []).map((s) => ({ id: s.id, title: s.title ?? "" })),
    videos: playbookData?.videos ?? [],
    holdImages: projectorMediaCtx.holdImages ?? [],
    goToIndex,
    goPrev,
    goNext,
    startRun,
    togglePause,
    openProjector,
    closeProjector,
    openCreateModal,
    openEditModal,
    closeModal,
    submitModal,
    deleteCurrentCard,
    initFromScenes,
    reloadFromFolder,
    canGoPrev: clampedIndex > 0,
    canGoNext: clampedIndex < cards.length - 1,
  };
}

export type NotesRunContextValue = ReturnType<typeof useNotesRun>;
