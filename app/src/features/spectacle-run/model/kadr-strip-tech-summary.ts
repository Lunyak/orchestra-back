import type {
  PlaybookLightFadersDataV1,
  PlaybookLightProgramsDataV1,
} from "../../playbook/model/playbook-slice";
import {
  fadersForKadrDisplay,
  findKadrById,
  readSceneLightKadrs,
} from "../../theater/model/light-kadrs";
import type { KadrProjectorCue } from "../../theater/model/kadr-projector";
import { formatFaderShort } from "../../../shared/components/light-console/light-console-labels";
import { buildLightConsoleSplitModel } from "../../../shared/components/light-console/light-console-split";
import { parseLightChannel } from "../../../shared/components/show-script/utils/lightTokens";
import type {
  ScriptScene,
  ScriptRequisite,
  ScriptRequisiteDuty,
  SceneLightKadrRequisiteActionV1,
  SceneLightKadrV1,
} from "../../../shared/types/script";
import { parseKadrTitleFromHeading } from "./create-kadr-from-draft";
import type { KadrRunLabel } from "./kadr-section-labels";
import type { SpectacleTapeItem } from "./spectacle-kadr-tape";

export type KadrStripProjectorPreview = {
  mode: "video" | "hold";
  videoId: number | null;
  holdId: number | null;
  title: string;
  videoMuted?: boolean;
};

export type KadrStripTechRow = {
  label: string;
  value: string;
  multiline?: boolean;
  projectorPreview?: KadrStripProjectorPreview;
};

export type KadrStripRequisiteItem = {
  actionLabel: string;
  name: string;
};

export type KadrStripTechSummary = {
  headingTitle: string;
  rows: KadrStripTechRow[];
  requisites: KadrStripRequisiteItem[];
  blackout: boolean;
  cornerLabels: KadrRunLabel[];
  /** Превью проектора для обложки карточки (hold/video). */
  projectorPreview?: KadrStripProjectorPreview;
};

type MediaLookup = {
  playlist?: Array<{ id: number; title: string }>;
  sounds?: Array<{ id: number; title: string }>;
  videos?: Array<{ id: number; title: string }>;
  holdImages?: Array<{ id: number; title: string }>;
};

function humanizeStripFieldValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-f0-9]{16,}$/i.test(trimmed)) return "";
  if (trimmed.length > 72) return `${trimmed.slice(0, 69)}…`;
  return trimmed;
}

function resolveKadrForItem(
  item: SpectacleTapeItem,
  scene: ScriptScene | undefined,
): SceneLightKadrV1 | undefined {
  if (!scene || item.isPlaceholder) return undefined;
  const kadrs = readSceneLightKadrs(scene);
  return (
    (item.kadrId ? findKadrById(kadrs, item.kadrId) : undefined) ??
    kadrs.kadrs.find((k) => k.kadrNo === item.kadrNo)
  );
}

function programLabel(
  programId: number,
  lightChannels: string[],
  lightPrograms: PlaybookLightProgramsDataV1 | null | undefined,
): string {
  if (programId <= 0) return "блекаут";
  const program = lightPrograms?.programs.find((p) => p.id === programId);
  if (program?.label?.trim()) return program.label.trim();
  const channelRaw = lightChannels[programId - 1];
  if (channelRaw) {
    const parsed = parseLightChannel(channelRaw);
    if (parsed.label) return parsed.label;
  }
  return `П${programId}`;
}

function formatLightSummary(
  kadr: SceneLightKadrV1,
  lightChannels: string[],
  lightFaders: PlaybookLightFadersDataV1,
  lightPrograms: PlaybookLightProgramsDataV1 | null | undefined,
): string {
  if (kadr.blackout || kadr.programId <= 0) return "Блекаут";

  const displayFaders = fadersForKadrDisplay(kadr, lightFaders);
  const split = buildLightConsoleSplitModel({
    programId: kadr.programId,
    lightChannels,
    faders: displayFaders,
    kadrFaderStates: kadr.faders,
    sofitChannels: kadr.recordChannels ?? [],
  });

  return `П${kadr.programId} · ${split.programLabel}`;
}

function formatFaderSummary(kadr: SceneLightKadrV1): string | null {
  const activeFaders = kadr.faders
    .filter((row) => row.enabled !== false && (row.intensity ?? 0) > 0.02)
    .map((row) => {
      const pct = Math.round(Math.min(1, Math.max(0, row.intensity ?? 0)) * 100);
      return `${formatFaderShort(row.faderId)} ${pct}%`;
    });

  if (activeFaders.length === 0) return null;
  return activeFaders.join(", ");
}

