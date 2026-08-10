import cn from "classnames";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  getProjectSlugFromPath,
  globalPaths,
  projectPath,
} from "../../../app/router/paths";
import { useAuth } from "../../../features/auth";
import { useMyProfileQuery } from "../../../features/profile/api/profile-api";
import { MiniAvatar } from "../../core/mini-avatar/MiniAvatar";

function resolveProfileLabel(profile: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  email?: string | null;
} | null | undefined) {
  const fullName = [profile?.firstName, profile?.lastName]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (fullName) return fullName;
  const displayName = String(profile?.displayName ?? "").trim();
  if (displayName) return displayName;
  const email = String(profile?.email ?? "").trim();
  if (email) return email;
  return "Профиль";
}

export function AppEditorUserMenu() {
  const { pathname } = useLocation();
  const { accessToken, logout } = useAuth();
  const { data: profile } = useMyProfileQuery(undefined, { skip: !accessToken });
  const [isOpen, setIsOpen] = useState(false);

  const projectSlug = getProjectSlugFromPath(pathname);
  const settingsPath = projectSlug
    ? projectPath(projectSlug, "settings")
    : null;
  const profileLabel = resolveProfileLabel(profile);
  const avatarUrl = String(profile?.avatarUrl ?? "").trim() || null;
  const profileEmail = String(profile?.email ?? "").trim();
  const isProfileActive =
    pathname === globalPaths.profile ||
    pathname.startsWith(`${globalPaths.profile}/`);
  const isSettingsActive = Boolean(
    settingsPath &&
      (pathname === settingsPath || pathname.startsWith(`${settingsPath}/`)),
  );

  const closeMenu = () => setIsOpen(false);

  return (
    <div
      className={cn(
        "theater-editor-menubar__menu",
        "app-editor-user-menu",
        isOpen && "theater-editor-menubar__menu--open",
      )}
      onMouseLeave={closeMenu}
    >
      <button
        type="button"
        className="theater-editor-menubar__menu-title app-editor-user-menu__trigger"
        aria-label={profileLabel}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={profileLabel}
        onClick={() => setIsOpen((open) => !open)}
      >
        <MiniAvatar src={avatarUrl} label={profileLabel} size={22} />
      </button>
      <div
        className="theater-editor-menubar__options app-editor-user-menu__options"
        role="menu"
      >
        <div
          className="theater-editor-menubar__option theater-editor-menubar__option--meta app-editor-user-menu__meta"
          role="presentation"
        >
          <span className="app-editor-user-menu__meta-name">{profileLabel}</span>
          {profileEmail ? (
            <span className="app-editor-user-menu__meta-email">{profileEmail}</span>
          ) : null}
        </div>
        <div
          className="theater-editor-menubar__option theater-editor-menubar__option--separator"
          role="separator"
        />
        <Link
          to={globalPaths.profile}
          role="menuitem"
          className={cn(
            "theater-editor-menubar__option",
            isProfileActive && "theater-editor-menubar__option--active",
          )}
          onClick={closeMenu}
        >
          Профиль
        </Link>
        {settingsPath ? (
          <Link
            to={settingsPath}
            role="menuitem"
            className={cn(
              "theater-editor-menubar__option",
              isSettingsActive && "theater-editor-menubar__option--active",
            )}
            onClick={closeMenu}
          >
            Настройки
          </Link>
        ) : null}
        <div
          className="theater-editor-menubar__option theater-editor-menubar__option--separator"
          role="separator"
        />
        <button
          type="button"
          role="menuitem"
          className="theater-editor-menubar__option"
          onClick={() => {
            closeMenu();
            logout();
          }}
        >
          Выйти
        </button>
      </div>
    </div>
  );
}
