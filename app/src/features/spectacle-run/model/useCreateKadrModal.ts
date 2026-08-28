import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CustomSelectOption } from "../../../shared/core/custom-select/CustomSelect";
import type {
  PlaybookHoldImage,
  PlaybookLightChannelRolesV1,
  PlaybookLightFadersDataV1,
  PlaybookLightProgramsDataV1,
  SceneProjectorSettingsV1,
  PlaybookVideo,
} from "../../playbook/model/playbook-slice";
import type {
  SceneLightKadrRequisiteActionV1,
  ScriptRequisite,
  TheaterSpotlight,
} from "../../../shared/types/script";
import type { RequisiteAssigneeOption } from "../../../shared/components/show-script/components/RequisitesPanel";
import type { ProjectorMediaContext } from "../../projector/model/projector-media";
import { toggleSofitChannel, formatSofitChannelsLabel } from "../../../shared/components/light-console/light-channel-roles";
import type { useLightConsoleState } from "../../../shared/components/light-console/useLightConsoleState";
import { resolveLightPrograms } from "../../../shared/components/light-console/light-console-data";
import {
  buildInitialCreateKadrDraft,
  listCreateKadrFaderOptions,
  syncDraftFaderOptions,
  type CreateKadrDraft,
  type KadrModalMode,
} from "./create-kadr-from-draft";
import {
  parseProjectorSelectValue,
  projectorSelectValue,
  setRunLabelSec,
  toggleRunLabelSec,
  uploadKadrImageMarkdown,
} from "./create-kadr-modal-helpers";

export type CreateKadrModalProps = {
  isOpen: boolean;
  mode: KadrModalMode;
  nextKadrNo: number;
  editKadrNo: number | null;
  initialDraft?: CreateKadrDraft | null;
  projectName: string;
  lightChannels: string[];
  lightFaders: PlaybookLightFadersDataV1 | null;
  lightPrograms: PlaybookLightProgramsDataV1 | null;
  lightChannelRoles: PlaybookLightChannelRolesV1 | null;
  spotlights: TheaterSpotlight[];
  liveConsole: ReturnType<typeof useLightConsoleState>;
  playlist: Array<{ id: number; title: string }>;
  sounds: Array<{ id: number; title: string }>;
  videos: PlaybookVideo[];
  holdImages: PlaybookHoldImage[];
  projector?: SceneProjectorSettingsV1 | null;
  sceneRequisites?: ScriptRequisite[];
  assigneeOptions?: RequisiteAssigneeOption[];
  accessToken?: string | null;
  onSceneRequisitesChange?: (next: ScriptRequisite[]) => void;
  onClose: () => void;
  onSubmit: (draft: CreateKadrDraft) => void;
};

