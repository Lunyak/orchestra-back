import cn from "classnames";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "../../../shared/core/modal/Modal";
import type {
  SceneHoldImage,
  SceneLightChannelRolesV1,
  SceneLightFadersDataV1,
  SceneLightProgramsDataV1,
  SceneProjectorSettingsV1,
  SceneVideo,
} from "../../scene/model/scene-slice";
import type { TheaterSpotlight } from "../../../shared/types/script";
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
  buildFaderLevelsFromOptions,
  buildInitialCreateKadrDraft,
  listCreateKadrFaderOptions,
  type CreateKadrDraft,
  type KadrModalMode,
} from "../model/create-kadr-from-draft";
import "./create-kadr-modal.css";

export type CreateKadrModalProps = {
  isOpen: boolean;
  mode: KadrModalMode;
  nextKadrNo: number;
  editKadrNo: number | null;
  initialDraft?: CreateKadrDraft | null;
  projectName: string;
  lightChannels: string[];
  lightFaders: SceneLightFadersDataV1 | null;
  lightPrograms: SceneLightProgramsDataV1 | null;
  lightChannelRoles: SceneLightChannelRolesV1 | null;
  spotlights: TheaterSpotlight[];
  liveConsole: ReturnType<typeof useLightConsoleState>;
  playlist: Array<{ id: number; title: string }>;
  sounds: Array<{ id: number; title: string }>;
  videos: SceneVideo[];
  holdImages: SceneHoldImage[];
  projector?: SceneProjectorSettingsV1 | null;
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

function parseProjectorSelectValue(value: string): KadrProjectorCue | null {
  if (!value || value === "none") return null;
  if (value === "hold") return { mode: "hold" };
  if (value.startsWith("hold:")) {
    const holdId = Math.trunc(Number(value.slice(5)) || 0);
    return holdId > 0 ? { mode: "hold", holdId } : { mode: "hold" };
  }
  const videoId = Math.trunc(Number(value) || 0);
  return videoId > 0 ? { mode: "video", videoId } : null;
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
  onClose,
  onSubmit,
}: CreateKadrModalProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const imagePreviewUrlRef = useRef<string | null>(null);
  const wasOpenRef = useRef(false);
  const prevFaderOptionKeysRef = useRef<string[]>([]);
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
    prevFaderOptionKeysRef.current = [];
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
    const allOptionKeys = faderOptions.map((item) => item.key);
    const prevKeys = prevFaderOptionKeysRef.current;
    const newlyAppeared = allOptionKeys.filter((key) => !prevKeys.includes(key));
    prevFaderOptionKeysRef.current = allOptionKeys;

    if (newlyAppeared.length === 0) return;

    const validKeys = new Set(allOptionKeys);
    setDraft((prev) => {
      const kept = prev.includedFaderKeys.filter((key) => validKeys.has(key));
      const toAdd = newlyAppeared.filter((key) => !kept.includes(key));
      if (toAdd.length === 0) return prev;
      const nextKeys = [...kept, ...toAdd];
      const nextLevels = buildFaderLevelsFromOptions(faderOptions, prev.faderLevels);
      return { ...prev, includedFaderKeys: nextKeys, faderLevels: nextLevels };
    });
  }, [faderOptions, recordChannelsKey]);

  const toggleFader = useCallback((key: string) => {
    setDraft((prev) => {
      const included = prev.includedFaderKeys.includes(key);
      return {
        ...prev,
        includedFaderKeys: included
          ? prev.includedFaderKeys.filter((item) => item !== key)
          : [...prev.includedFaderKeys, key],
      };
    });
  }, []);

  const setFaderLevel = useCallback((key: string, raw: number) => {
    const level = Math.min(1, Math.max(0, raw));
    setDraft((prev) => ({
      ...prev,
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
    onSubmit(draft);
  };

  const projectorValue = projectorSelectValue(draft.projectorCue);
  const projectorPreviewMode = draft.projectorCue?.mode ?? null;
  const projectorPreviewVideoId =
    draft.projectorCue?.mode === "video" ? draft.projectorCue.videoId : null;
  const projectorPreviewHoldId =
    draft.projectorCue?.mode === "hold" ? (draft.projectorCue.holdId ?? null) : null;
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="create-kadr-modal"
      ariaLabel={modalTitle}
    >
      <header className="create-kadr-modal__head">
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
            <select
              className="create-kadr-modal__select"
              value={draft.playTrackId ?? ""}
              onChange={(e) => {
                const id = Math.trunc(Number(e.target.value) || 0);
                setDraft((prev) => ({
                  ...prev,
                  playTrackId: id > 0 ? id : null,
                }));
              }}
            >
              <option value="">— без музыки —</option>
              {playlist.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.title?.trim() || `Трек ${track.id}`}
                </option>
              ))}
            </select>
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
          <label className="create-kadr-modal__field">
            <span className="create-kadr-modal__label">Видео или заставка</span>
            <select
              className="create-kadr-modal__select"
              value={projectorValue}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  projectorCue: parseProjectorSelectValue(e.target.value),
                }))
              }
            >
              <option value="none">— без видео —</option>
              <option value="hold">Заставка по умолчанию</option>
              {holdImages.map((hold) => (
                <option key={`hold-${hold.id}`} value={`hold:${hold.id}`}>
                  Заставка: {hold.title?.trim() || hold.id}
                </option>
              ))}
              {videos.map((video) => (
                <option key={`video-${video.id}`} value={String(video.id)}>
                  Видео: {video.title?.trim() || video.id}
                </option>
              ))}
            </select>
          </label>
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
                <select
                  className="create-kadr-modal__select"
                  value={draft.programId}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      programId: Math.max(1, Math.trunc(Number(e.target.value) || 1)),
                    }))
                  }
                >
                  {Array.from({ length: programCount }, (_, index) => {
                    const id = index + 1;
                    const program = programs.programs.find((item) => item.id === id);
                    const label = program?.label?.trim() || `П${id}`;
                    return (
                      <option key={id} value={id}>
                        П{id} · {label}
                      </option>
                    );
                  })}
                </select>
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
                      const level =
                        draft.faderLevels[item.key] ?? item.intensity;
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
                          <label className="create-kadr-modal__fader-head">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleFader(item.key)}
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
              В тех. карте картина будет помечена как блекаут.
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
