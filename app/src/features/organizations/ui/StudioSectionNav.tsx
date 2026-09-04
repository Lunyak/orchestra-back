import { useMemo } from "react";
import {
  studioAssignmentsPath,
  studioAvailabilityPath,
  studioInvitesPath,
  studioMembersPath,
  studioOrgPremisesPath,
  studioProgramSectionPath,
  studioVideosSectionPath,
} from "../../../app/router/paths";
import { useAuth } from "../../auth/model/auth-context";
import { useGetStudioQuery } from "../../studio";
import {
  WorkspaceSectionSwitch,
  type WorkspaceSectionItem,
} from "../../../shared/components/workspace-section-switch/WorkspaceSectionSwitch";

type StudioSectionNavProps = {
  studioId: string;
  active:
    | "members"
    | "invites"
    | "program"
    | "assignments"
    | "videos"
    | "premises"
    | "availability";
};

const ITEMS: ReadonlyArray<{
  id: StudioSectionNavProps["active"];
  label: string;
  path: (studioId: string) => string;
}> = [
  { id: "availability", label: "Занятость", path: studioAvailabilityPath },
  { id: "members", label: "Участники", path: studioMembersPath },
  { id: "invites", label: "Приглашения", path: studioInvitesPath },
  { id: "program", label: "Обучение", path: studioProgramSectionPath },
  { id: "assignments", label: "Задания", path: studioAssignmentsPath },
  { id: "videos", label: "Видео", path: studioVideosSectionPath },
  { id: "premises", label: "Помещения", path: studioOrgPremisesPath },
];

export function StudioSectionNav({
  studioId,
  active,
}: StudioSectionNavProps) {
  const { accessToken } = useAuth();
  const { data: studio } = useGetStudioQuery(studioId, {
    skip: !accessToken || !studioId,
  });
  const canManage = studio?.canManage ?? false;

  const items = useMemo<WorkspaceSectionItem[]>(() => {
    const visible = canManage
      ? ITEMS
      : ITEMS.filter((item) => item.id !== "invites");
    return visible.map((item) => ({
      id: item.id,
      label: item.label,
      to: item.path(studioId),
    }));
  }, [canManage, studioId]);

  return (
    <WorkspaceSectionSwitch
      ariaLabel="Разделы студии"
      items={items}
      activeId={active}
    />
  );
}
