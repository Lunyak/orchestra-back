import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { globalPaths } from "../../../app/router/paths";
import { useAuth } from "../../auth";
import { isProjectorOutputWindow } from "../../projector/model/projector-playback-bridge";
import {
  type DashboardInviteAction,
  useAnswerDashboardInviteMutation,
  useGlobalDashboardQuery,
} from "../api/dashboard-api";
import iconMail from "../assets/icon-mail.png";
import {
  inviteActionKey,
  isInviteAction,
  pickUnseenIncomingMails,
  type DashboardIncomingMailAction,
} from "../model/dashboard-invite";
import {
  INCOMING_INVITE_MAIL_SEEN_EVENT,
  readSeenInviteMailKeys,
  rememberSeenInviteMailKeys,
} from "../model/seen-invite-mail-storage";
import { DashboardInviteModal } from "./DashboardInviteModal";
import "./incoming-invite-mail.css";

const POLL_MS = 20000;
const MAX_VISIBLE = 5;

export function IncomingInviteMail() {
  const { accessToken } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isProjectorOutput = isProjectorOutputWindow();
  const dashboard = useGlobalDashboardQuery(undefined, {
    skip: !accessToken || isProjectorOutput,
    pollingInterval: POLL_MS,
    refetchOnFocus: true,
  });
  const [answerInvite, answerInviteState] = useAnswerDashboardInviteMutation();
  const [seenKeys, setSeenKeys] = useState(readSeenInviteMailKeys);
  const [openedInvite, setOpenedInvite] =
    useState<DashboardInviteAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const unseen = pickUnseenIncomingMails(
    dashboard.data?.actions ?? [],
    seenKeys,
  ).slice(0, MAX_VISIBLE);
  const showStack = unseen.length > 0 && openedInvite == null;

  useEffect(() => {
    const syncSeenKeys = () => setSeenKeys(readSeenInviteMailKeys());
    window.addEventListener(INCOMING_INVITE_MAIL_SEEN_EVENT, syncSeenKeys);
    return () => {
      window.removeEventListener(INCOMING_INVITE_MAIL_SEEN_EVENT, syncSeenKeys);
    };
  }, []);

  const markSeen = (action: DashboardIncomingMailAction) => {
    setSeenKeys(rememberSeenInviteMailKeys([inviteActionKey(action)]));
  };

  const openMail = (action: DashboardIncomingMailAction) => {
    markSeen(action);
    if (isInviteAction(action)) {
      setActionError(null);
      setOpenedInvite(action);
      return;
    }
    if (location.pathname !== globalPaths.dashboard) {
      navigate(globalPaths.dashboard);
    }
  };

  const runInviteResponse = async (response: "accept" | "decline") => {
    if (!openedInvite) return;
    setActionError(null);
    try {
      await answerInvite({
        kind: openedInvite.kind,
        inviteId: openedInvite.id,
        response,
      }).unwrap();
      setOpenedInvite(null);
    } catch {
      setActionError("Не удалось выполнить действие. Попробуйте ещё раз.");
    }
  };

  if (isProjectorOutput || !accessToken) return null;

  return (
    <>
      {showStack ? (
        <div className="incoming-invite-mail" role="status" aria-live="polite">
          <ul className="incoming-invite-mail__list">
            {unseen.map((action) => (
              <li key={inviteActionKey(action)}>
                <button
                  type="button"
                  className="incoming-invite-mail__item"
                  onClick={() => openMail(action)}
                >
                  <img
                    className="incoming-invite-mail__icon"
                    src={iconMail}
                    alt=""
                    draggable={false}
                  />
                  <span className="incoming-invite-mail__subject">
                    {action.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <DashboardInviteModal
        invite={openedInvite}
        busy={answerInviteState.isLoading}
        error={actionError}
        onClose={() => setOpenedInvite(null)}
        onAccept={() => void runInviteResponse("accept")}
        onDecline={() => void runInviteResponse("decline")}
      />
    </>
  );
}
