import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  type DirectorRehearsalSession,
  type DirectorSessionSlot,
} from "../director-sessions/directorSessionsSync";
import {
  confirmMyDirectorSessionAttendance,
  declineMyDirectorSessionAttendance,
  getDirectorSession,
  type DirectorSessionParticipant,
  type DirectorSessionParticipantStatus,
} from "../../sync/api/director-sessions";
import { syncPull } from "../../sync/api/entity-sync";
import type { SyncPullResponse } from "../../sync/api/types/sync";
import { getMyProfile, getProfilesBatch, type TeamProfile } from "../../sync/api/profile";
import type { ScriptStep } from "../../shared/types/script";
import { MiniAvatar } from "../../shared/core/mini-avatar/MiniAvatar";
import { Button } from "@shared/core/button/Button";

import "../../pages/rehearsals/style.css";
import "./director-session-detail.css";

dayjs.locale("ru");

function parseStepsFromPull(
  pull: SyncPullResponse,
  projectSlug: string,
): { steps: ScriptStep[]; sceneId: string | null } {
  const proj = (pull.projects ?? []).find((p: any) => p.slug === projectSlug);
  const scene =
    proj ? (pull.scenes ?? []).find((s: any) => String(s?.id ?? "") === `${proj.id}:script`) : null;
  const sceneId = String(scene?.id ?? "") || null;
  const steps = (Array.isArray((pull as any)?.steps) ? (pull as any).steps : [])
    .filter((st: any) => (sceneId ? String(st?.sceneId ?? "") === sceneId : true))
    .sort((a: any, b: any) => Number(a?.order ?? 0) - Number(b?.order ?? 0))
    .map((st: any) => ({
      id: Number(st?.sourceId ?? 0),
      title: String(st?.title ?? ""),
      markdown: String(st?.markdown ?? ""),
      playMarkdown: st?.playMarkdown ?? undefined,
      explicationMarkdown: st?.explicationMarkdown ?? undefined,
      durationMin: st?.durationMin ?? undefined,
      kanbanStatus: st?.kanbanStatus ?? undefined,
      kanbanOrder: st?.kanbanOrder ?? undefined,
    }))
    .filter((x: any) => Number.isFinite(x.id) && x.id > 0);
  return { steps, sceneId };
}

function getSessionStartLocalMinutes(startsAtIso: string): number {
  const d = new Date(startsAtIso);
  if (!Number.isFinite(d.getTime())) return 0;
  return d.getHours() * 60 + d.getMinutes();
}

