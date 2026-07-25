import cn from "classnames";
import { Link, useLocation } from "react-router-dom";
import {
  isSpectacleCreativePath,
  SPECTACLE_HUB_ROUTE_PATH,
} from "../../../app/router/routeMeta";
import {
  filterHeaderNavItems,
  HEADER_NAV_ITEMS,
  SPECTACLE_NAV_CHILDREN,
} from "../header/header-nav-items";

export function AppEditorSpectacleDirectionsNav() {
  const { pathname } = useLocation();

  if (!isSpectacleCreativePath(pathname)) {
    return null;
  }

  const directions =
    filterHeaderNavItems(HEADER_NAV_ITEMS).find(
      (item) => item.path === SPECTACLE_HUB_ROUTE_PATH,
    )?.children ?? SPECTACLE_NAV_CHILDREN;

  return (
    <nav className="app-editor-menubar__directions" aria-label="Направления спектакля">
      {directions.map((direction) => {
        const isActive = direction.isActive(pathname);
        return (
          <Link
            key={direction.id}
            to={direction.path}
            className={cn(
              "app-editor-menubar__home",
              isActive && "app-editor-menubar__home--active",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {direction.label}
          </Link>
        );
      })}
    </nav>
  );
}
