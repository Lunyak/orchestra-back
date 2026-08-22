import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  studioMembersPath,
  studioOrganizationPath,
  studioOverviewPath,
} from "../../../app/router/paths";
import { useAuth } from "../../auth/model/auth-context";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import { useGetStudioQuery } from "../../studio";
import { StudioAssignmentsPanel } from "../../../pages/studio/StudioAssignmentsPanel";
import { StudioInvitePanel } from "../../../pages/studio/StudioInvitePanel";
import { StudioMembersPanel } from "../../../pages/studio/StudioMembersPanel";
import { StudioProgramPanel } from "../../../pages/studio/StudioProgramPanel";
import { StudioVideosPanel } from "../../../pages/studio/StudioVideosPanel";
import "../../rehearsals/ui/rehearsals.css";
import "../../../pages/studio/style.css";
import { StudioSectionNav } from "./StudioSectionNav";

export type StudioOrgSection =
  | "members"
  | "invites"
  | "program"
  | "assignments"
  | "videos";

type StudioOrgSectionPageProps = {
  section: StudioOrgSection;
};

export function StudioOrgSectionPage({ section }: StudioOrgSectionPageProps) {
  const { studioId = "" } = useParams();
  const { accessToken } = useAuth();
  const { data: studio, isLoading, isError } = useGetStudioQuery(studioId, {
    skip: !accessToken || !studioId,
  });

  if (!studioId) {
    return <Navigate to={studioOrganizationPath()} replace />;
  }

  if (!isLoading && (isError || !studio)) {
    return <Navigate to={studioOrganizationPath()} replace />;
  }

  if (isLoading || !studio) {
    return <PageLoader label="Загрузка…" />;
  }

  const canManage = studio.canManage;
  if (section === "invites" && !canManage) {
    return <Navigate to={studioMembersPath(studioId)} replace />;
  }

  return (
    <div className="app-layout studio-layout">
      <div className="app-content">
        <StudioSectionNav studioId={studioId} active={section} />
        <main className="main-content">
          <div className="studio-page">
            <Link className="studio-page__back" to={studioOverviewPath(studioId)}>
              ← Обзор
            </Link>
            <RehearsalsCard fluid>
              {section === "members" ? (
                <StudioMembersPanel studio={studio} />
              ) : null}
              {section === "invites" ? (
                <StudioInvitePanel studio={studio} />
              ) : null}
              {section === "program" ? (
                <StudioProgramPanel studio={studio} />
              ) : null}
              {section === "assignments" ? (
                <StudioAssignmentsPanel studio={studio} />
              ) : null}
              {section === "videos" ? (
                <StudioVideosPanel studio={studio} />
              ) : null}
            </RehearsalsCard>
          </div>
        </main>
      </div>
    </div>
  );
}

export function StudioMembersPage() {
  return <StudioOrgSectionPage section="members" />;
}

export function StudioInvitesPage() {
  return <StudioOrgSectionPage section="invites" />;
}

export function StudioProgramSectionPage() {
  return <StudioOrgSectionPage section="program" />;
}

export function StudioAssignmentsSectionPage() {
  return <StudioOrgSectionPage section="assignments" />;
}

export function StudioVideosSectionPage() {
  return <StudioOrgSectionPage section="videos" />;
}
