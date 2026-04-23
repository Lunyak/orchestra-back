import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { Fragment, useMemo } from "react";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import type { TeamProfile } from "../../sync/api";
import "./TroupeSchedulePreview.css";

dayjs.locale("ru");

function toDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeEmail(v: string): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

const ACTOR_COL_PX = 200;
const DAY_COL_PX = 18;
/** День сессии, пара дней до и календарный месяц после дня сессии */
const DAYS_BEFORE_SESSION = 2;

export type TroupeSchedulePreviewProps = {
  sessionDateKey: string | null;
  profiles: TeamProfile[];
  membersLoading?: boolean;
  /** Если задан — в таблице только эти email; пустой Set — компонент не рендерится. */
  participantEmailSet?: Set<string> | undefined;
};

export function TroupeSchedulePreview({
  sessionDateKey,
  profiles,
  membersLoading,
  participantEmailSet,
}: TroupeSchedulePreviewProps) {
  const scheduleDays = useMemo(() => {
    if (!sessionDateKey) return [];
    const anchor = dayjs(sessionDateKey, "YYYY-MM-DD", true);
    if (!anchor.isValid()) return [];
    const start = anchor.subtract(DAYS_BEFORE_SESSION, "day");
    const end = anchor.add(1, "month");
    const out: Date[] = [];
    for (let d = start; !d.isAfter(end, "day"); d = d.add(1, "day")) {
      out.push(d.toDate());
    }
    return out;
  }, [sessionDateKey]);

  const gridTemplateColumns = useMemo(
    () =>
      `${ACTOR_COL_PX}px repeat(${scheduleDays.length}, ${DAY_COL_PX}px)`,
    [scheduleDays.length],
  );

  const actorsSorted = useMemo(() => {
    const list = [...(profiles ?? [])];
    const filtered =
      participantEmailSet != null
        ? list.filter((p) =>
            participantEmailSet.has(normalizeEmail(String(p.email ?? ""))),
          )
        : list;
    filtered.sort((a, b) => {
      const na = String((a as any)?.displayName ?? (a as any)?.email ?? "")
        .trim()
        .toLowerCase();
      const nb = String((b as any)?.displayName ?? (b as any)?.email ?? "")
        .trim()
        .toLowerCase();
      return na.localeCompare(nb, "ru");
    });
    return filtered;
  }, [participantEmailSet, profiles]);

  const noParticipantsForFilteredChart =
    participantEmailSet != null && participantEmailSet.size === 0;

  if (noParticipantsForFilteredChart) {
    return null;
  }

  const gridMinWidth = ACTOR_COL_PX + scheduleDays.length * DAY_COL_PX;

  return (
    <div className="rehearsals-section troupe-schedule-preview troupe-schedule-preview--session-window">
      {!sessionDateKey ? (
        <div className="rehearsals-muted troupe-schedule-preview__muted">
          Нет даты сессии для календаря.
        </div>
      ) : scheduleDays.length === 0 ? (
        <div className="rehearsals-muted troupe-schedule-preview__muted">
          Некорректная дата сессии для календаря.
        </div>
      ) : (
        <>
          {membersLoading ? (
            <div className="rehearsals-muted troupe-schedule-preview__loading">
              Загружаю участников…
            </div>
          ) : null}

          <div
            className="troupe-schedule"
            role="region"
            aria-label="График занятости актёров проекта"
          >
            <div
              className="troupe-grid"
              style={{
                gridTemplateColumns,
                minWidth: gridMinWidth,
              }}
            >
              <div className="troupe-cell troupe-sticky troupe-header-cell" />
              {scheduleDays.map((d) => {
                const dayKey = toDateKey(d);
                const isFocus = dayKey === sessionDateKey;
                const n = d.toLocaleDateString("ru-RU", { day: "numeric" });
                const wd = d.toLocaleDateString("ru-RU", { weekday: "short" });
                return (
                  <div
                    key={dayKey}
                    className={cn(
                      "troupe-cell troupe-header-cell",
                      isFocus && "focus",
                    )}
                    title={dayKey}
                  >
                    <div className="troupe-header-day-num">{n}</div>
                    <div className="troupe-header-day-wd">{wd}</div>
                  </div>
                );
              })}

              {actorsSorted.length === 0 && !membersLoading ? (
                <div
                  className="troupe-cell troupe-empty"
                  style={{
                    gridColumn: `1 / span ${scheduleDays.length + 1}`,
                  }}
                >
                  {participantEmailSet != null
                    ? "Нет участников для графика по ролям слота (назначения в проекте)."
                    : "Нет данных по участникам проекта (или нет профилей)."}
                </div>
              ) : (
                actorsSorted.slice(0, 200).map((prof) => {
                  const email = String(prof.email ?? "").trim();
                  const displayName = String(prof.displayName ?? "").trim();
                  const actorTitle =
                    displayName || "Без имени";
                  const cal = prof.availabilityCalendar ?? {};
                  const rangesByDay = prof.availabilityTimeRanges ?? {};
                  return (
                    <Fragment key={email || actorTitle}>
                      <div
                        className="troupe-cell troupe-sticky troupe-actor-cell"
                        title={actorTitle}
                      >
                        <div className="troupe-actor-row">
                          <MiniAvatar
                            src={String(prof.avatarUrl ?? "").trim() || null}
                            label={actorTitle}
                            size={18}
                          />
                          <div className="troupe-actor-text">
                            <div
                              className="troupe-actor-name"
                              title={actorTitle}
                            >
                              {actorTitle}
                            </div>
                          </div>
                        </div>
                      </div>
                      {scheduleDays.map((d) => {
                        const dayKey = toDateKey(d);
                        const ranges = rangesByDay[dayKey] ?? [];
                        const st =
                          cal?.[dayKey] === "present"
                            ? "present"
                            : cal?.[dayKey] === "absent"
                              ? "absent"
                              : "unknown";
                        const cls =
                          st === "absent"
                            ? "busy"
                            : Array.isArray(ranges) && ranges.length > 0
                              ? "partial"
                              : st === "present"
                                ? "free"
                                : "unknown";
                        const tooltip =
                          st === "absent"
                            ? "Занят"
                            : Array.isArray(ranges) && ranges.length > 0
                              ? `Свободен: ${ranges
                                  .map(
                                    (r: { from?: string; to?: string }) =>
                                      `${String(r?.from ?? "")}–${String(r?.to ?? "")}`,
                                  )
                                  .join(", ")}`
                              : st === "present"
                                ? "Свободен"
                                : "Не отмечено";
                        const isFocus = dayKey === sessionDateKey;
                        return (
                          <div
                            key={`${email}:${dayKey}`}
                            className={cn(
                              "troupe-cell troupe-day-cell",
                              cls,
                              isFocus && "focus",
                            )}
                            title={`${dayKey} · ${tooltip}`}
                          />
                        );
                      })}
                    </Fragment>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
