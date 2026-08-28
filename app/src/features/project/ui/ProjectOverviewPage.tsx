import { useProject } from "../model/project-context";
import { isOverviewOnboardingStep } from "../model/project-onboarding";
import { useProjectOnboarding } from "../model/useProjectOnboarding";
import { ProjectNavMindmap } from "./ProjectNavMindmap";
import { ProjectOnboardingTour } from "./ProjectOnboardingTour";
import "../../director-sessions/ui/director-sessions.css";
import "./project-overview.css";

export function ProjectOverviewPage() {
  const { currentProjectDisplayName, projectName } = useProject();
  const onboarding = useProjectOnboarding(projectName);

  return (
    <main className="project-overview">
      <div className="project-overview__content">
        <section
          className="project-overview__map"
          aria-labelledby="project-nav-map-title"
        >
          <ProjectNavMindmap
            projectSlug={projectName}
            rootLabel={currentProjectDisplayName}
            onboardingStep={onboarding.step}
          />
        </section>
      </div>
      {onboarding.step && isOverviewOnboardingStep(onboarding.step) ? (
        <ProjectOnboardingTour
          step={onboarding.step}
          projectSlug={projectName}
          onNext={onboarding.goNext}
          onDismiss={onboarding.dismiss}
        />
      ) : null}
    </main>
  );
}
