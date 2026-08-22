import cn from "classnames";
import { Link } from "react-router-dom";
import {
  studioAssignmentsPath,
  studioInvitesPath,
  studioMembersPath,
  studioOrgPremisesPath,
  studioOverviewPath,
  studioProgramSectionPath,
  studioVideosSectionPath,
} from "../../../app/router/paths";
import { useAuth } from "../../auth/model/auth-context";
import { useGetStudioQuery } from "../../studio";
import "../../spectacle/ui/spectacle-direction-switch.css";

type StudioSectionNavProps = {
  studioId: string;
  active:
    | "members"
    | "invites"
    | "program"
    | "assignments"
    | "videos"
    | "premises";
};

const ITEMS: ReadonlyArray<{
  id: StudioSectionNavProps["active"];
  label: string;
  path: (studioId: string) => string;
}> = [
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
  const backLabel = studio?.title || "Студия";
  const canManage = studio?.canManage ?? false;
  const visibleItems = canManage
    ? ITEMS
    : ITEMS.filter((item) => item.id !== "invites");

  return (
    <nav className="spectacle-direction-switch" aria-label="Разделы студии">
      <div className="spectacle-direction-switch__left">
        <Link
          to={studioOverviewPath(studioId)}
          className="spectacle-direction-switch__item"
        >
          ← {backLabel}
        </Link>
      </div>
      <div className="spectacle-direction-switch__right">
        <ul
          className="spectacle-direction-switch__modes"
          aria-label="Режимы студии"
        >
          {visibleItems.map((item) => {
            const isActive = active === item.id;
            return (
              <li key={item.id}>
                <Link
                  to={item.path(studioId)}
                  className={cn(
                    "spectacle-direction-switch__item",
                    isActive && "spectacle-direction-switch__item--active",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
