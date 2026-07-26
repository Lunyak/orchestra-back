import cn from "classnames";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CustomSelect,
  type CustomSelectOption,
} from "../../../shared/core/custom-select/CustomSelect";
import { Modal } from "../../../shared/core/modal/Modal";
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
  TheaterModel,
  TheaterSpotlight,
} from "../../../shared/types/script";
import type { RequisiteAssigneeOption } from "../../../shared/components/show-script/components/RequisitesPanel";
import { CreateKadrRequisitesSection } from "./CreateKadrRequisitesSection";
import type { KadrProjectorCue } from "../../theater/model/kadr-projector";
import { ProjectorMediaPreview } from "../../projector/ui/ProjectorMediaPreview";
import type { ProjectorMediaContext } from "../../projector/model/projector-media";
import { toggleSofitChannel, formatSofitChannelsLabel } from "../../../shared/components/light-console/light-channel-roles";
import type { useLightConsoleState } from "../../../shared/components/light-console/useLightConsoleState";
import { resolveLightPrograms } from "../../../shared/components/light-console/light-console-data";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import { desktopAddProjectImage } from "../../../shared/platform/desktop-methods";
import { uploadProjectFile } from "../../../sync/api/files";
import { ensureProject } from "../../../sync/api/projects";
import {
  buildInitialCreateKadrDraft,
  listCreateKadrFaderOptions,
  syncDraftFaderOptions,
  type CreateKadrDraft,
  type KadrModalMode,
} from "../model/create-kadr-from-draft";
import "@shared/components/create-kadr-modal/create-kadr-modal.css";

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
  theaterModels?: TheaterModel[];
  assigneeOptions?: RequisiteAssigneeOption[];
  accessToken?: string | null;
  onSceneRequisitesChange?: (next: ScriptRequisite[]) => void;
  onClose: () => void;
  onSubmit: (draft: CreateKadrDraft) => void;
};

async function uploadKadrImageMarkdown(
  projectName: string,
  file: File,
): Promise<string | null> {
  const alt = (file.name.replace(/\.[^.]+$/, "") || "картинка").trim() || "картинка";
  const desktopApi = getDesktopApi();
  if (desktopApi) {
    const buffer = await file.arrayBuffer();
    const result = await desktopAddProjectImage(
      desktopApi,
      projectName,
      buffer,
      file.type,
      file.name,
    );
    if (!result?.markdownPath) return null;
    return `\n![${alt}](${result.markdownPath})\n`;
  }

  const accessToken =
    typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null;
  if (!accessToken) return null;

  const project = await ensureProject(accessToken, projectName, `Проект ${projectName}`);
  const { key } = await uploadProjectFile(accessToken, {
    projectId: project.id,
    type: "image",
    file,
  });
  const token = `orchestra-image:${encodeURIComponent(key)}`;
  return `\n![${alt}](${token})\n`;
}

function parseProjectorSelectValue(
  value: string,
  previousCue: KadrProjectorCue | null = null,
): KadrProjectorCue | null {
  const preserveMuted =
    previousCue?.mode === "video" ? Boolean(previousCue.muted) : false;

  if (!value || value === "none") return null;
  if (value === "hold") return { mode: "hold" };
  if (value.startsWith("hold:")) {
    const holdId = Math.trunc(Number(value.slice(5)) || 0);
    return holdId > 0 ? { mode: "hold", holdId } : { mode: "hold" };
  }
  const videoId = Math.trunc(Number(value) || 0);
  if (videoId <= 0) return null;
  return preserveMuted
    ? { mode: "video", videoId, muted: true }
    : { mode: "video", videoId };
}

const DEFAULT_RUN_LABEL_SEC = 30;

function toggleRunLabelSec(
  prev: CreateKadrDraft,
  field: "blackoutDurationSec" | "smokeDurationSec",
): CreateKadrDraft {
  const enabled = prev[field] != null;
  return { ...prev, [field]: enabled ? null : DEFAULT_RUN_LABEL_SEC };
}

function setRunLabelSec(
  prev: CreateKadrDraft,
  field: "blackoutDurationSec" | "smokeDurationSec",
  raw: string,
): CreateKadrDraft {
  const seconds = Math.trunc(Number(raw) || 0);
  return { ...prev, [field]: seconds > 0 ? seconds : null };
}

