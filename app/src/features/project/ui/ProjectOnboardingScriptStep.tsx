import { Link } from "react-router-dom";
import { projectOnboardingStepHref } from "../model/project-onboarding";

type ProjectOnboardingScriptStepProps = {
  projectSlug: string;
};

export function ProjectOnboardingScriptStep({
  projectSlug,
}: ProjectOnboardingScriptStepProps) {
  const scriptHref = projectOnboardingStepHref(projectSlug, "panels");

  return (
    <>
      <h2 id="project-onboarding-title" className="project-onboarding__title">
        Текстовый материал
      </h2>
      <p className="project-onboarding__copy">
        Здесь можно перейти в{" "}
        <Link className="project-onboarding__text-link" to={scriptHref}>
          Текст
        </Link>{" "}
        и загрузить материал проекта.
      </p>
    </>
  );
}