export function useCreateKadrModal({
  isOpen,
  mode,
  nextKadrNo,
  editKadrNo,
  initialDraft = null,
  projectName,
  lightChannels,
  lightFaders,
  lightPrograms,
  lightChannelRoles,
  spotlights,
  liveConsole,
  playlist,
  sounds,
  videos,
  holdImages,
  projector = null,
  sceneRequisites = [],
  assigneeOptions = [],
  accessToken = null,
  onSceneRequisitesChange,
  onClose,
  onSubmit,
}: CreateKadrModalProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const imagePreviewUrlRef = useRef<string | null>(null);
  const wasOpenRef = useRef(false);
  const faderOptionsSyncedKeyRef = useRef("");
  const skipNextFaderSyncRef = useRef(false);
  const [draft, setDraft] = useState<CreateKadrDraft>(() =>
    buildInitialCreateKadrDraft({
      lightChannelsCount: lightChannels.length,
      lightChannelRoles,
      liveConsoleChannel: liveConsole.selectedLightSlot,
      liveFaders: liveConsole.faders,
      lightFaders: lightFaders ?? liveConsole.faders,
      lightPrograms,
      spotlights,
    }),
  );
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const projectorCtx = useMemo<ProjectorMediaContext>(
    () => ({
      projectSlug: projectName,
      videos,
      holdImages,
      projector,
    }),
    [holdImages, projectName, projector, videos],
  );

  const baseFaders = lightFaders ?? liveConsole.faders;
  const programs = resolveLightPrograms(lightPrograms ?? liveConsole.programs);

  const liveFadersKey = useMemo(
    () =>
      liveConsole.faders.faders
        .map((fader) => `${fader.id}:${fader.intensity ?? 0}:${fader.enabled ?? true}`)
        .join("|"),
    [liveConsole.faders.faders],
  );

  const programsChannelKey = useMemo(
    () =>
      programs.programs
        .map((program) => {
          const faderLevels = program.faders
            .map((fader) => `${fader.faderId}:${fader.intensity ?? 0}`)
            .join(",");
          return `${program.id}:${faderLevels}`;
        })
        .join(";"),
    [programs.programs],
  );

  const recordChannelsKey = draft.recordChannels.join(",");

  const faderOptions = useMemo(
    () =>
      listCreateKadrFaderOptions({
        recordChannels: draft.recordChannels,
        liveConsoleChannel: liveConsole.selectedLightSlot,
        liveFaders: liveConsole.faders,
        lightFaders: baseFaders,
        lightPrograms: programs,
        spotlights,
        lightChannelsCount: lightChannels.length,
      }),
    [
      baseFaders,
      lightChannels.length,
      liveConsole.faders,
      liveConsole.selectedLightSlot,
      liveFadersKey,
      programs,
      programsChannelKey,
      recordChannelsKey,
      spotlights,
    ],
  );

  const isEditMode = mode === "edit";
  const modalKadrNo = isEditMode ? editKadrNo ?? nextKadrNo : nextKadrNo;
  const modalTitle = isEditMode
    ? `Редактировать картину ${modalKadrNo}`
    : `Новая картина ${modalKadrNo}`;
  const submitLabel = isEditMode ? "Сохранить" : "Создать картину";

  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!justOpened) return;

    const nextDraft =
      isEditMode && initialDraft
        ? initialDraft
        : buildInitialCreateKadrDraft({
            lightChannelsCount: lightChannels.length,
            lightChannelRoles,
            liveConsoleChannel: liveConsole.selectedLightSlot,
            liveFaders: liveConsole.faders,
            lightFaders: baseFaders,
            lightPrograms,
            spotlights,
          });
    setDraft(nextDraft);
    faderOptionsSyncedKeyRef.current = "";
    skipNextFaderSyncRef.current = true;
    setImageError(null);
    setImagePreviewUrl(null);
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = null;
    }
  }, [
    baseFaders,
    initialDraft,
    isEditMode,
    isOpen,
    lightChannelRoles,
    lightChannels.length,
    lightPrograms,
    liveConsole.faders,
    liveConsole.selectedLightSlot,
    spotlights,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const optionKeys = faderOptions.map((item) => item.key).join("|");
    if (skipNextFaderSyncRef.current) {
      skipNextFaderSyncRef.current = false;
      faderOptionsSyncedKeyRef.current = optionKeys;
      return;
    }
    if (optionKeys === faderOptionsSyncedKeyRef.current) return;
    faderOptionsSyncedKeyRef.current = optionKeys;

    setDraft((prev) => {
      const synced = syncDraftFaderOptions(prev, faderOptions);
      if (
        synced.includedFaderKeys.length === prev.includedFaderKeys.length &&
        synced.includedFaderKeys.every((key, index) => key === prev.includedFaderKeys[index]) &&
        Object.keys(synced.faderLevels).length === Object.keys(prev.faderLevels).length &&
        Object.entries(synced.faderLevels).every(
          ([key, level]) => prev.faderLevels[key] === level,
        )
      ) {
        return prev;
      }
      return { ...prev, ...synced };
    });
  }, [faderOptions, isOpen, recordChannelsKey]);

  const toggleFader = useCallback((key: string, defaultLevel: number) => {
    setDraft((prev) => {
      const included = prev.includedFaderKeys.includes(key);
      if (included) {
        return {
          ...prev,
          includedFaderKeys: prev.includedFaderKeys.filter((item) => item !== key),
        };
      }
      const level =
        prev.faderLevels[key] != null
          ? prev.faderLevels[key]
          : Math.min(1, Math.max(0, defaultLevel));
      return {
        ...prev,
        includedFaderKeys: [...prev.includedFaderKeys, key],
        faderLevels: { ...prev.faderLevels, [key]: level },
      };
    });
  }, []);

  const setFaderLevel = useCallback((key: string, raw: number) => {
    const level = Math.min(1, Math.max(0, raw));
    setDraft((prev) => ({
      ...prev,
      includedFaderKeys: prev.includedFaderKeys.includes(key)
        ? prev.includedFaderKeys
        : [...prev.includedFaderKeys, key],
      faderLevels: { ...prev.faderLevels, [key]: level },
    }));
  }, []);

  const toggleSound = useCallback((soundId: number) => {
    setDraft((prev) => {
      const has = prev.soundIds.includes(soundId);
      return {
        ...prev,
        soundIds: has
          ? prev.soundIds.filter((id) => id !== soundId)
          : [...prev.soundIds, soundId],
      };
    });
  }, []);

  const toggleRequisiteCue = useCallback((
    requisiteId: number,
    action: SceneLightKadrRequisiteActionV1 = "setup",
  ) => {
    setDraft((prev) => {
      const exists = prev.requisites.some((cue) => cue.requisiteId === requisiteId);
      if (exists) {
        return {
          ...prev,
          requisites: prev.requisites.filter((cue) => cue.requisiteId !== requisiteId),
        };
      }
      return {
        ...prev,
        requisites: [...prev.requisites, { requisiteId, action }],
      };
    });
  }, []);

  const setRequisiteAction = useCallback(
    (requisiteId: number, action: SceneLightKadrRequisiteActionV1) => {
      setDraft((prev) => ({
        ...prev,
        requisites: prev.requisites.map((cue) =>
          cue.requisiteId === requisiteId ? { ...cue, action } : cue,
        ),
      }));
    },
    [],
  );

  const toggleChannel = useCallback(
    (channel: number) => {
      setDraft((prev) => {
        const roles = toggleSofitChannel(
          { v: 1, sofitChannels: prev.recordChannels },
          channel,
          lightChannels.length,
        );
        return { ...prev, recordChannels: roles.sofitChannels };
      });
    },
    [lightChannels.length],
  );

  useEffect(
    () => () => {
      if (imagePreviewUrlRef.current) {
        URL.revokeObjectURL(imagePreviewUrlRef.current);
        imagePreviewUrlRef.current = null;
      }
    },
    [],
  );

  const handleImageFile = async (file: File | null) => {
    if (!file || !projectName) return;
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = null;
    }
    const localPreview = URL.createObjectURL(file);
    imagePreviewUrlRef.current = localPreview;
    setImagePreviewUrl(localPreview);
    setImageBusy(true);
    setImageError(null);
    try {
      const snippet = await uploadKadrImageMarkdown(projectName, file);
      if (!snippet) {
        setImageError("Не удалось загрузить картинку");
        return;
      }
      setDraft((prev) => ({
        ...prev,
        imageMarkdown: `${prev.imageMarkdown.trim()}\n${snippet}`.trim(),
      }));
    } catch (err) {
      setImageError(String((err as Error)?.message ?? "Ошибка загрузки"));
    } finally {
      setImageBusy(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handlePasteImage = async (event: React.ClipboardEvent) => {
    const items = Array.from(event.clipboardData?.items ?? []);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    event.preventDefault();
    await handleImageFile(file);
  };

  const handleSubmit = () => {
    onSubmit(draftRef.current);
  };

  const handleSceneRequisitesChange = (next: ScriptRequisite[]) => {
    onSceneRequisitesChange?.(next);
    const ids = new Set(next.map((item) => item.id));
    setDraft((prev) => ({
      ...prev,
      requisites: prev.requisites.filter((cue) => ids.has(cue.requisiteId)),
    }));
  };

  const setTitle = (title: string) => {
    setDraft((prev) => ({ ...prev, title }));
  };

  const setPlayTrackId = (value: string) => {
    const id = Math.trunc(Number(value) || 0);
    setDraft((prev) => ({
      ...prev,
      playTrackId: id > 0 ? id : null,
    }));
  };

  const setProjectorCue = (value: string) => {
    setDraft((prev) => ({
      ...prev,
      projectorCue: parseProjectorSelectValue(value, prev.projectorCue),
    }));
  };

  const toggleProjectorMuted = () => {
    setDraft((prev) => {
      if (prev.projectorCue?.mode !== "video") return prev;
      const nextMuted = !prev.projectorCue.muted;
      return {
        ...prev,
        projectorCue: nextMuted
          ? { ...prev.projectorCue, muted: true }
          : { mode: "video", videoId: prev.projectorCue.videoId },
      };
    });
  };

  const toggleBlackout = () => {
    setDraft((prev) => ({
      ...prev,
      blackout: !prev.blackout,
    }));
  };

  const setProgramId = (value: string) => {
    setDraft((prev) => ({
      ...prev,
      programId: Math.max(1, Math.trunc(Number(value) || 1)),
    }));
  };

  const setCommentText = (commentText: string) => {
    setDraft((prev) => ({ ...prev, commentText }));
  };

  const setTransitionText = (transitionText: string) => {
    setDraft((prev) => ({ ...prev, transitionText }));
  };

  const toggleBlackoutDuration = () => {
    setDraft((prev) => toggleRunLabelSec(prev, "blackoutDurationSec"));
  };

  const toggleSmokeDuration = () => {
    setDraft((prev) => toggleRunLabelSec(prev, "smokeDurationSec"));
  };

  const setBlackoutDurationSec = (raw: string) => {
    setDraft((prev) => setRunLabelSec(prev, "blackoutDurationSec", raw));
  };

  const setSmokeDurationSec = (raw: string) => {
    setDraft((prev) => setRunLabelSec(prev, "smokeDurationSec", raw));
  };

  const projectorValue = projectorSelectValue(draft.projectorCue);
  const projectorPreviewMode = draft.projectorCue?.mode ?? null;
  const projectorPreviewVideoId =
    draft.projectorCue?.mode === "video" ? draft.projectorCue.videoId : null;
  const projectorPreviewHoldId =
    draft.projectorCue?.mode === "hold" ? (draft.projectorCue.holdId ?? null) : null;
  const isProjectorVideo = draft.projectorCue?.mode === "video";
  const projectorVideoMuted =
    draft.projectorCue?.mode === "video" && Boolean(draft.projectorCue.muted);
  const projectorPreviewTitle =
    projectorPreviewMode === "video"
      ? videos.find((video) => video.id === projectorPreviewVideoId)?.title?.trim() ||
        (projectorPreviewVideoId != null ? `Видео ${projectorPreviewVideoId}` : "Видео")
      : projectorPreviewMode === "hold"
        ? holdImages.find((hold) => hold.id === projectorPreviewHoldId)?.title?.trim() ||
          (projectorPreviewHoldId != null ? `Заставка ${projectorPreviewHoldId}` : "Заставка")
        : "";
  const channelsLabel = formatSofitChannelsLabel(draft.recordChannels);
  const programCount = Math.max(lightChannels.length, programs.programs.length, 8);

  const playlistOptions: CustomSelectOption[] = [
    { value: "", label: "— без музыки —" },
    ...playlist.map((track) => ({
      value: String(track.id),
      label: track.title?.trim() || `Трек ${track.id}`,
    })),
  ];

  const projectorOptions: CustomSelectOption[] = [
    { value: "none", label: "— без видео —" },
    { value: "hold", label: "Заставка по умолчанию" },
    ...holdImages.map((hold) => ({
      value: `hold:${hold.id}`,
      label: `Заставка: ${hold.title?.trim() || hold.id}`,
    })),
    ...videos.map((video) => ({
      value: String(video.id),
      label: `Видео: ${video.title?.trim() || video.id}`,
    })),
  ];

  const programOptions: CustomSelectOption[] = Array.from(
    { length: programCount },
    (_, index) => {
      const id = index + 1;
      const program = programs.programs.find((item) => item.id === id);
      const label = program?.label?.trim() || `П${id}`;
      return {
        value: String(id),
        label: `П${id} · ${label}`,
      };
    },
  );

  return {
    isOpen,
    onClose,
    modalTitle,
    submitLabel,
    draft,
    setTitle,
    playlist,
    sounds,
    playlistOptions,
    setPlayTrackId,
    toggleSound,
    projectorCtx,
    projectorValue,
    projectorOptions,
    setProjectorCue,
    isProjectorVideo,
    projectorVideoMuted,
    toggleProjectorMuted,
    projectorPreviewMode,
    projectorPreviewVideoId,
    projectorPreviewHoldId,
    projectorPreviewTitle,
    lightChannels,
    faderOptions,
    programOptions,
    channelsLabel,
    toggleBlackout,
    setProgramId,
    toggleChannel,
    toggleFader,
    setFaderLevel,
    setCommentText,
    setTransitionText,
    toggleBlackoutDuration,
    toggleSmokeDuration,
    setBlackoutDurationSec,
    setSmokeDurationSec,
    imageInputRef,
    imageBusy,
    imageError,
    imagePreviewUrl,
    handleImageFile,
    handlePasteImage,
    sceneRequisites,
    assigneeOptions,
    accessToken,
    projectName,
    handleSceneRequisitesChange,
    toggleRequisiteCue,
    setRequisiteAction,
    handleSubmit,
  };
}
