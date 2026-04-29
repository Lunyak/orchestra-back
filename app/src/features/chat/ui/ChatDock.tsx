import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth";
import { useAppSelector } from "../../../shared/store/hooks";
import { disconnectChatSocket, getChatSocket } from "../../../realtime/chat-socket";
import {
  fetchChatConversations,
  fetchChatMessages,
  markChatConversationRead,
  postChatMessage,
  type ChatConversationItem,
  type ChatMessageItem,
} from "../../../sync/api/chat";
import { getMyProfile } from "../../../sync/api/profile";
import { ChatDockMessagesContent } from "./ChatDockMessagesContent";
import "./ChatDock.css";

const CHAT_PAGE_SIZE = 20;

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
  const [unreadByConv, setUnreadByConv] = useState<Record<string, number>>({});
  const [toggleAttention, setToggleAttention] = useState(false);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const skipScrollToEndRef = useRef(false);
  const scrollRestoreRef = useRef<{ fromTop: number; fromHeight: number } | null>(null);
  const olderInFlightRef = useRef(false);
  const wasLoadingMsgsRef = useRef(false);
  const activeIdRef = useRef<string | null>(null);
  const openRef = useRef(false);
  const myEmailRef = useRef<string | null>(null);
  activeIdRef.current = activeId;
  openRef.current = open;
  myEmailRef.current = myEmail;

  useEffect(() => {
    if (!accessToken) {
      disconnectChatSocket();
      setOpen(false);
      setMyEmail(null);
      setUnreadByConv({});
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const profile = await getMyProfile(accessToken);
        if (!cancelled) setMyEmail(profile.email.trim().toLowerCase());
      } catch {
        if (!cancelled) setMyEmail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      disconnectChatSocket();
      return;
    }
    const sock = getChatSocket(accessToken);
    if (!sock) return;

    (sock as any).auth = { token: accessToken };

    const onMessage = (payload: ChatMessageItem) => {
      const mine =
        myEmailRef.current != null &&
        payload.authorEmail.trim().toLowerCase() === myEmailRef.current;
      const viewingThis =
        openRef.current && activeIdRef.current === payload.conversationId;

      if (!mine && !viewingThis) {
        setUnreadByConv((prev) => ({
          ...prev,
          [payload.conversationId]: (prev[payload.conversationId] ?? 0) + 1,
        }));
        if (!openRef.current) setToggleAttention(true);
      }

      if (viewingThis) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.id)) return prev;
          return [...prev, payload];
        });
      }
    };

    sock.on("chat-message", onMessage);
    if (!sock.connected) sock.connect();

    return () => {
      sock.off("chat-message", onMessage);
    };
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
        const convs = await fetchChatConversations();
        if (cancelled) return;
        setConversations(convs);
        const nextUnread: Record<string, number> = {};
        for (const c of convs) {
          nextUnread[c.id] = typeof c.unreadCount === "number" ? c.unreadCount : 0;
        }
        setUnreadByConv(nextUnread);
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
    setMessages([]);
    (async () => {
      try {
        const res = await fetchChatMessages(activeId, { limit: CHAT_PAGE_SIZE });
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

  const lastVisibleMessageId = messages.length ? messages[messages.length - 1]!.id : null;

  useEffect(() => {
    if (!open || !activeId || !accessToken || loadingMsgs || !lastVisibleMessageId) return;
    const t = window.setTimeout(() => {
      void markChatConversationRead(activeId, lastVisibleMessageId).then((res) => {
        setUnreadByConv((prev) => ({ ...prev, [activeId]: res.unreadCount }));
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [open, activeId, accessToken, loadingMsgs, lastVisibleMessageId]);

  useEffect(() => {
    if (open) setToggleAttention(false);
  }, [open]);

  useEffect(() => {
    if (!toggleAttention) return;
    const t = window.setTimeout(() => setToggleAttention(false), 2200);
    return () => window.clearTimeout(t);
  }, [toggleAttention]);

  const updateJumpToBottomVisibility = useCallback(() => {
    const el = messagesScrollRef.current;
    if (!el || !open) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowJumpToBottom(gap > 100);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = messagesScrollRef.current;
    if (!el) return;

    const p = scrollRestoreRef.current;
    if (p) {
      scrollRestoreRef.current = null;
      const delta = el.scrollHeight - p.fromHeight;
      el.scrollTop = p.fromTop + delta;
      skipScrollToEndRef.current = false;
      wasLoadingMsgsRef.current = loadingMsgs;
      setShowJumpToBottom(false);
      return;
    }

    if (skipScrollToEndRef.current) {
      skipScrollToEndRef.current = false;
      wasLoadingMsgsRef.current = loadingMsgs;
      return;
    }

    if (messages.length === 0) {
      if (loadingMsgs) wasLoadingMsgsRef.current = true;
      setShowJumpToBottom(false);
      return;
    }

    const finishedInitialLoad = wasLoadingMsgsRef.current && !loadingMsgs;
    wasLoadingMsgsRef.current = loadingMsgs;

    if (finishedInitialLoad) {
      el.scrollTop = el.scrollHeight;
      setShowJumpToBottom(false);
      return;
    }

    if (!loadingMsgs) {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (gap < 96) {
        el.scrollTop = el.scrollHeight;
        setShowJumpToBottom(false);
      }
    }
  }, [open, loadingMsgs, messages]);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el || !open) return;
    updateJumpToBottomVisibility();
    el.addEventListener("scroll", updateJumpToBottomVisibility, { passive: true });
    return () => el.removeEventListener("scroll", updateJumpToBottomVisibility);
  }, [open, activeId, updateJumpToBottomVisibility]);

  useEffect(() => {
    if (!open || loadingMsgs) return;
    const id = requestAnimationFrame(() => updateJumpToBottomVisibility());
    return () => cancelAnimationFrame(id);
  }, [open, loadingMsgs, messages.length, updateJumpToBottomVisibility]);

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setShowJumpToBottom(false);
  }, []);

  const totalUnread = useMemo(
    () => Object.values(unreadByConv).reduce((a, n) => a + (typeof n === "number" ? n : 0), 0),
    [unreadByConv],
  );

  const loadOlder = useCallback(async () => {
    if (!activeId || !nextBefore || olderInFlightRef.current) return;
    olderInFlightRef.current = true;
    setLoadingOlder(true);
    try {
      const res = await fetchChatMessages(activeId, {
        beforeMessageId: nextBefore,
        limit: CHAT_PAGE_SIZE,
      });
      const root = messagesScrollRef.current;
      if (root) {
        scrollRestoreRef.current = {
          fromTop: root.scrollTop,
          fromHeight: root.scrollHeight,
        };
      }
      skipScrollToEndRef.current = true;
      setMessages((prev) => [...res.messages, ...prev]);
      setNextBefore(res.nextBeforeMessageId);
    } catch {
      scrollRestoreRef.current = null;
      skipScrollToEndRef.current = false;
    } finally {
      olderInFlightRef.current = false;
      setLoadingOlder(false);
    }
  }, [activeId, nextBefore]);

  useEffect(() => {
    if (!open || !activeId || !nextBefore || loadingMsgs) return;
    const root = messagesScrollRef.current;
    const sentinel = topSentinelRef.current;
    if (!root || !sentinel) return;

    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries[0]?.isIntersecting;
        if (!hit || olderInFlightRef.current) return;
        const tall = root.scrollHeight > root.clientHeight + 12;
        // Без реальной прокрутки scrollTop всегда 0 — IO по sentinel зациклит подгрузку.
        if (!tall) return;
        // У низа списка: не тянем историю, пока пользователь не прокрутил вверх.
        if (root.scrollTop > 72) return;
        void loadOlder();
      },
      { root, rootMargin: "80px 0px 0px 0px", threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [open, activeId, nextBefore, loadingMsgs, loadOlder]);

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
  const toggleUnreadLabel =
    totalUnread > 0 ? `${totalUnread > 99 ? "99+" : totalUnread} непрочитанных` : "";

  return (
    <>
      <button
        type="button"
        className={[
          "chat-dock-toggle",
          totalUnread > 0 ? "chat-dock-toggle--has-unread" : "",
          toggleAttention ? "chat-dock-toggle--attention" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={
          open
            ? "Закрыть чат"
            : toggleUnreadLabel
              ? `Открыть чат, ${toggleUnreadLabel}`
              : "Открыть чат"
        }
        title={toggleUnreadLabel ? `Чат — ${toggleUnreadLabel}` : "Чат"}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="chat-dock-toggle-inner">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {totalUnread > 0 ? (
            <span className="chat-dock-toggle-badge" aria-hidden>
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          ) : null}
        </span>
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
                  className={[
                    "chat-dock-conv-btn",
                    c.id === activeId ? "chat-dock-conv-btn--active" : "",
                    (unreadByConv[c.id] ?? 0) > 0 && c.id !== activeId
                      ? "chat-dock-conv-btn--unread"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setActiveId(c.id)}
                >
                  <span className="chat-dock-conv-btn-label">{conversationLabel(c, myTroupe)}</span>
                  {(unreadByConv[c.id] ?? 0) > 0 && c.id !== activeId ? (
                    <span className="chat-dock-conv-badge" aria-hidden>
                      {(unreadByConv[c.id] ?? 0) > 99 ? "99+" : unreadByConv[c.id]}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          <div className="chat-dock-messages" ref={messagesScrollRef}>
            {loadingList || loadingMsgs ? (
              <div className="chat-dock-muted">Загрузка…</div>
            ) : !conversations.length ? (
              <div className="chat-dock-muted">Нет доступных чатов труппы</div>
            ) : !activeId ? (
              <div className="chat-dock-muted">Выберите чат</div>
            ) : (
              <>
                {nextBefore ? (
                  <div className="chat-dock-history-top" aria-busy={loadingOlder}>
                    <div ref={topSentinelRef} className="chat-dock-history-sentinel" aria-hidden />
                    {loadingOlder ? (
                      <div className="chat-dock-history-loading">Загрузка истории…</div>
                    ) : null}
                  </div>
                ) : null}
                <ChatDockMessagesContent
                  accessToken={accessToken}
                  messages={messages}
                  myEmail={myEmail}
                />
                <div className="chat-dock-messages-end" aria-hidden />
                {showJumpToBottom ? (
                  <button
                    type="button"
                    className="chat-dock-scroll-down"
                    aria-label="К последним сообщениям"
                    title="К последним сообщениям"
                    onClick={() => scrollMessagesToBottom("smooth")}
                  >
                    <span aria-hidden>↓</span>
                  </button>
                ) : null}
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
