import cn from "classnames";
import { Button } from "@shared/core/button/Button";
import { MiniAvatar } from "../../../shared/components/mini-avatar/MiniAvatar";
import { RoleAvatarEditor } from "../../role-card/RoleAvatarEditor";
import { RolePlayingCard } from "../../role-card/RolePlayingCard";
import type { ProjectRoleInfo } from "../../../sync/api/projects";
import type { TeamProfile } from "../../../sync/api/profile";
import { actorLabel } from "../model/roleWorkbookNote";

export type RoleWorkbookOverviewProps = {
  accessToken: string;
  remoteProjectId: string | null;
  roleInfo: ProjectRoleInfo | null;
  roleLabel: string;
  canEditRoleAvatar: boolean;
  updatingRoleAvatar: boolean;
  onSaveAvatarKey: (avatarKey: string | null) => Promise<void>;
  canViewActorWorkbook: boolean;
  visibleActorTiles: string[];
  snapshotsByActorEmail: Map<string, string | null>;
  profilesByEmail: Record<string, TeamProfile | null | undefined>;
  onOpenActorWorkbook: (email: string) => void;
  error: string | null;
  deleteError: string | null;
  canDeleteRole: boolean;
  deletingRole: boolean;
  onDeleteRole: () => void;
};

export function RoleWorkbookOverview(props: RoleWorkbookOverviewProps) {
  const {
    accessToken,
    remoteProjectId,
    roleInfo,
    roleLabel,
    canEditRoleAvatar,
    updatingRoleAvatar,
    onSaveAvatarKey,
    canViewActorWorkbook,
    visibleActorTiles,
    snapshotsByActorEmail,
    profilesByEmail,
    onOpenActorWorkbook,
    error,
    deleteError,
    canDeleteRole,
    deletingRole,
    onDeleteRole,
  } = props;

  const showAvatarEditor = Boolean(canEditRoleAvatar && accessToken && remoteProjectId && roleInfo);
  const showActorTiles = Boolean(canViewActorWorkbook && visibleActorTiles.length > 0);
  const avatarHint = canEditRoleAvatar ? " Портрет роли меняет режиссёр." : "";

  return (
    <div className="rolewb-card rolewb-card--compact rolewb-view-card">
      <div className="rolewb-overview">
        {roleInfo ? (
          <div className="rolewb-overview-portrait" aria-label="Карточка роли">
            {showAvatarEditor ? (
              <RoleAvatarEditor
                accessToken={accessToken}
                projectId={remoteProjectId!}
                role={roleInfo}
                canEdit
                busy={updatingRoleAvatar}
                onSaveAvatarKey={onSaveAvatarKey}
              />
            ) : (
              <RolePlayingCard role={roleInfo} accessToken={accessToken} size="lg" />
            )}
          </div>
        ) : null}
        <div className="rolewb-overview-body">
          <div className="rolewb-view-head">
            <div>
              <div className="rolewb-card-title">{roleLabel || "Просмотр"}</div>
              <div className="rolewb-hint">
                Выберите актёра, чтобы открыть его тетрадку рисунка роли.
                {avatarHint}
              </div>
            </div>
          </div>

          {!canViewActorWorkbook ? (
            <div className="rolewb-hint">
              Актёрская тетрадка недоступна: вы не назначены на эту роль.
            </div>
          ) : null}

          {showActorTiles ? (
            <div className="rolewb-actor-quick-view">
              <div className="rolewb-hint rolewb-hint--flush">Актёры:</div>
              <div className="rolewb-actor-avatar-list">
                {visibleActorTiles.map((em) => {
                  const profile = profilesByEmail?.[em] ?? null;
                  const updatedAtIso = snapshotsByActorEmail.get(em) ?? null;
                  const label = actorLabel(profile, em);
                  const title = updatedAtIso
                    ? `${label}\nСохранено: ${new Date(updatedAtIso).toLocaleString("ru-RU")}`
                    : `${label}\nНет сохранений`;
                  return (
                    <button
                      key={`actor-snap-${em}`}
                      type="button"
                      className={cn(
                        "rolewb-actor-avatar-btn",
                        updatedAtIso && "rolewb-actor-avatar-btn--has-save",
                      )}
                      onClick={() => onOpenActorWorkbook(em)}
                      title={title}
                      aria-label={`Открыть тетрадку актёра: ${label}`}
                    >
                      <MiniAvatar
                        src={String(profile?.avatarUrl ?? "").trim() || null}
                        label={label}
                        size={52}
                        title={title}
                      />
                      <span className="rolewb-actor-avatar-status" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {error ? <div className="settings-invite-error">{error}</div> : null}
          {deleteError ? <div className="settings-invite-error">{deleteError}</div> : null}

          {canDeleteRole ? (
            <div className="rolewb-overview-danger">
              <Button
                className="danger"
                type="button"
                disabled={deletingRole}
                onClick={onDeleteRole}
              >
                Удалить роль
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
