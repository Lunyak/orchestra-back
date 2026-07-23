import {
  SPECTACLE_HUB_ROUTE_PATH,
  SUFER_ROUTE_PATH,
} from "../../../app/router/routeMeta";
import { ENABLE_3D_THEATER } from "../../../shared/build-features";
import lightPlotImageUrl from "../assets/spectacle-hub-light.png";
import scriptImageUrl from "../assets/spectacle-hub-script.png";
import suferImageUrl from "../assets/spectacle-hub-sufer.png";
import theaterImageUrl from "../assets/spectacle-hub-theater.png";

export { SPECTACLE_HUB_ROUTE_PATH as SPECTACLE_HUB_PATH };

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

export const SPECTACLE_HUB_DIRECTIONS: SpectacleHubDirection[] = [
  {
    id: "script",
    path: "/",
    label: "Сценарий",
    description: "Текст и сцены",
    imageSrc: scriptImageUrl,
    imageAlt: "Открытый сценарий",
  },
  {
    id: "light-plot",
    path: "/light-plot",
    label: "Техчасть",
    description: "Свет, схема и кадры",
    imageSrc: lightPlotImageUrl,
    imageAlt: "Сценический свет",
  },
  {
    id: "sufer",
    path: SUFER_ROUTE_PATH,
    label: "Прогон",
    description: "Карточный прогон / суфлёр",
    imageSrc: suferImageUrl,
    imageAlt: "Карточки прогона",
  },
  {
    id: "theater",
    path: "/theater",
    label: "3D театр",
    description: "Сцена в пространстве",
    imageSrc: theaterImageUrl,
    imageAlt: "Сцена в пространстве",
  },
];

export function getSpectacleHubDirections(): SpectacleHubDirection[] {
  return SPECTACLE_HUB_DIRECTIONS.filter(
    (direction) => ENABLE_3D_THEATER || direction.id !== "theater",
  );
}
