import dayjs from "dayjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth";
import { useAppSelector } from "../../../shared/store/hooks";
import { disconnectChatSocket, getChatSocket } from "../../../realtime/chat-socket";
import {
  fetchChatConversations,
  fetchChatMessages,
  getMyProfile,
  postChatMessage,
  type ChatConversationItem,
  type ChatMessageItem,
} from "../../../sync/api";
import "./ChatDock.css";

function shortEmail(email: string) {
  const e = email.trim().toLowerCase();
  const at = e.indexOf("@");
  return at > 0 ? e.slice(0, at) : e;
}

function conversationLabel(
  c: ChatConversationItem,
  myTroupe: { id: string; title: string } | null,
): string {
  if (c.troupeId && myTroupe?.id === c.troupeId) return myTroupe.title;
  return c.title;
}

export function ChatDock() {
  const { accessToken } = useAuth();
  const myTroupe = useAppSelector((s) => s.troupe.troupe);
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<ChatConversationItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [myEmail, setMyEmail] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!accessToken) {
      disconnectChatSocket();
      setOpen(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!open) setExpanded(false);
  }, [open]);

  useEffect(() => {
    if (!open || !expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, expanded]);

  useEffect(() => {
    if (!open || !expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, expanded]);

  useEffect(() => {
    if (!open || !accessToken) return;
    let cancelled = false;
    setLoadingList(true);
    (async () => {
      try {
        const [convs, profile] = await Promise.all([
          fetchChatConversations(),
          getMyProfile(accessToken),
        ]);
        if (cancelled) return;
        setConversations(convs);
        setMyEmail(profile.email.trim().toLowerCase());
        if (!convs.length) {
          setActiveId(null);
        } else {
          setActiveId((current) =>
            current && convs.some((c) => c.id === current) ? current : convs[0]!.id,
          );
        }
      } catch {
        if (!cancelled) {
          setConversations([]);
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, accessToken]);

  useEffect(() => {
    if (!open || !activeId) return;
    let cancelled = false;
    setLoadingMsgs(true);
    setNextBefore(null);
    (async () => {
      try {
        const res = await fetchChatMessages(activeId);
        if (!cancelled) {
          setMessages(res.messages);
          setNextBefore(res.nextBeforeMessageId);
        }
      } catch {
        if (!cancelled) {
          setMessages([]);
          setNextBefore(null);
        }
      } finally {
        if (!cancelled) setLoadingMsgs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, activeId]);

  useEffect(() => {
    if (!open || !accessToken || !activeId) return undefined;
    const sock = getChatSocket(accessToken);
    if (!sock) return undefined;

    (sock as any).auth = { token: accessToken };

    const onMessage = (payload: ChatMessageItem) => {
      if (payload.conversationId !== activeId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.id)) return prev;
        return [...prev, payload];
      });
    };

    sock.on("chat-message", onMessage);

    const join = () => {
      sock.emit("join-conversation", { conversationId: activeId });
    };

    if (sock.connected) join();
    else {
      sock.connect();
      sock.once("connect", join);
    }

    return () => {
      sock.emit("leave-conversation", { conversationId: activeId });
      sock.off("chat-message", onMessage);
      sock.off("connect", join);
    };
  }, [open, accessToken, activeId]);

  useEffect(() => {
    if (!open) return;
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, messages.length]);

  const loadOlder = useCallback(async () => {
    if (!activeId || !nextBefore || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await fetchChatMessages(activeId, {
        beforeMessageId: nextBefore,
        limit: 50,
      });
      setMessages((prev) => [...res.messages, ...prev]);
      setNextBefore(res.nextBeforeMessageId);
    } finally {
      setLoadingOlder(false);
    }
  }, [activeId, nextBefore, loadingOlder]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || !activeId || sending) return;
    const clientMessageId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    setSending(true);
    try {
      const msg = await postChatMessage(activeId, text, clientMessageId);
      setDraft("");
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    } finally {
      setSending(false);
    }
  }, [draft, activeId, sending]);

  if (!accessToken) return null;

  const activeConv = conversations.find((c) => c.id === activeId);
  const activeTitle = activeConv ? conversationLabel(activeConv, myTroupe) : "Чат";

  return (
    <>
      <button
        type="button"
        className="chat-dock-toggle"
        aria-label={open ? "Закрыть чат" : "Открыть чат"}
        title="Чат"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <section
          className={`chat-dock-panel${expanded ? " chat-dock-panel--expanded" : ""}`}
          aria-label="Чат"
        >
          <header className="chat-dock-head">
            <span className="chat-dock-head-title">{activeTitle}</span>
            <div className="chat-dock-head-actions">
              <button
                type="button"
                className="chat-dock-icon-btn"
                aria-label={expanded ? "Сжать окно чата" : "Чат на весь экран"}
                title={expanded ? "Сжать" : "На весь экран"}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M9 9H4V4M15 9h5V4M9 15H4v5M15 15h5v5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4M15 21h4a2 2 0 0 0 2-2v-4"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
              <button
                type="button"
                className="chat-dock-close"
                aria-label="Закрыть"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
          </header>

          {conversations.length > 1 ? (
            <div className="chat-dock-conv-list" role="tablist" aria-label="Список чатов">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={c.id === activeId}
                  className={`chat-dock-conv-btn ${c.id === activeId ? "chat-dock-conv-btn--active" : ""}`}
                  onClick={() => setActiveId(c.id)}
                >
                  {conversationLabel(c, myTroupe)}
                </button>
              ))}
            </div>
          ) : null}

          <div className="chat-dock-messages">
            {loadingList || loadingMsgs ? (
              <div className="chat-dock-muted">Загрузка…</div>
            ) : !conversations.length ? (
              <div className="chat-dock-muted">Нет доступных чатов труппы</div>
            ) : !activeId ? (
              <div className="chat-dock-muted">Выберите чат</div>
            ) : (
              <>
                {nextBefore ? (
                  <button
                    type="button"
                    className="chat-dock-load-more"
                    disabled={loadingOlder}
                    onClick={() => void loadOlder()}
                  >
                    {loadingOlder ? "…" : "Раньше"}
                  </button>
                ) : null}
                {messages.map((m) => {
                  const mine =
                    myEmail != null &&
                    m.authorEmail.trim().toLowerCase() === myEmail;
                  return (
                    <article
                      key={m.id}
                      className={`chat-dock-msg ${mine ? "chat-dock-msg--mine" : ""}`}
                    >
                      <div className="chat-dock-msg-meta">
                        <span>{shortEmail(m.authorEmail)}</span>
                        <span>{dayjs(m.createdAt).format("DD.MM HH:mm")}</span>
                      </div>
                      <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
                    </article>
                  );
                })}
                <div ref={listEndRef} />
              </>
            )}
          </div>

          <footer className="chat-dock-foot">
            <textarea
              className="chat-dock-input"
              rows={2}
              placeholder="Сообщение…"
              value={draft}
              disabled={!activeId || sending}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="button"
              className="chat-dock-send"
              disabled={!activeId || sending || !draft.trim()}
              onClick={() => void send()}
            >
              Отпр.
            </button>
          </footer>
        </section>
      ) : null}
    </>
  );
}
