import {
  PROJECT_ONBOARDING_MAP_ATTR,
  PROJECT_ONBOARDING_OPEN_BRANCH_IDS,
  PROJECT_ONBOARDING_POSTER_ATTR,
  PROJECT_ONBOARDING_SCRIPT_ID,
  type ProjectOnboardingStep,
} from "../model/project-onboarding";
import { getProjectNavMap } from "../model/project-nav-map";
import {
  readProjectPoster,
  removeProjectPoster,
  storeProjectPoster,
} from "../model/project-poster-storage";
import posterPlaceholderUrl from "../assets/project-poster-placeholder.png";
import { NavMindmap } from "./NavMindmap";

type ProjectNavMindmapProps = {
  projectSlug: string;
  rootLabel?: string;
  onboardingStep?: ProjectOnboardingStep | null;
};

export function ProjectNavMindmap({
  projectSlug,
  rootLabel = "",
  onboardingStep = null,
}: ProjectNavMindmapProps) {
  const highlightCover = onboardingStep === "cover";
  const highlightMap = onboardingStep === "nav";
  const highlightNavId =
    onboardingStep === "script" ? PROJECT_ONBOARDING_SCRIPT_ID : null;

  return (
    <NavMindmap
      navMap={getProjectNavMap(projectSlug, rootLabel)}
      posterKey={projectSlug}
      poster={{
        read: () => readProjectPoster(projectSlug),
        store: (dataUrl) => storeProjectPoster(projectSlug, dataUrl),
        remove: () => removeProjectPoster(projectSlug),
        placeholderUrl: posterPlaceholderUrl,
      }}
      navAriaLabel="Карта разделов проекта"
      overviewAriaLabel={rootLabel || "Обзор проекта"}
      menuTitle="Разделы проекта"
      onboarding={{
        highlightCover,
        highlightMap,
        highlightNavId,
        forcedOpenBranchIds:
          onboardingStep === "script" ? PROJECT_ONBOARDING_OPEN_BRANCH_IDS : [],
        stackDrillIds:
          onboardingStep === "script" ? ["spectacle", "script"] : undefined,
        posterAttr: PROJECT_ONBOARDING_POSTER_ATTR,
        canvasAttr: PROJECT_ONBOARDING_MAP_ATTR,
      }}
    />
  );
}