function formatSoundSummary(
  kadr: SceneLightKadrV1,
  media: MediaLookup,
): string | null {
  const cue = kadr.sound;
  if (!cue) return null;
  const playTrackIds = cue.playTrackIds ?? [];
  const soundIds = cue.soundIds ?? [];
  if (playTrackIds.length === 0 && soundIds.length === 0) return null;

  const parts: string[] = [];
  for (const trackId of playTrackIds) {
    const title = media.playlist?.find((t) => t.id === trackId)?.title?.trim();
    parts.push(title ? `«${title}»` : `трек ${trackId}`);
  }
  for (const soundId of soundIds) {
    const title = media.sounds?.find((s) => s.id === soundId)?.title?.trim();
    parts.push(title ? `SFX «${title}»` : `SFX ${soundId}`);
  }
  if (cue.volume != null && Number.isFinite(cue.volume) && playTrackIds.length > 0) {
    parts.push(`${Math.round(cue.volume * 100)}%`);
  }

  const value = humanizeStripFieldValue(parts.join(", "));
  return value || null;
}

function buildProjectorPreview(
  cue: KadrProjectorCue,
  media: MediaLookup,
): KadrStripProjectorPreview | undefined {
  if (cue.mode === "video" && cue.videoId > 0) {
    const title =
      media.videos?.find((video) => video.id === cue.videoId)?.title?.trim() ||
      `Видео ${cue.videoId}`;
    return {
      mode: "video",
      videoId: cue.videoId,
      holdId: null,
      title,
      videoMuted: cue.muted === true,
    };
  }

  if (cue.mode === "hold") {
    const holdId = cue.holdId != null && cue.holdId > 0 ? cue.holdId : null;
    const title =
      (holdId != null
        ? media.holdImages?.find((hold) => hold.id === holdId)?.title?.trim()
        : null) || "Заставка";
    return { mode: "hold", videoId: null, holdId, title };
  }

  return undefined;
}

const REQUISITE_ACTION_LABELS: Record<SceneLightKadrRequisiteActionV1, string> = {
  setup: "занести",
  strike: "унести",
  use: "манипуляции",
};

const SCENE_DUTY_LABELS: Record<ScriptRequisiteDuty, string> = {
  setup: "занести",
  strike: "унести",
  use: "манипуляции",
};

function formatRequisiteLine(req: ScriptRequisite | undefined, fallbackName: string): string {
  const name = req?.label?.trim() || fallbackName;
  const duty = req?.duty;
  const note =
    duty === "setup"
      ? String(req?.placeNote ?? "").trim()
      : duty === "use"
        ? String(req?.actionNote ?? "").trim()
        : "";
  return note ? `${name} · ${note}` : name;
}

function formatRequisiteItems(
  kadr: SceneLightKadrV1,
  scene: ScriptScene,
  isFirstKadrInScene: boolean,
): KadrStripRequisiteItem[] {
  const sceneRequisites = scene.requisites ?? [];
  const byId = new Map(sceneRequisites.map((item) => [item.id, item]));
  const cues = kadr.requisites ?? [];
  const cueIds = new Set(cues.map((cue) => cue.requisiteId));

  const fromCues: KadrStripRequisiteItem[] = cues.map((cue) => {
    const req = byId.get(cue.requisiteId);
    const actionLabel = REQUISITE_ACTION_LABELS[cue.action] ?? cue.action;
    const note =
      cue.action === "setup"
        ? String(req?.placeNote ?? "").trim()
        : cue.action === "use"
          ? String(req?.actionNote ?? "").trim()
          : "";
    const baseName = req?.label?.trim() || `Реквизит ${cue.requisiteId}`;
    return {
      actionLabel,
      name: note ? `${baseName} · ${note}` : baseName,
    };
  });

  // Сценическое «Занести» без галочки «В эту картину» — на первой картине сцены.
  const fromSceneSetup: KadrStripRequisiteItem[] = isFirstKadrInScene
    ? sceneRequisites
        .filter((req) => !cueIds.has(req.id) && req.duty === "setup")
        .map((req) => ({
          actionLabel: SCENE_DUTY_LABELS.setup,
          name: formatRequisiteLine(req, `Реквизит ${req.id}`),
        }))
    : [];

  return [...fromCues, ...fromSceneSetup];
}

