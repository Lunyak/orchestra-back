import { useLocation, useNavigate } from "react-router-dom";
import {
  filterHeaderNavItems,
  HEADER_NAV_ITEMS,
  isHeaderNavItemActive,
} from "../header/header-nav-items";

export function AppEditorNavigationMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname || "/";
  const navItems = filterHeaderNavItems(HEADER_NAV_ITEMS);

  return (
    <div className="theater-editor-menubar__menu app-editor-menubar__menu--navigation">
      <span className="theater-editor-menubar__menu-title">Навигация</span>
      <div
        className="theater-editor-menubar__options theater-editor-menubar__options--nav"
        role="menu"
      >
        {navItems.map(({ path, label, icon }) => {
          const isActive = isHeaderNavItemActive(path, currentPath);
          return (
            <button
              key={path}
              type="button"
              role="menuitem"
              aria-current={isActive ? "page" : undefined}
              className={[
                "theater-editor-menubar__option",
                "theater-editor-menubar__option--nav",
                isActive ? "theater-editor-menubar__option--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => navigate(path)}
            >
              <span className="app-editor-menubar__nav-icon" aria-hidden>
                {icon}
              </span>
              <span className="app-editor-menubar__nav-label">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
