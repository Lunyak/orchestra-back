import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { Button } from "@shared/core/button/Button";
import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { calledStatusToGatherMark } from "../director-sessions/model/session-page-utils";
import { compareActorArrivalEmails } from "../director-sessions/model/session-actor-call-times";
import {
  type DirectorSessionSlot,
} from "../director-sessions/directorSessionsSync";
import {
  type DirectorSessionParticipant,
  type DirectorSessionParticipantStatus,
} from "../../sync/api/director-sessions";
import type { TeamProfile } from "../../sync/api/profile";
import { MiniAvatar } from "../../shared/core/mini-avatar/MiniAvatar";
import { normalizeEmail } from "../director-sessions/model/session-page-utils";
import { useDirectorSessionDetail } from "./useDirectorSessionDetail";
import { useProject } from "../project";
import { projectSessionPath } from "../../app/router/paths";

import "../rehearsals/ui/rehearsals.css";
import "./director-session-detail.css";

dayjs.locale("ru");

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
  const { projectName } = useProject();

  const {
    session,
    loading,
    error,
    sceneTitleBySlugAndId,
    actorArrivalByEmail,
    resolvedProfiles,
    myEmail,
    attendanceBusy,
    attendanceErr,
    attendanceOk,
    onConfirmAttendance,
    onDeclineAttendance,
  } = useDirectorSessionDetail(accessToken, id);

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
    const emails = Array.from(uniq).sort((a, b) =>
      compareActorArrivalEmails(a, b, actorArrivalByEmail),
    );
    if (emails.length > 0) {
      return emails.map((email) => {
        const p = participantByEmail[email];
        const disp = calledPersonDisplay(email, p, profileByEmail[email]);
        const rowStatus = callConfirmationLabel(p, published);
        const respondedShort = formatRespondedShort(p?.respondedAt);
        const callTimeLabel =
          actorArrivalByEmail.get(email)?.timeLabel ??
          (typeof p?.callTime === "string" && p.callTime.trim() ? p.callTime.trim() : null);
        return { key: email, ...disp, ...rowStatus, respondedShort, callTimeLabel };
      });
    }
    const parts = [...(session?.participants ?? [])] as DirectorSessionParticipant[];
    parts.sort((a, b) => {
      const emailA = normalizeEmail(String(a.email));
      const emailB = normalizeEmail(String(b.email));
      const byArrival = compareActorArrivalEmails(emailA, emailB, actorArrivalByEmail);
      if (byArrival !== 0) return byArrival;
      return calledPersonDisplay(emailA, a, profileByEmail[emailA]).name.localeCompare(
        calledPersonDisplay(emailB, b, profileByEmail[emailB]).name,
        "ru",
      );
    });
    return parts.map((p) => {
      const email = normalizeEmail(String(p.email));
      const disp = calledPersonDisplay(String(p.email), p, profileByEmail[email]);
      const rowStatus = callConfirmationLabel(p, published);
      const respondedShort = formatRespondedShort(p.respondedAt);
      const callTimeLabel =
        actorArrivalByEmail.get(email)?.timeLabel ??
        (typeof p.callTime === "string" && p.callTime.trim() ? p.callTime.trim() : null);
      return { key: email || disp.name, ...disp, ...rowStatus, respondedShort, callTimeLabel };
    });
  }, [
    session?.plannedEmails,
    session?.participants,
    session?.publishedAt,
    participantByEmail,
    profileByEmail,
    actorArrivalByEmail,
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
    const planned = (session.plannedEmails ?? []).map((email: string) => normalizeEmail(String(email)));
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

  return (
    <div className={rootClass}>
      <div className="rehearsals-head">
        <div className="director-session-page__subhead">
          {!onClose ? (
            <Link
              to={`${projectSessionPath(projectName)}?sessionId=${encodeURIComponent(id)}`}
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
        <PageLoader variant="view" label="Загрузка…" />
      ) : null}
      {error ? (
        <div className="settings-invite-error rehearsals-muted--top">
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
                            <div className="settings-invite-error settings-invite-error--flush">
                              {attendanceErr}
                            </div>
                          ) : null}
                          {attendanceOk ? (
                            <p className="director-session-page__attendance-note director-session-page__attendance-note--success">
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
                    {calledList.map((row) => {
                      const statusParts = [row.statusLabel.trim()];
                      if (row.respondedShort) statusParts.push(row.respondedShort);
                      const statusHint = statusParts.filter(Boolean).join(" · ");
                      const markStatus = calledStatusToGatherMark(row.statusTone);

                      return (
                        <li
                          key={row.key}
                          className="director-session-page__called-item"
                          title={statusHint || undefined}
                        >
                          <MiniAvatar
                            src={row.avatarUrl}
                            label={row.avatarLabel}
                            title={row.email}
                            size={22}
                          />
                          <span
                            className={cn(
                              "sessions-slot-gather-mark",
                              `sessions-slot-gather-mark--${markStatus}`,
                            )}
                            title={statusHint || undefined}
                            aria-label={statusHint || undefined}
                          />
                          <span className="director-session-page__called-name" title={row.email}>
                            {row.callTimeLabel ? (
                              <span className="director-session-page__called-time">
                                {row.callTimeLabel}
                              </span>
                            ) : null}
                            {row.name}
                          </span>
                        </li>
                      );
                    })}
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
              <div className="rehearsals-muted rehearsals-muted--tight-top">
                В этой сессии пока нет слотов.
              </div>
            ) : (
              <div className="director-session-page__slots">
                {slotsSorted.map((sl: DirectorSessionSlot) => {
                  const refLabel = sl.ref
                    ? (() => {
                        const slug = sl.ref.projectSlug;
                        const title =
                          sceneTitleBySlugAndId[slug]?.[sl.ref.sceneId]?.trim() ?? "";
                        const sceneLabel = title || `сцена #${sl.ref.sceneId}`;
                        return `${slug} - ${sceneLabel}`;
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
                        to={projectSessionPath(projectName, session.id, sl.id)}
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
