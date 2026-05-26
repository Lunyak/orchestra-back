import type {
  LightFixture,
  TheaterDoor,
  TheaterLayout,
  TheaterModel,
  TheaterSpotlight,
} from "../../../shared/types/script";
import { isTheaterDecorModel } from "./theater-decor-catalog";
import { resolveLayoutDoors } from "./theater-doors";
import { countStepLightChannelLinks } from "./theater-light-channel-link";

export type SceneValidationIssue = {
  id: string;
  level: "warn" | "error";
  message: string;
};

function doorsOverlap(a: TheaterDoor, b: TheaterDoor): boolean {
  if (a.wall !== b.wall) return false;
  const gap = 0.15;
  const a0 = a.pos - a.width / 2;
  const a1 = a.pos + a.width / 2;
  const b0 = b.pos - b.width / 2;
  const b1 = b.pos + b.width / 2;
  return a0 < b1 + gap && b0 < a1 + gap;
}

function isModelOutOfBounds(model: TheaterModel, layout: TheaterLayout): boolean {
  if (model.allowOutOfBounds) return false;
  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;
  const [x, , z] = model.position;
  return x < -halfW || x > halfW || z < -halfD || z > halfD;
}

export function validateTheaterScene(args: {
  spotlights: TheaterSpotlight[];
  models: TheaterModel[];
  layout: TheaterLayout;
  lightPlot?: LightFixture[];
}): SceneValidationIssue[] {
  const issues: SceneValidationIssue[] = [];
  const { spotlights, models, layout } = args;
  const doors = resolveLayoutDoors(layout);

  if (spotlights.length === 0) {
    issues.push({
      id: "no-spotlights",
      level: "warn",
      message: "На шаге нет 3D-софитов",
    });
  }

  for (const spotlight of spotlights) {
    if (spotlight.hidden) {
      issues.push({
        id: `spot-hidden-${spotlight.id}`,
        level: "warn",
        message: `Софит «${spotlight.label}» скрыт в редакторе`,
      });
    }
    if (spotlight.enabled === false) {
      issues.push({
        id: `spot-off-${spotlight.id}`,
        level: "warn",
        message: `Софит «${spotlight.label}» выключен`,
      });
    }
    if (spotlight.channel == null || !Number.isFinite(Number(spotlight.channel))) {
      issues.push({
        id: `spot-no-channel-${spotlight.id}`,
        level: "warn",
        message: `У софита «${spotlight.label}» не задан канал`,
      });
    }
  }

  for (const model of models) {
    if (model.hidden) {
      issues.push({
        id: `model-hidden-${model.id}`,
        level: "warn",
        message: `«${model.name || `#${model.id}`}» скрыт в редакторе`,
      });
    }
    if (isModelOutOfBounds(model, layout)) {
      issues.push({
        id: `model-oob-${model.id}`,
        level: "error",
        message: `«${model.name || `#${model.id}`}» за пределами зала`,
      });
    }
  }

  for (let i = 0; i < doors.length; i += 1) {
    for (let j = i + 1; j < doors.length; j += 1) {
      if (doorsOverlap(doors[i], doors[j])) {
        issues.push({
          id: `door-overlap-${doors[i].id}-${doors[j].id}`,
          level: "error",
          message: `Двери #${doors[i].id} и #${doors[j].id} пересекаются`,
        });
      }
    }
  }

  const linkStats = countStepLightChannelLinks(args.lightPlot, spotlights);
  if ((args.lightPlot?.length ?? 0) > 0 && linkStats.linkedSlots === 0) {
    issues.push({
      id: "light-plot-unlinked",
      level: "warn",
      message: "Схема света не связана с 3D-софитами по каналам",
    });
  }

  const decorCount = models.filter(isTheaterDecorModel).length;
  if (decorCount === 0 && models.length > 0) {
    issues.push({
      id: "no-decor",
      level: "warn",
      message: "Есть модели, но нет декора из каталога",
    });
  }

  return issues;
}
