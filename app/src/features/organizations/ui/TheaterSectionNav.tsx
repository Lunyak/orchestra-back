import cn from "classnames";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  theaterOverviewPath,
  theaterPremisesPath,
  theaterRehearsalsPath,
  theaterTeamPath,
  theaterTroupePath,
} from "../../../app/router/paths";
import { fetchTheaters } from "../../../sync/api/workspaces";
import { useAuth } from "../../auth/model/auth-context";
import "../../spectacle/ui/spectacle-direction-switch.css";

type TheaterSectionNavProps = {
  theaterId: string;
  active: "rehearsals" | "troupe" | "team" | "premises";
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

  const backLabel = theaterTitle || "Театр";

  return (
    <nav className="spectacle-direction-switch" aria-label="Разделы театра">
      <div className="spectacle-direction-switch__left">
        <Link
          to={theaterOverviewPath(theaterId)}
          className="spectacle-direction-switch__item"
        >
          ← {backLabel}
        </Link>
      </div>
      <div className="spectacle-direction-switch__right">
        <ul
          className="spectacle-direction-switch__modes"
          aria-label="Режимы театра"
        >
          {ITEMS.map((item) => {
            const isActive = active === item.id;
            return (
              <li key={item.id}>
                <Link
                  to={item.path(theaterId)}
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
