import { projectPath } from "../../../app/router/paths";
import type { OnboardingPlacePrefer } from "./project-onboarding-layout";

export const PROJECT_ONBOARDING_PARAM = "onboarding";
export const PROJECT_ONBOARDING_POSTER_ATTR = "poster";
export const PROJECT_ONBOARDING_MAP_ATTR = "map";
export const PROJECT_ONBOARDING_SCRIPT_ID = "script-play";
export const PROJECT_ONBOARDING_PANELS_ATTR = "script-panels";
export const PROJECT_ONBOARDING_PLAYLIST_ADD_ATTR = "playlist-add";
export const PROJECT_ONBOARDING_SCENES_ATTR = "script-scenes";
export const PROJECT_ONBOARDING_OPEN_BRANCH_IDS = [
  "spectacle",
  "script",
] as const;
export const PROJECT_ONBOARDING_STEPS = [
  "cover",
  "nav",
  "script",
  "panels",
  "playlist",
  "split",
] as const;

export type ProjectOnboardingStep = (typeof PROJECT_ONBOARDING_STEPS)[number];

const SEEN_KEY = "orchestra:onboarding-seen";
const STEP_SET = new Set<string>(PROJECT_ONBOARDING_STEPS);

export function parseOnboardingParam(raw: string | null): ProjectOnboardingStep | null {
  if (!raw) return null;
  if (raw === "1") return "cover";
  if (STEP_SET.has(raw)) return raw as ProjectOnboardingStep;
  return null;
}

export function isOverviewOnboardingStep(step: ProjectOnboardingStep) {
  return step === "cover" || step === "nav" || step === "script";
}

export function isScriptOnboardingStep(step: ProjectOnboardingStep) {
  return step === "panels" || step === "playlist" || step === "split";
}

export function projectOnboardingHref(slug: string) {
  return `${projectPath(slug)}?${PROJECT_ONBOARDING_PARAM}=1`;
}

export function projectOnboardingStepHref(
  slug: string,
  step: ProjectOnboardingStep,
) {
  const path = isScriptOnboardingStep(step)
    ? projectPath(slug, "script")
    : projectPath(slug, "overview");
  return `${path}?${PROJECT_ONBOARDING_PARAM}=${step}`;
}

export function hasSeenProjectOnboarding() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markProjectOnboardingSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
}

export function nextOnboardingStep(step: ProjectOnboardingStep) {
  if (step === "cover") return "nav";
  if (step === "nav") return "script";
  if (step === "script") return "panels";
  if (step === "panels") return "playlist";
  if (step === "playlist") return "split";
  return null;
}

export function onboardingTargetSelector(step: ProjectOnboardingStep) {
  if (step === "cover") {
    return `[data-project-nav="${PROJECT_ONBOARDING_POSTER_ATTR}"]`;
  }
  if (step === "nav") {
    return `[data-project-nav="${PROJECT_ONBOARDING_MAP_ATTR}"]`;
  }
  if (step === "script") {
    return `[data-project-nav-id="${PROJECT_ONBOARDING_SCRIPT_ID}"]`;
  }
  if (step === "panels") {
    return `[data-onboarding="${PROJECT_ONBOARDING_PANELS_ATTR}"]`;
  }
  if (step === "playlist") {
    return `[data-onboarding="${PROJECT_ONBOARDING_PLAYLIST_ADD_ATTR}"]`;
  }
  return `[data-onboarding="${PROJECT_ONBOARDING_SCENES_ATTR}"]`;
}

export function onboardingCardPrefer(step: ProjectOnboardingStep): OnboardingPlacePrefer {
  if (step === "script" || step === "split") return "left";
  if (step === "panels") return "below";
  return "right";
}
