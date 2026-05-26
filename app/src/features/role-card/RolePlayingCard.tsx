import cn from "classnames";
import type { ProjectRoleInfo } from "../../sync/api/projects";
import { useRoleAvatarUrl } from "./useRoleAvatarUrl";
import "./RolePlayingCard.css";

function roleInitials(title: string): string {
  const parts = String(title ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export type RolePlayingCardProps = {
  role: Pick<ProjectRoleInfo, "title" | "avatarKey">;
  accessToken?: string | null;
  /** Override resolved image URL (e.g. cache). */
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
  title?: string;
};

export function RolePlayingCard({
  role,
  accessToken,
  imageUrl,
  size = "md",
  className,
  onClick,
  title,
}: RolePlayingCardProps) {
  const resolvedUrl = useRoleAvatarUrl(accessToken, role.avatarKey);
  const url = imageUrl ?? resolvedUrl;
  const label = String(title ?? role.title ?? "").trim() || "Роль";
  const initials = roleInitials(label);

  return (
    <div
      className={cn(
        "role-playing-card",
        size !== "md" && `role-playing-card_${size}`,
        onClick && "role-playing-card_interactive",
        className,
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      title={label}
    >
      <div className="role-playing-card__art">
        {url ? (
          <img className="role-playing-card__img" src={url} alt={label} />
        ) : (
          <div className="role-playing-card__placeholder">{initials}</div>
        )}
      </div>
      <div className="role-playing-card__footer">
        <div className="role-playing-card__title">{label}</div>
      </div>
    </div>
  );
}
