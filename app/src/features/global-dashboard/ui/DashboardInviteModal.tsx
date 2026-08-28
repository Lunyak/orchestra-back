import { Button } from "@shared/core/button/Button";
import { Modal } from "@shared/core/modal/Modal";
import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import type { DashboardInviteAction } from "../api/dashboard-api";
import { inviteDetailLines } from "../model/dashboard-invite";
import "./global-dashboard.css";

dayjs.locale("ru");

function formatDueAt(value: string) {
  const date = dayjs(value);
  return date.isValid() ? date.format("D MMMM, HH:mm") : "Дата не указана";
}

export function DashboardInviteModal({
  invite,
  busy,
  error,
  onClose,
  onAccept,
  onDecline,
}: {
  invite: DashboardInviteAction | null;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const details = invite ? inviteDetailLines(invite, formatDueAt) : [];

  return (
    <Modal
      isOpen={invite != null}
      onClose={onClose}
      ariaLabelledBy="dashboard-invite-title"
      panelClassName="global-dashboard__invite-modal"
    >
      {invite ? (
        <div className="global-dashboard__invite-body">
          <h2 id="dashboard-invite-title">{invite.title}</h2>
          <ul className="global-dashboard__invite-meta">
            {details.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {error ? (
            <p className="global-dashboard__error" role="alert">
              {error}
            </p>
          ) : null}
          <div
            className={cn(
              "global-dashboard__action-buttons",
              "global-dashboard__invite-actions",
            )}
          >
            <Button variant="secondary" disabled={busy} onClick={onAccept}>
              Принять
            </Button>
            <Button variant="ghost" disabled={busy} onClick={onDecline}>
              Отклонить
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
