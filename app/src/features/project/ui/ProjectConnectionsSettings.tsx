import { Button } from "@shared/core/button/Button";
import cn from "classnames";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createProjectTheaterInvite,
  fetchProjectLinks,
  listProjectTheaterInvites,
  revokeProjectTheaterInvite,
  unlinkProjectTheater,
  type ProjectLinks,
} from "../../../sync/api/projects";
import {
  createTheater,
  createTroupe,
  fetchTheaters,
  fetchTroupes,
  linkProjectTheater,
  linkTheaterTroupe,
  type TheaterSummary,
  type TroupeSummary,
} from "../../../sync/api/workspaces";
import { useAuth } from "../../auth/model/auth-context";
import { useProject } from "../model/project-context";
import "./project-connections-settings.css";

export function ProjectConnectionsSettings() {
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const [theaters, setTheaters] = useState<TheaterSummary[]>([]);
  const [troupes, setTroupes] = useState<TroupeSummary[]>([]);
  const [links, setLinks] = useState<ProjectLinks | null>(null);
  const [pendingInvites, setPendingInvites] = useState<
    Array<{ id: string; expiresAt: string | null; createdAt: string }>
  >([]);
  const [shareInviteUrl, setShareInviteUrl] = useState("");
  const [theaterId, setTheaterId] = useState("");
  const [troupeId, setTroupeId] = useState("");
  const [organizationTitle, setOrganizationTitle] = useState("");
  const [organizationType, setOrganizationType] = useState<
    "THEATER" | "TROUPE"
  >("THEATER");
  const [actionStatus, setActionStatus] = useState("");

  const loadOrganizations = useCallback(async () => {
    if (!accessToken || !projectName) return;
    const [theaterItems, troupeItems, projectLinks, invites] =
      await Promise.all([
        fetchTheaters(accessToken),
        fetchTroupes(accessToken),
        fetchProjectLinks(accessToken, projectName),
        listProjectTheaterInvites(accessToken, projectName).catch(() => []),
      ]);
    setTheaters(theaterItems);
    setTroupes(troupeItems);
    setLinks(projectLinks);
    setPendingInvites(invites);
    setTheaterId((current) => current || theaterItems[0]?.id || "");
    setTroupeId((current) => current || troupeItems[0]?.id || "");
  }, [accessToken, projectName]);

  useEffect(() => {
    setActionStatus("");
    void loadOrganizations().catch(() => {
      setActionStatus("Не удалось загрузить театры и труппы");
    });
  }, [loadOrganizations]);

  const handleCreateOrganization = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const title = organizationTitle.trim();
    if (!accessToken || !title) return;
    setActionStatus("");
    try {
      if (organizationType === "THEATER") {
        await createTheater(accessToken, title);
      } else {
        await createTroupe(accessToken, title, theaterId || undefined);
      }
      setOrganizationTitle("");
      await loadOrganizations();
      const troupeStatus = theaterId
        ? "Труппа создана в выбранном театре"
        : "Создана независимая труппа";
      const organizationCreatedStatus =
        organizationType === "THEATER"
          ? "Театр создан (с основной труппой)"
          : troupeStatus;
      setActionStatus(organizationCreatedStatus);
    } catch {
      setActionStatus("Не удалось создать организацию");
    }
  };

  const handleLinkProjectTheater = async () => {
    if (!accessToken || !projectName || !theaterId) return;
    try {
      await linkProjectTheater(accessToken, projectName, theaterId);
      await loadOrganizations();
      setActionStatus("Театр подключён к проекту без смены владельца");
    } catch {
      setActionStatus("Не удалось подключить театр");
    }
  };

  const handleUnlinkTheater = async (linkedTheaterId: string) => {
    if (!accessToken || !projectName) return;
    if (!confirm("Отключить театр от проекта?")) return;
    try {
      await unlinkProjectTheater(accessToken, projectName, linkedTheaterId);
      await loadOrganizations();
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
      await loadOrganizations();
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
      await loadOrganizations();
      setActionStatus("Ссылка отозвана");
    } catch {
      setActionStatus("Не удалось отозвать ссылку");
    }
  };

  const handleLinkTheaterTroupe = async () => {
    if (!accessToken || !theaterId || !troupeId) return;
    try {
      await linkTheaterTroupe(accessToken, theaterId, troupeId);
      setActionStatus("Театр и труппа связаны");
    } catch {
      setActionStatus("Не удалось связать театр и труппу");
    }
  };

  if (!accessToken || !projectName) return null;

  const linkedTheaters = links?.theaters ?? [];

  return (
    <section className="settings-card project-connections-settings">
      <h3 className="settings-card__title">
        Организации, связи и площадки проекта
      </h3>
      <p className="settings-sync-hint">
        Создавайте независимые труппы или связывайте их с театрами. Репетиции
        подключённых проектов появятся в календаре театра.
      </p>

      {linkedTheaters.length > 0 ? (
        <ul className="project-connections-settings__links">
          {linkedTheaters.map((item) => (
            <li
              key={item.theater.id}
              className="project-connections-settings__link-row"
            >
              <span>
                {item.theater.title}
                <span className="project-connections-settings__link-meta">
                  {" "}
                  · {item.participationType}
                </span>
              </span>
              <Button
                type="button"
                onClick={() => {
                  void handleUnlinkTheater(item.theater.id);
                }}
              >
                Отключить
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="settings-sync-hint">Нет подключённых театров</p>
      )}

      <div className="project-connections-settings__share">
        <p className="settings-sync-hint">
          Чтобы поделиться проектом с театром, в котором вы не состоите,
          создайте ссылку и отправьте её администратору театра.
        </p>
        <div className="project-connections-settings__actions">
          <Button type="button" onClick={() => void handleCreateShareLink()}>
            Создать ссылку для театра
          </Button>
          {shareInviteUrl ? (
            <Button type="button" onClick={() => void handleCopyShareLink()}>
              Копировать ссылку
            </Button>
          ) : null}
        </div>
        {shareInviteUrl ? (
          <input
            className={cn("native-text-input", "project-connections-settings__share-url")}
            value={shareInviteUrl}
            readOnly
            aria-label="Ссылка для театра"
          />
        ) : null}
        {pendingInvites.length > 0 ? (
          <ul className="project-connections-settings__links">
            {pendingInvites.map((invite) => (
              <li
                key={invite.id}
                className="project-connections-settings__link-row"
              >
                <span className="project-connections-settings__link-meta">
                  Активная ссылка
                  {invite.expiresAt
                    ? ` · до ${new Date(invite.expiresAt).toLocaleDateString()}`
                    : ""}
                </span>
                <Button
                  type="button"
                  onClick={() => {
                    void handleRevokeInvite(invite.id);
                  }}
                >
                  Отозвать
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <form
        className="project-connections-settings__organization"
        onSubmit={handleCreateOrganization}
      >
        <select
          className="native-text-input"
          value={organizationType}
          onChange={(event) =>
            setOrganizationType(
              event.target.value === "TROUPE" ? "TROUPE" : "THEATER",
            )
          }
          aria-label="Тип организации"
        >
          <option value="THEATER">Театр</option>
          <option value="TROUPE">Труппа</option>
        </select>
        <input
          className="native-text-input"
          value={organizationTitle}
          onChange={(event) => setOrganizationTitle(event.target.value)}
          placeholder="Название организации"
        />
        <Button type="submit" disabled={!organizationTitle.trim()}>
          Создать организацию
        </Button>
      </form>

      <div className="project-connections-settings__fields">
        <select
          className="native-text-input"
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
        <select
          className="native-text-input"
          value={troupeId}
          onChange={(event) => setTroupeId(event.target.value)}
          aria-label="Труппа"
        >
          <option value="">Выберите труппу</option>
          {troupes.map((troupe) => (
            <option key={troupe.id} value={troupe.id}>
              {troupe.title}
            </option>
          ))}
        </select>
      </div>

      <div className="project-connections-settings__actions">
        <Button
          type="button"
          onClick={handleLinkProjectTheater}
          disabled={!theaterId}
        >
          Подключить свой театр
        </Button>
        <Button
          type="button"
          onClick={handleLinkTheaterTroupe}
          disabled={!theaterId || !troupeId}
        >
          Связать театр и труппу
        </Button>
      </div>

      {actionStatus ? (
        <p className="project-connections-settings__status" role="status">
          {actionStatus}
        </p>
      ) : null}
    </section>
  );
}
