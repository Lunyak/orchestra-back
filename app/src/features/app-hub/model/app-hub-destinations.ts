import { SPECTACLE_HUB_ROUTE_PATH } from "../../../app/router/routeMeta";
import { ADMIN_NAV_PATH } from "../../../shared/components/header/header-nav-items";
import spectacleImageUrl from "../assets/app-hub-spectacle.png";
import adminImageUrl from "../assets/app-hub-admin.png";
import trainersImageUrl from "../assets/app-hub-trainers.png";
import studioImageUrl from "../assets/app-hub-studio.png";
import profileImageUrl from "../assets/app-hub-profile.png";
import settingsImageUrl from "../assets/app-hub-settings.png";

export type AppHubDestination = {
  id: string;
  path: string;
  label: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
};

export const APP_HUB_DESTINATIONS: AppHubDestination[] = [
  {
    id: "spectacle",
    path: SPECTACLE_HUB_ROUTE_PATH,
    label: "Спектакль",
    description: "Сценарий, свет, прогон, 3D",
    imageSrc: spectacleImageUrl,
    imageAlt: "Пустая сцена и красный занавес",
  },
  {
    id: "admin",
    path: ADMIN_NAV_PATH,
    label: "Администрирование",
    description: "Репетиции, команда, задачи",
    imageSrc: adminImageUrl,
    imageAlt: "Стол с бумагами и печатью",
  },
  {
    id: "trainers",
    path: "/trainers",
    label: "Тренажёры",
    description: "Речь, дикция и практика",
    imageSrc: trainersImageUrl,
    imageAlt: "Табурет и метроном для тренировки",
  },
  {
    id: "studio",
    path: "/studio",
    label: "Студия",
    description: "Программы и уроки",
    imageSrc: studioImageUrl,
    imageAlt: "Студийный микрофон и хлопушка",
  },
  {
    id: "profile",
    path: "/profile",
    label: "Профиль",
    description: "Данные и роли",
    imageSrc: profileImageUrl,
    imageAlt: "Театральная маска",
  },
  {
    id: "settings",
    path: "/settings",
    label: "Настройки",
    description: "Параметры приложения",
    imageSrc: settingsImageUrl,
    imageAlt: "Винтажная панель управления",
  },
];

export function getAppHubDestinations(): AppHubDestination[] {
  return APP_HUB_DESTINATIONS;
}