function formatTimeHHMM(totalMin: number): string {
  const m = ((Math.floor(totalMin) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatSlotTime(startsAtIso: string, offsetMin: number): string {
  const base = getSessionStartLocalMinutes(startsAtIso);
  return formatTimeHHMM(base + Math.max(0, Math.floor(offsetMin)));
}

function normalizeEmail(v: string): string {
  return String(v ?? "").trim().toLowerCase();
}

type CallRowStatus = {
  statusLabel: string;
  statusTone: "muted" | "ok" | "warn" | "bad" | "confirmed";
};

function callConfirmationLabel(
  participant: DirectorSessionParticipant | undefined,
  sessionPublished: boolean,
): CallRowStatus {
  if (!sessionPublished) {
    return { statusLabel: "До публикации сессии", statusTone: "muted" };
  }
  if (!participant) {
    return {
      statusLabel:
        "В плане режиссёра, но не в списке участников после публикации (часто в этот день не было «Свободен» в профиле)",
      statusTone: "muted",
    };
  }
  const st = participant.status as DirectorSessionParticipantStatus;
  if (st === "present") {
    return { statusLabel: "Вызов подтверждён", statusTone: "confirmed" };
  }
  if (st === "absent") {
    return { statusLabel: "Отметил «не приду»", statusTone: "bad" };
  }
  if (st === "late") {
    return { statusLabel: "Опоздает", statusTone: "warn" };
  }
  return { statusLabel: "Вызов не подтверждён", statusTone: "warn" };
}

function formatRespondedShort(iso: string | null | undefined): string | null {
  const s = String(iso ?? "").trim();
  if (!s) return null;
  const d = dayjs(s);
  if (!d.isValid()) return null;
  return d.format("D MMM, HH:mm");
}

function calledPersonDisplay(
  emailRaw: string,
  participant: DirectorSessionParticipant | undefined,
  profile: TeamProfile | undefined,
): { email: string; name: string; avatarUrl: string | null; avatarLabel: string } {
  const email = normalizeEmail(emailRaw) || String(emailRaw).trim();
  const fn = String(participant?.firstName ?? profile?.firstName ?? "").trim();
  const ln = String(participant?.lastName ?? profile?.lastName ?? "").trim();
  const byParts = [fn, ln].filter(Boolean).join(" ").trim();
  const displayName = String(profile?.displayName ?? "").trim();
  const userName = String(participant?.userName ?? "").trim();
  const name = byParts || displayName || userName || email;
  const avatarUrl =
    String(participant?.avatarUrl ?? profile?.avatarUrl ?? "").trim() || null;
  const avatarLabel = byParts || displayName || userName || email;
  return { email, name, avatarUrl, avatarLabel };
}

export type DirectorSessionDetailPanelProps = {
  accessToken: string;
  sessionId: string;
  /** Если задано (модалка) — без ссылки «к списку», только дата/время. */
  onClose?: () => void;
};

export function DirectorSessionDetailPanel({
  accessToken,
  sessionId,
  onClose,
}: DirectorSessionDetailPanelProps) {
  const id = String(sessionId ?? "").trim();

  const [session, setSession] = useState<DirectorRehearsalSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepTitleBySlugAndId, setStepTitleBySlugAndId] = useState<
    Record<string, Record<number, string>>
  >({});
  const [resolvedProfiles, setResolvedProfiles] = useState<TeamProfile[]>([]);
  const [myEmail, setMyEmail] = useState<string | null>(null);
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [attendanceErr, setAttendanceErr] = useState<string | null>(null);
  const [attendanceOk, setAttendanceOk] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setMyEmail(null);
      return;
    }
    let cancelled = false;
    getMyProfile(accessToken)
      .then((p) => {
        if (!cancelled) setMyEmail(normalizeEmail(String(p?.email ?? "")));
      })
      .catch(() => {
        if (!cancelled) setMyEmail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const slotRefsKey = useMemo(() => {
    const parts =
      session?.slots
        ?.map((s) => (s.ref ? `${s.ref.projectSlug}:${s.ref.stepId}` : ""))
        .filter(Boolean)
        .sort() ?? [];
    return parts.join("|");
  }, [session?.slots]);

  useEffect(() => {
    setAttendanceErr(null);
    setAttendanceOk(null);
  }, [id]);

  useEffect(() => {
    if (!accessToken || !id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDirectorSession(accessToken, id)
      .then((data) => {
        if (cancelled) return;
        setSession(data as DirectorRehearsalSession);
      })
      .catch((e: any) => {
        if (cancelled) return;
        const status = e?.response?.status;
        setError(
          status === 404
            ? "Сессия не найдена"
            : (e?.response?.data?.message ?? e?.message ?? "Не удалось загрузить сессию"),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, id]);

  const sessionEmailsKey = useMemo(() => {
    const u = new Set<string>();
    for (const e of session?.plannedEmails ?? []) {
      const v = normalizeEmail(String(e));
      if (v) u.add(v);
    }
    for (const p of session?.participants ?? []) {
      const v = normalizeEmail(String(p.email));
      if (v) u.add(v);
    }
    return Array.from(u).sort().join("|");
  }, [session?.plannedEmails, session?.participants]);

  useEffect(() => {
    if (!accessToken || !sessionEmailsKey) {
      setResolvedProfiles([]);
      return;
    }
    const emails = sessionEmailsKey.split("|").filter(Boolean);
    let cancelled = false;
    getProfilesBatch(accessToken, emails)
      .then((list) => {
        if (!cancelled) setResolvedProfiles(list ?? []);
      })
      .catch(() => {
        if (!cancelled) setResolvedProfiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, sessionEmailsKey]);

  useEffect(() => {
    if (!accessToken || !slotRefsKey) {
      setStepTitleBySlugAndId({});
      return;
    }
    const slugs = Array.from(
      new Set(
        slotRefsKey
          .split("|")
          .map((seg) => String(seg.split(":")[0] ?? "").trim())
          .filter(Boolean),
      ),
    );
    if (slugs.length === 0) {
      setStepTitleBySlugAndId({});
      return;
    }
    let cancelled = false;
    (async () => {
      const merged: Record<string, Record<number, string>> = {};
      await Promise.all(
        slugs.map(async (slug) => {
          try {
            const pull = await syncPull(accessToken, null, slug, { steps: true });
            if (cancelled) return;
            const { steps } = parseStepsFromPull(pull, slug);
            const byId: Record<number, string> = {};
            for (const st of steps) {
              const t = String(st.title ?? "").trim();
              if (t) byId[st.id] = t;
            }
            merged[slug] = byId;
          } catch {
            if (!cancelled) merged[slug] = {};
          }
        }),
      );
      if (!cancelled) setStepTitleBySlugAndId(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, slotRefsKey]);

  const headerTimeLabel = useMemo(() => {
    if (!session?.startsAt) return "";
    const start = dayjs(session.startsAt);
    return start.format("D MMMM YYYY, HH:mm");
  }, [session?.startsAt]);

  const slotsSorted = useMemo(() => {
    const list = [...(session?.slots ?? [])];
    list.sort((a, b) => (a.offsetMin ?? 0) - (b.offsetMin ?? 0));
    return list;
  }, [session?.slots]);

  const profileByEmail = useMemo(() => {
    const m: Record<string, TeamProfile> = {};
    for (const p of resolvedProfiles) {
      const k = normalizeEmail(p.email);
      if (k) m[k] = p;
    }
    return m;
  }, [resolvedProfiles]);

  const participantByEmail = useMemo(() => {
    const m: Record<string, DirectorSessionParticipant> = {};
    for (const p of session?.participants ?? [] as DirectorSessionParticipant[]) {
      const k = normalizeEmail(String(p.email));
      if (k) m[k] = p;
    }
    return m;
  }, [session?.participants]);

  const calledList = useMemo(() => {
    const published = Boolean(String(session?.publishedAt ?? "").trim());
    const raw = session?.plannedEmails ?? [];
    const uniq = new Set<string>();
    for (const e of raw) {
      const v = normalizeEmail(String(e));
      if (v) uniq.add(v);
    }
    const emails = Array.from(uniq).sort((a, b) => a.localeCompare(b, "ru"));
    if (emails.length > 0) {
      return emails.map((email) => {
        const p = participantByEmail[email];
        const disp = calledPersonDisplay(email, p, profileByEmail[email]);
        const rowStatus = callConfirmationLabel(p, published);
        const respondedShort = formatRespondedShort(p?.respondedAt);
        return { key: email, ...disp, ...rowStatus, respondedShort };
      });
    }
    const parts = [...(session?.participants ?? [])] as DirectorSessionParticipant[];
    const sortKey = (p: DirectorSessionParticipant) =>
      calledPersonDisplay(String(p.email), p, profileByEmail[normalizeEmail(String(p.email))])
        .name.toLowerCase();
    parts.sort((a, b) => sortKey(a).localeCompare(sortKey(b), "ru"));
    return parts.map((p) => {
      const email = normalizeEmail(String(p.email));
      const disp = calledPersonDisplay(String(p.email), p, profileByEmail[email]);
      const rowStatus = callConfirmationLabel(p, published);
      const respondedShort = formatRespondedShort(p.respondedAt);
      return { key: email || disp.name, ...disp, ...rowStatus, respondedShort };
    });
  }, [
    session?.plannedEmails,
    session?.participants,
    session?.publishedAt,
    participantByEmail,
    profileByEmail,
  ]);

  const myParticipant = useMemo(() => {
    if (!myEmail || !session?.participants?.length) return null;
    return (
      (session.participants as DirectorSessionParticipant[]).find(
        (p) => normalizeEmail(String(p.email ?? "")) === myEmail,
      ) ?? null
    );
  }, [myEmail, session?.participants]);

  const inPlannedOnly = useMemo(() => {
    if (!myEmail || !session?.plannedEmails?.length) return false;
    const planned = (session.plannedEmails ?? []).map((e) => normalizeEmail(String(e)));
    if (!planned.includes(myEmail)) return false;
    return !myParticipant;
  }, [myEmail, session?.plannedEmails, myParticipant]);

  const sessionPublished = Boolean(String(session?.publishedAt ?? "").trim());

  if (!id) {
    return <div className="rehearsals-muted">Некорректный id сессии.</div>;
  }

  const rootClass = onClose
    ? "director-session-detail-root--modal rehearsals-page"
    : "rehearsals-page sessions-page";

  const onConfirmAttendance = async () => {
    if (!accessToken || !id) return;
    setAttendanceBusy(true);
    setAttendanceErr(null);
    setAttendanceOk(null);
    try {
      const res = await confirmMyDirectorSessionAttendance(accessToken, id);
      if (res?.session) setSession(res.session as DirectorRehearsalSession);
      setAttendanceOk("Вызов подтверждён");
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        e?.message ??
        "Не удалось подтвердить вызов";
      setAttendanceErr(String(msg));
    } finally {
      setAttendanceBusy(false);
    }
  };

  const onDeclineAttendance = async () => {
    if (!accessToken || !id) return;
    const ok = window.confirm(
      "Отметить «не приду»? Режиссёр увидит, что вы не сможете прийти на эту сессию.",
    );
    if (!ok) return;
    setAttendanceBusy(true);
    setAttendanceErr(null);
    setAttendanceOk(null);
    try {
      const res = await declineMyDirectorSessionAttendance(accessToken, id);
      if (res?.session) setSession(res.session as DirectorRehearsalSession);
      setAttendanceOk("Ответ сохранён: не приду");
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        e?.message ??
        "Не удалось сохранить ответ";
      setAttendanceErr(String(msg));
    } finally {
      setAttendanceBusy(false);
    }
  };

  return (
    <div className={rootClass}>
      <div className="rehearsals-head">
        <div className="director-session-page__subhead">
          {!onClose ? (
            <Link
              to={`/sessions?sessionId=${encodeURIComponent(id)}`}
              title="К списку сессий"
            >
              ← К списку
            </Link>
          ) : null}
          {headerTimeLabel ? (
            <span className="rehearsals-muted">{headerTimeLabel}</span>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="rehearsals-muted" style={{ marginTop: 10 }}>
          Загрузка…
        </div>
      ) : null}
      {error ? (
        <div className="settings-invite-error" style={{ marginTop: 10 }}>
          {error}
        </div>
      ) : null}

      {session && !loading && !error && (
        <div className="director-session-page__body">
          <div className="director-session-page__card">
            <div className="rehearsals-section director-session-page__invite">
              <div className="director-session-page__attendance">
                {myParticipant || inPlannedOnly ? (
                  <>
                    <div className="director-session-page__attendance-title">Мой ответ на вызов</div>
                    {myParticipant ? (
                      !sessionPublished ? (
                        <p className="director-session-page__attendance-note">
                          Подтвердить или отклонить вызов можно после публикации сессии режиссёром.
                        </p>
                      ) : (
                        <>
                          {attendanceErr ? (
                            <div className="settings-invite-error" style={{ margin: 0 }}>
                              {attendanceErr}
                            </div>
                          ) : null}
                          {attendanceOk ? (
                            <p className="director-session-page__attendance-note" style={{ color: "var(--color-status-success-bright)" }}>
                              {attendanceOk}
                            </p>
                          ) : null}
                          {myParticipant.status === "present" ? (
                            <>
                              <p className="director-session-page__attendance-note">
                                Вы подтвердили вызов (в системе отмечено «приду»). Режиссёр видит это в списке ниже.
                              </p>
                              <div className="director-session-page__attendance-actions">
                                <Button
                                  variant="danger"
                                  type="button"
                                  disabled={attendanceBusy}
                                  onClick={() => void onDeclineAttendance()}
                                >
                                  {attendanceBusy ? "Отправка…" : "Не смогу прийти"}
                                </Button>
                              </div>
                            </>
                          ) : myParticipant.status === "absent" ? (
                            <>
                              <p className="director-session-page__attendance-note">
                                Вы отметили, что не придёте. Режиссёр видит это в списке ниже. Если планы
                                изменились, можно снова подтвердить вызов.
                              </p>
                              <div className="director-session-page__attendance-actions">
                                <Button
                                  className="primary"
                                  type="button"
                                  disabled={attendanceBusy}
                                  onClick={() => void onConfirmAttendance()}
                                >
                                  {attendanceBusy ? "Отправка…" : "Подтвердить вызов"}
                                </Button>
                              </div>
                            </>
                          ) : myParticipant.status === "late" ? (
                            <>
                              <p className="director-session-page__attendance-note">
                                По вызову у вас отмечено опоздание. При необходимости обновите ответ: подтвердите
                                приход или отметьте, что не придёте.
                              </p>
                              <div className="director-session-page__attendance-actions">
                                <Button
                                  className="primary"
                                  type="button"
                                  disabled={attendanceBusy}
                                  onClick={() => void onConfirmAttendance()}
                                >
                                  {attendanceBusy ? "Отправка…" : "Подтвердить приход"}
                                </Button>
                                <Button
                                  variant="danger"
                                  type="button"
                                  disabled={attendanceBusy}
                                  onClick={() => void onDeclineAttendance()}
                                >
                                  Не смогу прийти
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="director-session-page__attendance-note">
                                Подтвердите вызов или отметьте, что не сможете прийти — режиссёр увидит ответ в
                                списке ниже.
                              </p>
                              <div className="director-session-page__attendance-actions">
                                <Button
                                  className="primary"
                                  type="button"
                                  disabled={attendanceBusy}
                                  onClick={() => void onConfirmAttendance()}
                                >
                                  {attendanceBusy ? "Отправка…" : "Подтвердить вызов"}
                                </Button>
                                <Button
                                  variant="danger"
                                  type="button"
                                  disabled={attendanceBusy}
                                  onClick={() => void onDeclineAttendance()}
                                >
                                  Не смогу прийти
                                </Button>
                              </div>
                            </>
                          )}
                        </>
                      )
                    ) : inPlannedOnly ? (
                      sessionPublished ? (
                        <p className="director-session-page__attendance-note">
                          Сессия уже опубликована, но вас нет среди участников (обычно в календаре занятости на
                          дату сессии не было «Свободен» в момент публикации). Отметьте день как «Свободен» и
                          попросите режиссёра ещё раз нажать «Опубликовать» — тогда появится кнопка «Подтвердить
                          вызов».
                        </p>
                      ) : (
                        <p className="director-session-page__attendance-note">
                          Вы в плане вызова; кнопка «Подтвердить вызов» появится после публикации сессии, когда вы
                          попадёте в список участников.
                        </p>
                      )
                    ) : null}
                  </>
                ) : null}
              </div>

              {calledList.length > 0 ? (
                <div className="director-session-page__called-scroll">
                  <ul className="director-session-page__called-list">
                    {calledList.map((row) => (
                      <li
                        key={row.key}
                        className={
                          row.statusTone === "confirmed"
                            ? "director-session-page__called-item director-session-page__called-item--confirmed"
                            : "director-session-page__called-item"
                        }
                      >
                        <MiniAvatar
                          src={row.avatarUrl}
                          label={row.avatarLabel}
                          title={row.email}
                          size={22}
                        />
                        <div className="director-session-page__called-item-main">
                          <span className="director-session-page__called-name" title={row.email}>
                            {row.name}
                          </span>
                          <span
                            className={`director-session-page__called-status director-session-page__called-status--${row.statusTone}`}
                          >
                            {row.statusLabel}
                            {row.respondedShort ? ` · ${row.respondedShort}` : ""}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rehearsals-muted director-session-page__invite-empty">
                  Пока никого: выберите материалы в слотах — список соберётся по назначенным на роли
                  актёрам из труппы.
                </div>
              )}
            </div>

            {(slotsSorted ?? []).length === 0 ? (
              <div className="rehearsals-muted" style={{ marginTop: 6 }}>
                В этой сессии пока нет слотов.
              </div>
            ) : (
              <div className="director-session-page__slots">
                {slotsSorted.map((sl: DirectorSessionSlot) => {
                  const refLabel = sl.ref
                    ? (() => {
                        const slug = sl.ref.projectSlug;
                        const title =
                          stepTitleBySlugAndId[slug]?.[sl.ref.stepId]?.trim() ?? "";
                        const stepLabel = title || `шаг #${sl.ref.stepId}`;
                        return `${slug} - ${stepLabel}`;
                      })()
                    : "Материал не выбран";
                  return (
                    <div key={sl.id} className="director-session-page__slot">
                      <div className="director-session-page__slot-main">
                        <div className="director-session-page__slot-time">
                          {formatSlotTime(session.startsAt, sl.offsetMin)} ·{" "}
                          {sl.durationMin} мин
                        </div>
                        <div
                          className="director-session-page__slot-ref"
                          title={refLabel}
                        >
                          {refLabel}
                        </div>
                        {String(sl.notes ?? "").trim() ? (
                          <div
                            className="director-session-page__slot-notes"
                            title={String(sl.notes).trim()}
                          >
                            {String(sl.notes).trim()}
                          </div>
                        ) : null}
                      </div>
                      <Link
                        className="director-session-page__slot-link"
                        to={`/sessions/${encodeURIComponent(session.id)}/slots/${encodeURIComponent(sl.id)}`}
                        title="Открыть слот и выбрать материал"
                      >
                        Открыть слот
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
