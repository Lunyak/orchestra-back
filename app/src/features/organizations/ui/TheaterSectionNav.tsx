import { useEffect, useMemo, useState } from "react";
import {
  theaterOverviewPath,
  theaterPremisesPath,
  theaterRehearsalsPath,
  theaterTeamPath,
  theaterTroupePath,
} from "../../../app/router/paths";
import { fetchTheaters } from "../../../sync/api/workspaces";
import { useAuth } from "../../auth/model/auth-context";
import {
  WorkspaceSectionSwitch,
  type WorkspaceSectionItem,
} from "../../../shared/components/workspace-section-switch/WorkspaceSectionSwitch";

type TheaterSectionNavProps = {
  theaterId: string;
  active: "rehearsals" | "troupe" | "team" | "premises";
  /** bar — верхняя полоса; inline — внутри шапки страницы */
  variant?: "bar" | "inline";
};

const ITEMS: ReadonlyArray<{
  id: TheaterSectionNavProps["active"];
  label: string;
  path: (theaterId: string) => string;
}> = [
  { id: "rehearsals", label: "Репетиции", path: theaterRehearsalsPath },
  { id: "troupe", label: "Коллектив", path: theaterTroupePath },
  { id: "team", label: "Команда", path: theaterTeamPath },
  { id: "premises", label: "Помещения", path: theaterPremisesPath },
];

export function TheaterSectionNav({
  theaterId,
  active,
  variant = "bar",
}: TheaterSectionNavProps) {
  const { accessToken } = useAuth();
  const [theaterTitle, setTheaterTitle] = useState("");

  useEffect(() => {
    if (!accessToken || !theaterId) return;
    let cancelled = false;
    fetchTheaters(accessToken)
      .then((theaters) => {
        if (cancelled) return;
        const theater = theaters.find((item) => item.id === theaterId);
        setTheaterTitle(theater?.title ?? "");
      })
      .catch(() => {
        if (!cancelled) setTheaterTitle("");
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, theaterId]);

  const items = useMemo<WorkspaceSectionItem[]>(
    () =>
      ITEMS.map((item) => ({
        id: item.id,
        label: item.label,
        to: item.path(theaterId),
      })),
    [theaterId],
  );

  return (
    <WorkspaceSectionSwitch
      ariaLabel="Разделы театра"
      backTo={theaterOverviewPath(theaterId)}
      backLabel={theaterTitle || "Театр"}
      items={items}
      activeId={active}
      variant={variant}
    />
  );
}
