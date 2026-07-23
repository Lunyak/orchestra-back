import cn from "classnames";
import { Link, useLocation } from "react-router-dom";
import { APP_HUB_ROUTE_PATH } from "../../../app/router/routeMeta";

export function AppEditorHomeLink() {
  const location = useLocation();
  const isActive = location.pathname === APP_HUB_ROUTE_PATH;
  const linkClassName = cn(
    "app-editor-menubar__home",
    isActive && "app-editor-menubar__home--active",
  );

  return (
    <Link
      to={APP_HUB_ROUTE_PATH}
      className={linkClassName}
      aria-current={isActive ? "page" : undefined}
    >
      Домой
    </Link>
  );
}
