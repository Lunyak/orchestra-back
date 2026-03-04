import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { Button } from "@shared/core/button/Button";
import { useAuth } from "../../features/auth";
import { getRehearsal, getMyRehearsalComment, upsertMyRehearsalComment, type Rehearsal } from "../../sync/api";

dayjs.locale("ru");

export function RehearsalDetailsPage() {
  const { accessToken } = useAuth();
  const { rehearsalId } = useParams();

  const id = String(rehearsalId ?? "").trim();
  const [rehearsal, setRehearsal] = useState<Rehearsal | null>(null);
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
    getRehearsal(accessToken, id)
      .then((r) => setRehearsal(r))
      .catch((e: any) => {
        const msg = e?.response?.data?.message ?? "Не удалось загрузить репетицию";
        setError(String(msg));
      })
      .finally(() => setLoading(false));
  }, [accessToken, id]);

  useEffect(() => {
    if (!accessToken || !id) return;
    setCommentLoading(true);
    setCommentErr(null);
    getMyRehearsalComment(accessToken, id)
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
    if (!rehearsal?.startsAt) return "";
    const start = dayjs(rehearsal.startsAt);
    const end =
      rehearsal.durationMin != null ? start.add(Math.max(0, rehearsal.durationMin), "minute") : null;
    return `${start.format("D MMMM YYYY, HH:mm")}${end ? `–${end.format("HH:mm")}` : ""}`;
  }, [rehearsal?.durationMin, rehearsal?.startsAt]);

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
        const res = await upsertMyRehearsalComment(accessToken, id, { content: next });
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

  if (!accessToken) return <div>Нужно войти, чтобы открыть репетицию.</div>;
  if (!id) return <div>Некорректный URL репетиции.</div>;

  return (
    <div style={{ padding: "12px 12px 40px" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Link to="/rehearsals" style={{ textDecoration: "none", color: "inherit", opacity: 0.85 }}>
          ← Все репетиции
        </Link>
        <div style={{ fontWeight: 800, fontSize: 16 }}>Репетиция</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>{headerTimeLabel}</div>
      </div>

      {loading ? <div style={{ marginTop: 10, opacity: 0.75 }}>Загрузка…</div> : null}
      {error ? (
        <div className="settings-invite-error" style={{ marginTop: 10 }}>
          {error}
        </div>
      ) : null}

      {rehearsal && !loading && !error && (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: 12,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 14 }}>{rehearsal.title}</div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
              ID: <span style={{ opacity: 0.9 }}>{rehearsal.id}</span>
            </div>
            {String(rehearsal.place ?? "").trim() ? (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                Место: <span style={{ opacity: 1 }}>{String(rehearsal.place)}</span>
              </div>
            ) : null}
            {String(rehearsal.notes ?? "").trim() ? (
              <div style={{ marginTop: 8, fontSize: 12, whiteSpace: "pre-wrap", opacity: 0.9 }}>
                {String(rehearsal.notes)}
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
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Мой комментарий к репетиции</div>
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
              placeholder="Например: что подготовить, вопросы режиссёру, заметки по роли…"
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
                    const res = await upsertMyRehearsalComment(accessToken, id, { content: comment });
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
                    const res = await upsertMyRehearsalComment(accessToken, id, { content: "" });
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
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Участники</div>
            {(rehearsal.participants ?? []).length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>Пока нет участников.</div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {(rehearsal.participants ?? []).map((p) => (
                  <div
                    key={p.id}
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

