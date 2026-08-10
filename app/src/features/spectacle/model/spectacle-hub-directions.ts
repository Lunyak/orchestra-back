import { projectPath } from "../../../app/router/paths";
import { ENABLE_3D_THEATER } from "../../../shared/build-features";
import lightPlotImageUrl from "../assets/spectacle-hub-light.png";
import scriptImageUrl from "../assets/spectacle-hub-script.png";
import suferImageUrl from "../assets/spectacle-hub-sufer.png";
import theaterImageUrl from "../assets/spectacle-hub-theater.png";

export type SpectacleHubDirectionId =
  | "script"
  | "light-plot"
  | "sufer"
  | "theater";

export type SpectacleHubDirection = {
  id: SpectacleHubDirectionId;
  path: string;
  label: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
};

const SPECTACLE_HUB_DIRECTIONS: Omit<SpectacleHubDirection, "path">[] = [
  {
    id: "script",
    label: "Сценарий",
    description: "Текст и сцены",
    imageSrc: scriptImageUrl,
    imageAlt: "Открытый сценарий",
  },
  {
    id: "light-plot",
    label: "Техчасть",
    description: "Свет, схема и кадры",
    imageSrc: lightPlotImageUrl,
    imageAlt: "Сценический свет",
  },
  {
    id: "sufer",
    label: "Суфлер",
    description: "Карточки подсказок для прогона",
    imageSrc: suferImageUrl,
    imageAlt: "Карточки суфлера",
  },
  {
    id: "theater",
    label: "3D театр",
    description: "Сцена в пространстве",
    imageSrc: theaterImageUrl,
    imageAlt: "Сцена в пространстве",
  },
];

export function getSpectacleHubDirections(
  projectSlug: string,
): SpectacleHubDirection[] {
  return SPECTACLE_HUB_DIRECTIONS.filter(
    (direction) => ENABLE_3D_THEATER || direction.id !== "theater",
  ).map((direction) => ({
    ...direction,
    path: projectPath(projectSlug, direction.id),
  }));
}
