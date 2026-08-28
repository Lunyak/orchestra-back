import type {
  DashboardAction,
  DashboardInviteAction,
} from "../api/dashboard-api";

export type DashboardIncomingMailAction =
  | DashboardInviteAction
  | Extract<DashboardAction, { kind: "director_session_invitation" }>;

export function isInviteAction(
  action: DashboardAction,
): action is DashboardInviteAction {
  return (
    action.kind === "studio_invite" ||
    action.kind === "project_invite" ||
    action.kind === "troupe_invite"
  );
}

export function isIncomingMailAction(
  action: DashboardAction,
): action is DashboardIncomingMailAction {
  return isInviteAction(action) || action.kind === "director_session_invitation";
}

export function inviteActionKey(action: Pick<DashboardAction, "kind" | "id">) {
  return `${action.kind}:${action.id}`;
}

export function inviteDetailLines(
  action: DashboardInviteAction,
  formatDueAt: (value: string) => string,
): string[] {
  const lines = [action.description, `От: ${action.invitedByEmail}`];
  if (action.dueAt) {
    lines.push(`Действует до: ${formatDueAt(action.dueAt)}`);
  }
  return lines;
}

export function pickUnseenIncomingMails(
  actions: DashboardAction[],
  seenKeys: string[],
): DashboardIncomingMailAction[] {
  const seen = new Set(seenKeys);
  return actions.filter(isIncomingMailAction).filter((action) => {
    const isUnseen = !seen.has(inviteActionKey(action));
    return isUnseen;
  });
}
