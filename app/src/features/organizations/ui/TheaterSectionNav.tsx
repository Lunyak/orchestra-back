import { useMemo } from "react";
import {
  theaterAvailabilityPath,
  theaterPremisesPath,
  theaterRehearsalsPath,
  theaterTeamPath,
  theaterTroupePath,
} from "../../../app/router/paths";
import {
  WorkspaceSectionSwitch,
  type WorkspaceSectionItem,
} from "../../../shared/components/workspace-section-switch/WorkspaceSectionSwitch";

type TheaterSectionNavProps = {
  theaterId: string;
  active: "rehearsals" | "availability" | "troupe" | "team" | "premises";
  variant?: "bar" | "inline";
};

const ITEMS: ReadonlyArray<{
  id: TheaterSectionNavProps["active"];
  label: string;
  path: (theaterId: string) => string;
}> = [
  { id: "rehearsals", label: "Репетиции", path: theaterRehearsalsPath },
  { id: "availability", label: "Занятость", path: theaterAvailabilityPath },
  { id: "troupe", label: "Коллектив", path: theaterTroupePath },
  { id: "team", label: "Должности", path: theaterTeamPath },
  { id: "premises", label: "Помещения", path: theaterPremisesPath },
];

export function TheaterSectionNav({
  theaterId,
  active,
  variant = "bar",
}: TheaterSectionNavProps) {
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
      items={items}
      activeId={active}
      variant={variant}
    />
  );
}
