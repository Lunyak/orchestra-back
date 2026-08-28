import { Buttons } from "@shared/components/buttons/Buttons";
import { Button } from "@shared/core/button/Button";
import { MiniAvatar } from "@shared/core/mini-avatar/MiniAvatar";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { theaterOverviewPath } from "../../../app/router/paths";
import {
  createProjectTheaterInvite,
  fetchProjectLinks,
  listProjectTheaterInvites,
  revokeProjectTheaterInvite,
  unlinkProjectTheater,
  type ProjectLinks,
} from "../../../sync/api/projects";
import {
  fetchTheaters,
  linkProjectTheater,
  type TheaterSummary,
} from "../../../sync/api/workspaces";
import { useAuth } from "../../auth/model/auth-context";
import { readTheaterPoster } from "../../organizations/model/theater-poster-storage";
import { useTeam } from "../../team";
import { useProject } from "../model/project-context";
import "./project-connections-settings.css";

export function ProjectConnectionsSettings() {
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const { isProjectOwner } = useTeam();
  const canManageProjectLinks = isProjectOwner === true;
  const [theaters, setTheaters] = useState<TheaterSummary[]>([]);
  const [links, setLinks] = useState<ProjectLinks | null>(null);
  const [pendingInvites, setPendingInvites] = useState<
    Array<{ id: string; expiresAt: string | null; createdAt: string }>
  >([]);
  const [shareInviteUrl, setShareInviteUrl] = useState("");
  const [theaterId, setTheaterId] = useState("");
  const [actionStatus, setActionStatus] = useState("");

  const loadConnections = useCallback(async () => {
    if (!accessToken || !projectName) return;
    const emptyInvites: Array<{
      id: string;
      expiresAt: string | null;
      createdAt: string;
    }> = [];
    const [theaterItems, projectLinks, invites] = await Promise.all([
      canManageProjectLinks ? fetchTheaters(accessToken) : Promise.resolve([]),
      fetchProjectLinks(accessToken, projectName),
      canManageProjectLinks
        ? listProjectTheaterInvites(accessToken, projectName).catch(
            () => emptyInvites,
          )
        : Promise.resolve(emptyInvites),
    ]);
    setTheaters(theaterItems);
    setLinks(projectLinks);
    setPendingInvites(invites);
    setTheaterId((current) => current || theaterItems[0]?.id || "");
  }, [accessToken, canManageProjectLinks, projectName]);

  useEffect(() => {
    setActionStatus("");
    void loadConnections().catch(() => {
      setActionStatus("Не удалось загрузить связи проекта");
    });
  }, [loadConnections]);

  const handleLinkProjectTheater = async () => {
    if (!accessToken || !projectName || !theaterId) return;
    try {
      await linkProjectTheater(accessToken, projectName, theaterId);
      await loadConnections();
      setActionStatus("Театр подключён к проекту");
    } catch {
      setActionStatus("Не удалось подключить театр");
    }
  };

  const handleUnlinkTheater = async (linkedTheaterId: string) => {
    if (!accessToken || !projectName) return;
    if (!confirm("Отключить театр от проекта?")) return;
    try {
      await unlinkProjectTheater(accessToken, projectName, linkedTheaterId);
      await loadConnections();
      setActionStatus("Театр отключён");
    } catch {
      setActionStatus("Не удалось отключить театр");
    }
  };

  const handleCreateShareLink = async () => {
    if (!accessToken || !projectName) return;
    try {
      const invite = await createProjectTheaterInvite(accessToken, projectName);
      const absoluteUrl = `${window.location.origin}${invite.invitePath}`;
      setShareInviteUrl(absoluteUrl);
      await loadConnections();
      setActionStatus("Ссылка для театра создана");
    } catch {
      setActionStatus("Не удалось создать ссылку");
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareInviteUrl) return;
    try {
      await navigator.clipboard.writeText(shareInviteUrl);
      setActionStatus("Ссылка скопирована");
    } catch {
      setActionStatus("Не удалось скопировать ссылку");
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!accessToken || !projectName) return;
    try {
      await revokeProjectTheaterInvite(accessToken, projectName, inviteId);
      setShareInviteUrl("");
      await loadConnections();
      setActionStatus("Ссылка отозвана");
    } catch {
      setActionStatus("Не удалось отозвать ссылку");
    }
  };

  if (!accessToken || !projectName) return null;

  const linkedPartner = links?.theaters?.[0] ?? null;
  const hasPartner = Boolean(linkedPartner);
  const partnerPosterSrc = linkedPartner
    ? readTheaterPoster(linkedPartner.theater.id)
    : null;

  if (!hasPartner && !canManageProjectLinks && !actionStatus) return null;

  return (
    <section className="settings-card settings-invite project-connections-settings">
      {hasPartner && linkedPartner ? (
        <div className="settings-project-field">
          <span className="settings-project-field__label">Партнёр</span>
          <div className="settings-member-row project-connections-settings__partner">
            <Link
              to={theaterOverviewPath(linkedPartner.theater.id)}
              className="settings-member-email project-connections-settings__theater-link"
              title={linkedPartner.participationType}
            >
              <span className="settings-member-email__inner">
                <MiniAvatar
                  src={partnerPosterSrc}
                  label={linkedPartner.theater.title}
                  size={20}
                />
                <span>{linkedPartner.theater.title}</span>
              </span>
            </Link>
            {canManageProjectLinks ? (
              <div className="settings-member-actions">
                <Buttons.DeleteButton
                  type="button"
                  className="settings-member-remove"
                  onClick={() => {
                    void handleUnlinkTheater(linkedPartner.theater.id);
                  }}
                  aria-label={`Отключить ${linkedPartner.theater.title}`}
                  title="Отключить"
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : canManageProjectLinks ? (
        <>
          <h3 className="settings-card__title">Театр</h3>
          <div className="settings-invite-row">
            <select
              className="settings-invite-input"
              value={theaterId}
              onChange={(event) => setTheaterId(event.target.value)}
              aria-label="Театр"
            >
              <option value="">Выберите театр</option>
              {theaters.map((theater) => (
                <option key={theater.id} value={theater.id}>
                  {theater.title}
                </option>
              ))}
            </select>
            <Button
              type="button"
              className="primary"
              onClick={handleLinkProjectTheater}
              disabled={!theaterId}
            >
              Подключить
            </Button>
            <Button type="button" onClick={() => void handleCreateShareLink()}>
              Ссылка
            </Button>
            {shareInviteUrl ? (
              <Button type="button" onClick={() => void handleCopyShareLink()}>
                Копировать
              </Button>
            ) : null}
          </div>

          {shareInviteUrl ? (
            <input
              className="settings-invite-input project-connections-settings__share-url"
              value={shareInviteUrl}
              readOnly
              aria-label="Ссылка для театра"
            />
          ) : null}

          {pendingInvites.length > 0 ? (
            <div className="settings-members">
              <ul className="settings-members-list">
                {pendingInvites.map((invite) => {
                  const expiresLabel = invite.expiresAt
                    ? ` · до ${new Date(invite.expiresAt).toLocaleDateString()}`
                    : "";
                  return (
                    <li key={invite.id} className="settings-member-row">
                      <span className="settings-member-email">
                        Ссылка{expiresLabel}
                      </span>
                      <div className="settings-member-actions">
                        <Buttons.DeleteButton
                          type="button"
                          className="settings-member-remove"
                          onClick={() => {
                            void handleRevokeInvite(invite.id);
                          }}
                          aria-label="Отозвать ссылку"
                          title="Отозвать"
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      {actionStatus ? (
        <p className="settings-sync-hint" role="status">
          {actionStatus}
        </p>
      ) : null}
    </section>
  );
}
