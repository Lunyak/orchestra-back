import { useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getProjectSectionFromPath } from "../../../app/router/paths";
import { useIsMobile } from "../../../shared/hooks/useIsMobile";
import { useScriptUI } from "../../script-ui";
import {
  hasSeenProjectOnboarding,
  isOverviewOnboardingStep,
  isScriptOnboardingStep,
  markProjectOnboardingSeen,
  nextOnboardingStep,
  parseOnboardingParam,
  PROJECT_ONBOARDING_PARAM,
  projectOnboardingStepHref,
} from "./project-onboarding";

export function useProjectOnboarding(projectSlug: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const {
    setShowPlaylistSidebar,
    setIsScenesCollapsed,
    setMobilePlaylistOpen,
    setMobileScenesOpen,
  } = useScriptUI();
  const parsed = parseOnboardingParam(
    searchParams.get(PROJECT_ONBOARDING_PARAM),
  );
  const step = projectSlug && parsed && !hasSeenProjectOnboarding() ? parsed : null;

  useEffect(() => {
    if (!projectSlug || parsed === null) return;

    if (hasSeenProjectOnboarding()) {
      if (!searchParams.has(PROJECT_ONBOARDING_PARAM)) return;
      const next = new URLSearchParams(searchParams);
      next.delete(PROJECT_ONBOARDING_PARAM);
      setSearchParams(next, { replace: true });
      return;
    }

    const section = getProjectSectionFromPath(location.pathname);
    if (isScriptOnboardingStep(parsed) && section !== "script") {
      navigate(projectOnboardingStepHref(projectSlug, parsed), { replace: true });
      return;
    }
    if (isOverviewOnboardingStep(parsed) && section === "script") {
      navigate(projectOnboardingStepHref(projectSlug, parsed), { replace: true });
    }
  }, [
    location.pathname,
    navigate,
    parsed,
    projectSlug,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!step) return;
    if (step === "playlist") {
      if (isMobile) {
        setMobilePlaylistOpen(true);
        setMobileScenesOpen(false);
      } else {
        setShowPlaylistSidebar(true);
      }
      return;
    }
    if (step === "split") {
      if (isMobile) {
        setMobileScenesOpen(true);
        setMobilePlaylistOpen(false);
      } else {
        setIsScenesCollapsed(false);
      }
      return;
    }
    if (step === "panels" && isMobile) {
      setMobilePlaylistOpen(false);
      setMobileScenesOpen(false);
    }
  }, [
    isMobile,
    setIsScenesCollapsed,
    setMobilePlaylistOpen,
    setMobileScenesOpen,
    setShowPlaylistSidebar,
    step,
  ]);

  const stripParam = () => {
    if (!searchParams.has(PROJECT_ONBOARDING_PARAM)) return;
    const next = new URLSearchParams(searchParams);
    next.delete(PROJECT_ONBOARDING_PARAM);
    setSearchParams(next, { replace: true });
  };

  const dismiss = () => {
    markProjectOnboardingSeen();
    stripParam();
  };

  const goNext = () => {
    if (!step || !projectSlug) return;
    const next = nextOnboardingStep(step);
    if (!next) {
      dismiss();
      return;
    }
    const href = projectOnboardingStepHref(projectSlug, next);
    const section = getProjectSectionFromPath(location.pathname);
    const nextNeedsScript = isScriptOnboardingStep(next);
    const onScriptPage = section === "script";
    if (nextNeedsScript !== onScriptPage) {
      navigate(href);
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set(PROJECT_ONBOARDING_PARAM, next);
    setSearchParams(nextParams, { replace: true });
  };

  return { step, goNext, dismiss };
}