function formatVideoSummary(
  kadr: SceneLightKadrV1,
  media: MediaLookup,
): { value: string; projectorPreview?: KadrStripProjectorPreview } | null {
  const cue = kadr.projector;
  if (!cue) return null;
  const projectorPreview = buildProjectorPreview(cue, media);
  if (cue.mode === "video") {
    const title = media.videos?.find((v) => v.id === cue.videoId)?.title?.trim();
    const baseValue = title ? title : `Видео ${cue.videoId}`;
    return { value: baseValue, projectorPreview };
  }

  if (cue.holdId != null && cue.holdId > 0) {
    const title = media.holdImages?.find((h) => h.id === cue.holdId)?.title?.trim();
    const value = title ? title : `Заставка ${cue.holdId}`;
    return { value, projectorPreview };
  }

  return { value: "Заставка", projectorPreview };
}

function buildCornerLabels(kadr: SceneLightKadrV1 | undefined, scene: ScriptScene): KadrRunLabel[] {
  const labels: KadrRunLabel[] = [];
  const isBlackout = Boolean(kadr?.blackout || (kadr && kadr.programId <= 0));
  // Блекаут-картина уже с badge — длительность блекаута не дублируем в углу.
  if (!isBlackout && kadr?.blackoutDurationSec != null && kadr.blackoutDurationSec > 0) {
    labels.push({ type: "blackout", seconds: kadr.blackoutDurationSec });
  }
  if (kadr?.smokeDurationSec != null && kadr.smokeDurationSec > 0) {
    labels.push({ type: "smoke", seconds: kadr.smokeDurationSec });
  }
  const smokeMachineActive =
    kadr?.smokeMachine === true || scene.theaterSmokeMachine === true;
  if (
    smokeMachineActive &&
    !labels.some((label) => label.type === "smoke-machine" || label.type === "smoke")
  ) {
    labels.push({ type: "smoke-machine", seconds: 0 });
  }
  return labels;
}

export function buildKadrStripTechSummary(args: {
  item: SpectacleTapeItem;
  scene: ScriptScene | undefined;
  lightChannels: string[];
  lightFaders: PlaybookLightFadersDataV1;
  lightPrograms?: PlaybookLightProgramsDataV1 | null;
  media?: MediaLookup;
}): KadrStripTechSummary {
  const { item, scene } = args;
  const headingTitle = item.isPlaceholder
    ? "Без картин"
    : parseKadrTitleFromHeading(item.headingTitle ?? "", item.kadrNo) ||
      item.headingTitle;

  if (item.isPlaceholder || !scene) {
    const sceneSmokeLabels =
      scene?.theaterSmokeMachine === true
        ? [{ type: "smoke-machine" as const, seconds: 0 }]
        : [];
    return {
      headingTitle,
      rows: [],
      requisites: [],
      blackout: false,
      cornerLabels: sceneSmokeLabels,
    };
  }

  const kadr = resolveKadrForItem(item, scene);
  const sceneKadrs = readSceneLightKadrs(scene).kadrs;
  const firstKadrNo = sceneKadrs[0]?.kadrNo;
  const isFirstKadrInScene =
    kadr != null && firstKadrNo != null && kadr.kadrNo === firstKadrNo;
  const rows: KadrStripTechRow[] = [];
  const media = args.media ?? {};
  let projectorPreview: KadrStripProjectorPreview | undefined;
  let requisites: KadrStripRequisiteItem[] = [];

  if (kadr) {
    rows.push({
      label: "Свет",
      value: formatLightSummary(kadr, args.lightChannels, args.lightFaders, args.lightPrograms),
    });
    const faders = formatFaderSummary(kadr);
    if (faders) rows.push({ label: "Фейдеры", value: faders });
    if (kadr.nextProgramId != null && kadr.nextProgramId > 0) {
      const next = programLabel(kadr.nextProgramId, args.lightChannels, args.lightPrograms);
      rows.push({ label: "Далее", value: `П${kadr.nextProgramId} · ${next}` });
    }

    const sound = formatSoundSummary(kadr, media);
    if (sound) rows.push({ label: "Трек", value: sound });

    const video = formatVideoSummary(kadr, media);
    if (video) {
      projectorPreview = video.projectorPreview;
      rows.push({
        label: "Видео",
        value: video.value,
        projectorPreview: video.projectorPreview,
      });
    }

    requisites = formatRequisiteItems(kadr, scene, isFirstKadrInScene);

    if (kadr.transitionText?.trim()) {
      rows.push({ label: "Переход", value: kadr.transitionText.trim() });
    }

    const comment = (kadr.commentText ?? kadr.note ?? "").trim();
    if (comment) {
      rows.push({
        label: "Комментарий",
        value: comment,
        multiline: comment.includes("\n"),
      });
    }
  }

  return {
    headingTitle,
    rows,
    requisites,
    blackout: Boolean(kadr?.blackout || (kadr && kadr.programId <= 0)),
    cornerLabels: buildCornerLabels(kadr, scene),
    ...(projectorPreview ? { projectorPreview } : {}),
  };
}
