import { useProject } from "../model/project-context";
import { isScriptOnboardingStep } from "../model/project-onboarding";
import { useProjectOnboarding } from "../model/useProjectOnboarding";
import { ProjectOnboardingTour } from "./ProjectOnboardingTour";

type ProjectOnboardingScriptTourProps = {
  ready?: boolean;
};

export function ProjectOnboardingScriptTour({
  ready = true,
}: ProjectOnboardingScriptTourProps) {
  const { projectName } = useProject();
  const onboarding = useProjectOnboarding(projectName);

  if (
    !ready ||
    !projectName ||
    !onboarding.step ||
    !isScriptOnboardingStep(onboarding.step)
  ) {
    return null;
  }

  return (
    <ProjectOnboardingTour
      step={onboarding.step}
      projectSlug={projectName}
      onNext={onboarding.goNext}
      onDismiss={onboarding.dismiss}
    />
  );
}
