import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { Button } from "@shared/core/button/Button";
import { useAuth } from "../../features/auth";
import {
  getDirectorSession,
  getMyDirectorSessionComment,
  upsertMyDirectorSessionComment,
  type DirectorSession,
} from "../../sync/api";

dayjs.locale("ru");

export function DirectorSessionDetailsPage() {
  const { accessToken } = useAuth();
  const { sessionId } = useParams();

  const id = String(sessionId ?? "").trim();
  const [session, setSession] = useState<DirectorSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [comment, setComment] = useState<string>("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentMsg, setCommentMsg] = useState<string | null>(null);
  const [commentErr, setCommentErr] = useState<string | null>(null);

  const saveTimerRef = useRef<number | null>(null);
  const baselineRef = useRef<string | null>(null);

  useEffect(() => {
    if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
  }, []);

  useEffect(() => {
    if (!accessToken || !id) return;
    setLoading(true);
    setError(null);
    getDirectorSession(accessToken, id)
      .then((s) => setSession(s))
      .catch((e: any) => {
        const msg = e?.response?.data?.message ?? "Не удалось загрузить сессию";
        setError(String(msg));
      })
      .finally(() => setLoading(false));
  }, [accessToken, id]);

  useEffect(() => {
    if (!accessToken || !id) return;
    setCommentLoading(true);
    setCommentErr(null);
    getMyDirectorSessionComment(accessToken, id)
      .then((res) => {
        const text = String(res?.comment?.content ?? "");
        setComment(text);
        baselineRef.current = text;
      })
      .catch((e: any) => {
        const msg = e?.response?.data?.message ?? "Не удалось загрузить комментарий";
        setCommentErr(String(msg));
      })
      .finally(() => setCommentLoading(false));
  }, [accessToken, id]);

  const headerTimeLabel = useMemo(() => {
    if (!session?.startsAt) return "";
    const start = dayjs(session.startsAt);
    return start.format("D MMMM YYYY, HH:mm");
  }, [session?.startsAt]);

  const scheduleAutosave = () => {
    if (!accessToken || !id) return;
    if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      if (!accessToken || !id) return;
      if (commentSaving) return;
      const next = comment;
      if (baselineRef.current != null && next === baselineRef.current) return;
      setCommentSaving(true);
      setCommentMsg(null);
      setCommentErr(null);
      try {
        const res = await upsertMyDirectorSessionComment(accessToken, id, { content: next });
        const saved = String(res?.comment?.content ?? "");
        baselineRef.current = saved;
        setComment(saved);
        setCommentMsg("Сохранено");
      } catch (e: any) {
        const msg = e?.response?.data?.message ?? "Не удалось сохранить комментарий";
        setCommentErr(String(msg));
      } finally {
        setCommentSaving(false);
      }
    }, 700);
  };

  useEffect(() => {
    if (!accessToken || !id) return;
    scheduleAutosave();
    return () => {
      if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comment, accessToken, id]);

  if (!accessToken) return <div>Нужно войти, чтобы открыть сессию.</div>;
  if (!id) return <div>Некорректный URL сессии.</div>;

  return (
    <div style={{ padding: "12px 12px 40px" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Link to="/sessions" style={{ textDecoration: "none", color: "inherit", opacity: 0.85 }}>
          ← Все сессии
        </Link>
        <div style={{ fontWeight: 800, fontSize: 16 }}>Сессия</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>{headerTimeLabel}</div>
      </div>

      {loading ? <div style={{ marginTop: 10, opacity: 0.75 }}>Загрузка…</div> : null}
      {error ? (
        <div className="settings-invite-error" style={{ marginTop: 10 }}>
          {error}
        </div>
      ) : null}

      {session && !loading && !error && (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: 12,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 14 }}>{session.title}</div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
              ID: <span style={{ opacity: 0.9 }}>{session.id}</span>
            </div>
            {String(session.comment ?? "").trim() ? (
              <div style={{ marginTop: 8, fontSize: 12, whiteSpace: "pre-wrap", opacity: 0.9 }}>
                {String(session.comment)}
              </div>
            ) : null}
          </div>

          <div
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: 12,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Мой комментарий к сессии</div>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              {commentLoading ? <div style={{ fontSize: 12, opacity: 0.7 }}>Загрузка…</div> : null}
              {commentSaving ? <div style={{ fontSize: 12, opacity: 0.7 }}>Сохранение…</div> : null}
              {!commentSaving && commentMsg ? <div style={{ fontSize: 12, color: "#7ee787" }}>{commentMsg}</div> : null}
              {commentErr ? (
                <div className="settings-invite-error" style={{ margin: 0 }}>
                  {commentErr}
                </div>
              ) : null}
            </div>

            <textarea
              className="settings-invite-input"
              value={comment}
              onChange={(e) => {
                setCommentMsg(null);
                setComment(e.target.value);
              }}
              placeholder="Свои заметки к сессии…"
              rows={6}
              style={{ width: "100%", marginTop: 8, resize: "vertical" }}
            />

            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <Button
                className="primary"
                type="button"
                onClick={async () => {
                  setCommentSaving(true);
                  setCommentMsg(null);
                  setCommentErr(null);
                  try {
                    const res = await upsertMyDirectorSessionComment(accessToken, id, { content: comment });
                    const saved = String(res?.comment?.content ?? "");
                    baselineRef.current = saved;
                    setComment(saved);
                    setCommentMsg("Сохранено");
                  } catch (e: any) {
                    const msg = e?.response?.data?.message ?? "Не удалось сохранить комментарий";
                    setCommentErr(String(msg));
                  } finally {
                    setCommentSaving(false);
                  }
                }}
                disabled={commentSaving}
              >
                Сохранить
              </Button>
              <Button
                className="danger"
                type="button"
                onClick={async () => {
                  setCommentSaving(true);
                  setCommentMsg(null);
                  setCommentErr(null);
                  try {
                    const res = await upsertMyDirectorSessionComment(accessToken, id, { content: "" });
                    baselineRef.current = "";
                    setComment(String(res?.comment?.content ?? ""));
                    setCommentMsg("Очищено");
                  } catch (e: any) {
                    const msg = e?.response?.data?.message ?? "Не удалось очистить комментарий";
                    setCommentErr(String(msg));
                  } finally {
                    setCommentSaving(false);
                  }
                }}
                disabled={commentSaving}
              >
                Очистить
              </Button>
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: 12,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Участники (после публикации)</div>
            {(session.participants ?? []).length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>Пока нет списка участников.</div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {(session.participants ?? []).map((p) => (
                  <div
                    key={p.email}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "6px 8px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(0,0,0,0.10)",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ opacity: 0.95 }}>{p.userName?.trim() || p.email}</div>
                    <div style={{ opacity: 0.7 }}>{p.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

