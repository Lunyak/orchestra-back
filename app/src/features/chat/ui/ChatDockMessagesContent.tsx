import cn from "classnames";
import dayjs from "dayjs";
import { memo, useEffect, useRef, useState } from "react";
import { MiniAvatar } from "../../../shared/components/mini-avatar/MiniAvatar";
import { type ChatMessageItem } from "../../../sync/api/chat";
import { getProfilesBatch, type TeamProfile } from "../../../sync/api/profile";

function shortEmail(email: string) {
  const e = email.trim().toLowerCase();
  const at = e.indexOf("@");
  return at > 0 ? e.slice(0, at) : e;
}

function chatAuthorLabel(profile: TeamProfile | null | undefined, email: string): string {
  const p = profile ?? null;
  const display = String(p?.displayName ?? "").trim();
  if (display) return display;
  const full = `${String(p?.firstName ?? "").trim()} ${String(p?.lastName ?? "").trim()}`.trim();
  if (full) return full;
  return shortEmail(email);
}

export const ChatDockMessagesContent = memo(function ChatDockMessagesContent({
  accessToken,
  messages,
  myEmail,
}: {
  accessToken: string;
  messages: ChatMessageItem[];
  myEmail: string | null;
}) {
  const [profileByEmail, setProfileByEmail] = useState<Record<string, TeamProfile | null>>({});
  const profileByEmailRef = useRef(profileByEmail);
  profileByEmailRef.current = profileByEmail;

  useEffect(() => {
    if (!messages.length) return;
    const need = [...new Set(messages.map((m) => m.authorEmail.trim().toLowerCase()))];
    const missing = need.filter((e) => !(e in profileByEmailRef.current));
    if (!missing.length) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await getProfilesBatch(accessToken, missing);
        if (cancelled) return;
        setProfileByEmail((prev) => {
          const next = { ...prev };
          for (const e of missing) {
            const p = rows.find((r) => r.email.trim().toLowerCase() === e);
            next[e] = p ?? null;
          }
          return next;
        });
      } catch {
        if (cancelled) return;
        setProfileByEmail((prev) => {
          const next = { ...prev };
          for (const e of missing) {
            next[e] = null;
          }
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, messages]);

  return (
    <>
      {messages.map((m) => {
        const mine =
          myEmail != null && m.authorEmail.trim().toLowerCase() === myEmail;
        const norm = m.authorEmail.trim().toLowerCase();
        const prof = profileByEmail[norm];
        const label = chatAuthorLabel(prof ?? undefined, m.authorEmail);
        const avatarSrc =
          prof && String(prof.avatarUrl ?? "").trim()
            ? String(prof.avatarUrl).trim()
            : null;
        return (
          <article
            key={m.id}
            className={cn("chat-dock-msg", mine && "chat-dock-msg--mine")}
          >
            <div className="chat-dock-msg-row">
              <MiniAvatar
                src={avatarSrc}
                label={label}
                size={28}
                title={m.authorEmail}
              />
              <div className="chat-dock-msg-col">
                <div className="chat-dock-msg-meta">
                  <span title={m.authorEmail}>{label}</span>
                  <span>{dayjs(m.createdAt).format("DD.MM HH:mm")}</span>
                </div>
                <div className="chat-dock-msg__body">{m.body}</div>
              </div>
            </div>
          </article>
        );
      })}
    </>
  );
});
