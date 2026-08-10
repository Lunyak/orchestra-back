import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { useProject } from "../../features/project";
import {
  globalPaths,
  projectPath,
  resolveLegacyProjectPath,
  resolveLegacyStudioPath,
} from "./paths";

export function ProjectRouteBoundary() {
  const { projectSlug = "" } = useParams();
  const {
    isProjectsLoaded,
    projectName,
    projects,
    projectsLoading,
    onProjectChange,
  } = useProject();
  const decodedProjectSlug = projectSlug;
  const projectExists = projects.includes(decodedProjectSlug);

  useEffect(() => {
    if (!projectExists || projectName === decodedProjectSlug) return;
    onProjectChange(decodedProjectSlug);
  }, [decodedProjectSlug, onProjectChange, projectExists, projectName]);

  if (!isProjectsLoaded || projectsLoading) {
    return <PageLoader variant="simple" label="Загрузка проекта…" />;
  }
  if (!projectExists) {
    return <Navigate to={globalPaths.projects} replace />;
  }
  if (projectName !== decodedProjectSlug) {
    return <PageLoader variant="simple" label="Открытие проекта…" />;
  }
  return <Outlet />;
}

export function ProjectIndexRedirect() {
  const { projectSlug = "" } = useParams();
  return <Navigate to={projectPath(projectSlug)} replace />;
}

export function LegacyProjectRedirect() {
  const { isProjectsLoaded, projectName, projectsLoading } = useProject();
  const location = useLocation();
  if (!isProjectsLoaded || projectsLoading) {
    return <PageLoader variant="simple" label="Открытие проекта…" />;
  }
  const target = resolveLegacyProjectPath(location.pathname, projectName);
  return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
}

export function LegacyStudioRedirect() {
  const location = useLocation();
  return (
    <Navigate
      to={`${resolveLegacyStudioPath(location.pathname)}${location.search}${location.hash}`}
      replace
    />
  );
}