function projectorSelectValue(cue: KadrProjectorCue | null): string {
  if (!cue) return "none";
  if (cue.mode === "hold") {
    return cue.holdId != null && cue.holdId > 0 ? `hold:${cue.holdId}` : "hold";
  }
  return String(cue.videoId);
}

export function CreateKadrModal({
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
  theaterModels = [],
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

  const toggleRequisiteCue = useCallback((requisiteId: number) => {
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
        requisites: [...prev.requisites, { requisiteId, action: "setup" }],
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="create-kadr-modal"
      ariaLabel={modalTitle}
    >
      <header className="create-kadr-modal__header">
        <h2 className="create-kadr-modal__title" id="create-kadr-modal-title">
          {modalTitle}
        </h2>
        <button type="button" className="create-kadr-modal__close" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="create-kadr-modal__body">
        <label className="create-kadr-modal__field">
          <span className="create-kadr-modal__label">Название</span>
          <input
            type="text"
            className="create-kadr-modal__input"
            value={draft.title}
            placeholder="Необязательно"
            onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
          />
        </label>

        <section className="create-kadr-modal__section">
          <h3 className="create-kadr-modal__section-title">Звук</h3>
          <label className="create-kadr-modal__field">
            <span className="create-kadr-modal__label">Музыка из плейлиста</span>
            <CustomSelect
              value={draft.playTrackId != null ? String(draft.playTrackId) : ""}
              options={playlistOptions}
              onChange={(value) => {
                const id = Math.trunc(Number(value) || 0);
                setDraft((prev) => ({
                  ...prev,
                  playTrackId: id > 0 ? id : null,
                }));
              }}
              searchable={playlist.length > 6}
              className="create-kadr-modal__select"
              aria-label="Музыка из плейлиста"
            />
          </label>
          {sounds.length > 0 ? (
            <div className="create-kadr-modal__checks">
              <span className="create-kadr-modal__label">Звуковые эффекты</span>
              <div className="create-kadr-modal__check-grid">
                {sounds.map((sound) => {
                  const checked = draft.soundIds.includes(sound.id);
                  return (
                    <label
                      key={sound.id}
                      className={cn("create-kadr-modal__check", checked && "create-kadr-modal__check--active")}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSound(sound.id)}
                      />
                      <span>{sound.title?.trim() || `SFX ${sound.id}`}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>

        <section className="create-kadr-modal__section">
          <h3 className="create-kadr-modal__section-title">Проектор</h3>
          <div className="create-kadr-modal__projector-row">
            <label className="create-kadr-modal__field create-kadr-modal__field--grow">
              <span className="create-kadr-modal__label">Видео или заставка</span>
              <CustomSelect
                value={projectorValue}
                options={projectorOptions}
                onChange={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    projectorCue: parseProjectorSelectValue(value, prev.projectorCue),
                  }))
                }
                searchable={projectorOptions.length > 8}
                className="create-kadr-modal__select"
                aria-label="Видео или заставка"
              />
            </label>
            {isProjectorVideo ? (
              <label
                className={cn(
                  "create-kadr-modal__check",
                  "create-kadr-modal__check--projector-mute",
                  projectorVideoMuted && "create-kadr-modal__check--active",
                )}
              >
                <input
                  type="checkbox"
                  checked={projectorVideoMuted}
                  onChange={() =>
                    setDraft((prev) => {
                      if (prev.projectorCue?.mode !== "video") return prev;
                      const nextMuted = !prev.projectorCue.muted;
                      return {
                        ...prev,
                        projectorCue: nextMuted
                          ? { ...prev.projectorCue, muted: true }
                          : { mode: "video", videoId: prev.projectorCue.videoId },
                      };
                    })
                  }
                />
                <span>Без звука</span>
              </label>
            ) : null}
          </div>
          {projectorPreviewMode ? (
            <ProjectorMediaPreview
              ctx={projectorCtx}
              mode={projectorPreviewMode}
              videoId={projectorPreviewVideoId}
              holdId={projectorPreviewHoldId}
              title={projectorPreviewTitle}
              className="create-kadr-modal__projector-preview"
            />
          ) : null}
        </section>

        <section className="create-kadr-modal__section">
          <h3 className="create-kadr-modal__section-title">Свет</h3>
          <label
            className={cn(
              "create-kadr-modal__check",
              "create-kadr-modal__check--blackout",
              draft.blackout && "create-kadr-modal__check--active",
            )}
          >
            <input
              type="checkbox"
              checked={draft.blackout}
              onChange={() =>
                setDraft((prev) => ({
                  ...prev,
                  blackout: !prev.blackout,
                }))
              }
            />
            <span>Блекаут — свет выключен</span>
          </label>

          {!draft.blackout ? (
            <>
              <label className="create-kadr-modal__field">
                <span className="create-kadr-modal__label">Программа</span>
                <CustomSelect
                  value={String(draft.programId)}
                  options={programOptions}
                  onChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      programId: Math.max(1, Math.trunc(Number(value) || 1)),
                    }))
                  }
                  searchable={false}
                  className="create-kadr-modal__select"
                  aria-label="Программа света"
                />
              </label>

              <div className="create-kadr-modal__channels">
                <span className="create-kadr-modal__label">Каналы K</span>
                <div className="create-kadr-modal__channel-grid">
                  {lightChannels.map((_, index) => {
                    const channel = index + 1;
                    const active = draft.recordChannels.includes(channel);
                    return (
                      <button
                        key={channel}
                        type="button"
                        className={cn(
                          "create-kadr-modal__channel-btn",
                          active && "create-kadr-modal__channel-btn--active",
                        )}
                        aria-pressed={active}
                        onClick={() => toggleChannel(channel)}
                      >
                        K{channel}
                      </button>
                    );
                  })}
                </div>
                <span className="create-kadr-modal__hint">{channelsLabel || "Каналы не выбраны"}</span>
              </div>

              {faderOptions.length > 0 ? (
                <div className="create-kadr-modal__faders">
                  <span className="create-kadr-modal__label">Фейдеры F</span>
                  <div className="create-kadr-modal__fader-grid">
                    {faderOptions.map((item) => {
                      const checked = draft.includedFaderKeys.includes(item.key);
                      const level = draft.faderLevels[item.key] ?? 0;
                      const levelPct = Math.round(
                        Math.min(1, Math.max(0, level)) * 100,
                      );
                      return (
                        <div
                          key={item.key}
                          className={cn(
                            "create-kadr-modal__fader",
                            checked && "create-kadr-modal__fader--active",
                            !item.enabled && "create-kadr-modal__fader--dim",
                          )}
                        >
                          <label className="create-kadr-modal__fader-header">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleFader(item.key, item.intensity)}
                            />
                            <span className="create-kadr-modal__fader-label">
                              {item.label}
                            </span>
                            <span className="create-kadr-modal__fader-level">
                              {levelPct}%
                            </span>
                          </label>
                          {checked ? (
                            <input
                              className="create-kadr-modal__fader-slider"
                              type="range"
                              min={0}
                              max={100}
                              step={1}
                              value={levelPct}
                              onChange={(event) =>
                                setFaderLevel(
                                  item.key,
                                  Number(event.target.value) / 100,
                                )
                              }
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="create-kadr-modal__hint">
                  Нет фейдеров на выбранных каналах — отметьте K или настройте софиты в 3D.
                </p>
              )}
            </>
          ) : (
            <p className="create-kadr-modal__hint">
              В прогоне картина будет помечена как блекаут.
            </p>
          )}
        </section>

        <section className="create-kadr-modal__section">
          <h3 className="create-kadr-modal__section-title">Комментарий</h3>
          <p className="create-kadr-modal__hint">
            Показывается на карточке в прогоне.
          </p>
          <label className="create-kadr-modal__field">
            <span className="create-kadr-modal__label">Текст комментария</span>
            <textarea
              className="create-kadr-modal__textarea"
              value={draft.commentText}
              placeholder="Например: дождаться аплодисментов, затем блекаут"
              rows={3}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, commentText: e.target.value }))
              }
            />
          </label>
        </section>

        <section className="create-kadr-modal__section">
          <h3 className="create-kadr-modal__section-title">Переход</h3>
          <p className="create-kadr-modal__hint">
            Показывается внизу в прогоне при навигации, не на карточке.
          </p>
          <label className="create-kadr-modal__field">
            <span className="create-kadr-modal__label">Текст перехода</span>
            <input
              type="text"
              className="create-kadr-modal__input"
              value={draft.transitionText}
              placeholder="Например: пауза 3 сек, затем следующая картина"
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, transitionText: e.target.value }))
              }
            />
          </label>
        </section>

        <section className="create-kadr-modal__section">
          <h3 className="create-kadr-modal__section-title">Метки на карточке</h3>
          <p className="create-kadr-modal__hint">
            Отображаются в правом верхнем углу карточки в прогоне.
          </p>
          <div className="create-kadr-modal__label-rows">
            <div className="create-kadr-modal__label-row">
              <label
                className={cn(
                  "create-kadr-modal__check",
                  draft.blackoutDurationSec != null && "create-kadr-modal__check--active",
                )}
              >
                <input
                  type="checkbox"
                  checked={draft.blackoutDurationSec != null}
                  onChange={() =>
                    setDraft((prev) => toggleRunLabelSec(prev, "blackoutDurationSec"))
                  }
                />
                <span>Блекаут</span>
              </label>
              <label className="create-kadr-modal__duration-field">
                <input
                  type="number"
                  className="create-kadr-modal__input create-kadr-modal__input--duration"
                  min={1}
                  step={1}
                  disabled={draft.blackoutDurationSec == null}
                  value={draft.blackoutDurationSec ?? ""}
                  onChange={(e) =>
                    setDraft((prev) =>
                      setRunLabelSec(prev, "blackoutDurationSec", e.target.value),
                    )
                  }
                />
                <span className="create-kadr-modal__duration-unit">сек</span>
              </label>
            </div>
            <div className="create-kadr-modal__label-row">
              <label
                className={cn(
                  "create-kadr-modal__check",
                  draft.smokeDurationSec != null && "create-kadr-modal__check--active",
                )}
              >
                <input
                  type="checkbox"
                  checked={draft.smokeDurationSec != null}
                  onChange={() =>
                    setDraft((prev) => toggleRunLabelSec(prev, "smokeDurationSec"))
                  }
                />
                <span>Дым-машина</span>
              </label>
              <label className="create-kadr-modal__duration-field">
                <input
                  type="number"
                  className="create-kadr-modal__input create-kadr-modal__input--duration"
                  min={1}
                  step={1}
                  disabled={draft.smokeDurationSec == null}
                  value={draft.smokeDurationSec ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => setRunLabelSec(prev, "smokeDurationSec", e.target.value))
                  }
                />
                <span className="create-kadr-modal__duration-unit">сек</span>
              </label>
            </div>
          </div>
        </section>

        <section className="create-kadr-modal__section">
          <h3 className="create-kadr-modal__section-title">Картинка в тексте кадра</h3>
          <div
            className="create-kadr-modal__image-drop"
            tabIndex={0}
            onPaste={(e) => void handlePasteImage(e)}
          >
            <p className="create-kadr-modal__hint">
              Вставьте из буфера (Ctrl+V) или выберите файл — попадёт в markdown картины.
            </p>
            <button
              type="button"
              className="create-kadr-modal__btn create-kadr-modal__btn--ghost"
              disabled={imageBusy}
              onClick={() => imageInputRef.current?.click()}
            >
              {imageBusy ? "Загрузка…" : "Выбрать файл"}
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void handleImageFile(e.target.files?.[0] ?? null)}
            />
            {draft.imageMarkdown.trim() ? (
              <p className="create-kadr-modal__image-ready" role="status">
                Картинка добавлена
              </p>
            ) : null}
            {imagePreviewUrl ? (
              <img
                src={imagePreviewUrl}
                alt=""
                className="create-kadr-modal__image-preview"
              />
            ) : null}
            {imageError ? (
              <p className="create-kadr-modal__error" role="alert">
                {imageError}
              </p>
            ) : null}
          </div>
        </section>

        <CreateKadrRequisitesSection
          sceneRequisites={sceneRequisites}
          onSceneRequisitesChange={(next) => {
            onSceneRequisitesChange?.(next);
            const ids = new Set(next.map((item) => item.id));
            setDraft((prev) => ({
              ...prev,
              requisites: prev.requisites.filter((cue) => ids.has(cue.requisiteId)),
            }));
          }}
          theaterModels={theaterModels}
          draftCues={draft.requisites}
          onToggleCue={toggleRequisiteCue}
          onCueActionChange={setRequisiteAction}
          assigneeOptions={assigneeOptions}
          accessToken={accessToken}
          projectSlug={projectName}
        />
      </div>

      <footer className="create-kadr-modal__foot">
        <button type="button" className="create-kadr-modal__btn" onClick={onClose}>
          Отмена
        </button>
        <button
          type="button"
          className="create-kadr-modal__btn create-kadr-modal__btn--primary"
          onClick={handleSubmit}
        >
          {submitLabel}
        </button>
      </footer>
    </Modal>
  );
}
