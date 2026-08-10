import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { Button } from "@shared/core/button/Button";
import { useAuth } from "../../auth";
import { useProject } from "../../project";
import { projectSessionPath } from "../../../app/router/paths";
import {
  getRehearsal,
  getMyRehearsalComment,
  upsertMyRehearsalComment,
  type Rehearsal,
} from "../../../sync/api/rehearsals";
import "./rehearsal-details-page.css";

dayjs.locale("ru");

export function RehearsalDetailsPage() {
  const { accessToken } = useAuth();
  const { projectName } = useProject();
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
        const msg = e?.response?.data?.message ?? "Не удалось загрузить сессию";
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

  if (!accessToken) {
    return <div className="rehearsal-details-page__message">Нужно войти, чтобы открыть сессию.</div>;
  }
  if (!id) {
    return <div className="rehearsal-details-page__message">Некорректный URL.</div>;
  }

  return (
    <div className="rehearsal-details-page">
      <div className="rehearsal-details-page__header">
        <Link
          to={projectSessionPath(projectName)}
          className="rehearsal-details-page__back-link"
        >
          ← Все сессии
        </Link>
        <div className="rehearsal-details-page__title">Сессия</div>
        <div className="rehearsal-details-page__meta">{headerTimeLabel}</div>
      </div>

      {loading ? <div className="rehearsal-details-page__loading">Загрузка…</div> : null}
      {error ? (
        <div className="settings-invite-error rehearsal-details-page__error">
          {error}
        </div>
      ) : null}

      {rehearsal && !loading && !error && (
        <div className="rehearsal-details-page__content">
          <div className="rehearsal-details-page__card">
            <div className="rehearsal-details-page__card-title">{rehearsal.title}</div>
            <div className="rehearsal-details-page__id-line">
              ID: <span className="rehearsal-details-page__id-value">{rehearsal.id}</span>
            </div>
            {String(rehearsal.place ?? "").trim() ? (
              <div className="rehearsal-details-page__place-line">
                Место:{" "}
                <span className="rehearsal-details-page__place-value">
                  {String(rehearsal.place)}
                </span>
              </div>
            ) : null}
            {String(rehearsal.notes ?? "").trim() ? (
              <div className="rehearsal-details-page__notes">{String(rehearsal.notes)}</div>
            ) : null}
          </div>

          <div className="rehearsal-details-page__card">
            <div
              className={cn(
                "rehearsal-details-page__card-title",
                "rehearsal-details-page__card-title--section",
              )}
            >
              Мой комментарий к сессии
            </div>
            <div className="rehearsal-details-page__comment-status">
              {commentLoading ? (
                <div className="rehearsal-details-page__status-hint">Загрузка…</div>
              ) : null}
              {commentSaving ? (
                <div className="rehearsal-details-page__status-hint">Сохранение…</div>
              ) : null}
              {!commentSaving && commentMsg ? (
                <div className="rehearsal-details-page__status-success">{commentMsg}</div>
              ) : null}
              {commentErr ? (
                <div className="settings-invite-error rehearsal-details-page__comment-error">
                  {commentErr}
                </div>
              ) : null}
            </div>

            <textarea
              className={cn(
                "settings-invite-input",
                "rehearsal-details-page__comment-input",
              )}
              value={comment}
              onChange={(e) => {
                setCommentMsg(null);
                setComment(e.target.value);
              }}
              placeholder="Например: что подготовить, вопросы режиссёру, заметки по роли…"
              rows={6}
            />

            <div className="rehearsal-details-page__comment-actions">
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

          <div className="rehearsal-details-page__card">
            <div
              className={cn(
                "rehearsal-details-page__card-title",
                "rehearsal-details-page__card-title--section",
              )}
            >
              Участники
            </div>
            {(rehearsal.participants ?? []).length === 0 ? (
              <div className="rehearsal-details-page__participants-empty">
                Пока нет участников.
              </div>
            ) : (
              <div className="rehearsal-details-page__participants-list">
                {(rehearsal.participants ?? []).map((p) => (
                  <div key={p.id} className="rehearsal-details-page__participant-row">
                    <div className="rehearsal-details-page__participant-name">
                      {p.userName?.trim() || p.email}
                    </div>
                    <div className="rehearsal-details-page__participant-status">{p.status}</div>
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
