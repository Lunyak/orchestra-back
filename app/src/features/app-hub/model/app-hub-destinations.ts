import { globalPaths } from "../../../app/router/paths";
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
    id: "projects",
    path: globalPaths.projects,
    label: "Проекты",
    description: "Спектакли и рабочие разделы",
    imageSrc: spectacleImageUrl,
    imageAlt: "Пустая сцена и красный занавес",
  },
  {
    id: "organizations",
    path: globalPaths.organizations,
    label: "Организации",
    description: "Театры, коллективы и студии",
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
    path: globalPaths.studios,
    label: "Студии",
    description: "Программы и уроки",
    imageSrc: studioImageUrl,
    imageAlt: "Студийный микрофон и хлопушка",
  },
  {
    id: "profile",
    path: globalPaths.profile,
    label: "Профиль",
    description: "Данные и роли",
    imageSrc: profileImageUrl,
    imageAlt: "Театральная маска",
  },
  {
    id: "projects-settings",
    path: globalPaths.projects,
    label: "Настройки проектов",
    description: "Открываются внутри проекта",
    imageSrc: settingsImageUrl,
    imageAlt: "Винтажная панель управления",
  },
];

export function getAppHubDestinations(): AppHubDestination[] {
  return APP_HUB_DESTINATIONS;
}
