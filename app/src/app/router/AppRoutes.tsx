import { AppEditorMenubarProvider } from "@shared/components/app-editor-menubar";
import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { PageBootProvider } from "@shared/components/page-loader/page-boot";
import { Suspense } from "react";
import { useLocation } from "react-router-dom";
import { RecentOrganizationsTracker } from "../../features/global-dashboard/ui/RecentOrganizationsTracker";
import { AppRouteDeclarations } from "./AppRouteDeclarations";
import { AppShellLayout } from "./AppShellLayout";

function ProjectorRoutesOnly() {
  return (
    <Suspense fallback={<PageLoader variant="view" label="Проектор…" />}>
      <AppRouteDeclarations />
    </Suspense>
  );
}

export function AppRoutes() {
  const location = useLocation();
  const isProjectorOutput = location.pathname === "/projector-output";

  if (isProjectorOutput) {
    return <ProjectorRoutesOnly />;
  }

  return (
    <AppEditorMenubarProvider>
      <RecentOrganizationsTracker />
      <PageBootProvider>
        <AppShellLayout />
      </PageBootProvider>
    </AppEditorMenubarProvider>
  );
}
