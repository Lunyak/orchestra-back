import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { Fragment, useMemo } from "react";
import { useAuth } from "../../auth/model/auth-context";
import {
  getAvailabilityDayVisual,
  mergeSelfIntoProfiles,
  sortMineFirst,
} from "../../profile/model/availability-calendar";
import { selectMyProfile } from "../../profile/model/profileDataSlice";
import { useScheduleAvailability } from "../../profile/model/useScheduleAvailability";
import { useAppSelector } from "../../../shared/store/hooks";
import { AvailabilityDayModal } from "../../profile/ui/AvailabilityDayModal";
import { MiniAvatar } from "../../../shared/components/mini-avatar/MiniAvatar";
import type { TeamProfile } from "../../../sync/api/profile";
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

function actorSortName(profile: TeamProfile): string {
  return String(profile.displayName ?? profile.email ?? "")
    .trim()
    .toLowerCase();
}

const ACTOR_COL_PX = 200;
const DAY_COL_PX = 18;
const ACTOR_COL_VAR = `var(--troupe-schedule-actor-col, ${ACTOR_COL_PX}px)`;
/** День сессии, пара дней до и календарный месяц после дня сессии */
const DAYS_BEFORE_SESSION = 2;

export type TroupeSchedulePreviewProps = {
  sessionDateKey: string | null;
  profiles: TeamProfile[];
  membersLoading?: boolean;
  /** Если задан — в таблице эти email плюс текущий пользователь; пустой Set без «меня» скрывает график. */
  participantEmailSet?: Set<string> | undefined;
};

export function TroupeSchedulePreview({
  sessionDateKey,
  profiles,
  membersLoading,
  participantEmailSet,
}: TroupeSchedulePreviewProps) {
  const { accessToken } = useAuth();
  const availability = useScheduleAvailability(accessToken);
  const myProfile = useAppSelector(selectMyProfile);

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
      `${ACTOR_COL_VAR} repeat(${scheduleDays.length}, ${DAY_COL_PX}px)`,
    [scheduleDays.length],
  );

  const actorsSorted = useMemo(() => {
    const list = mergeSelfIntoProfiles([...(profiles ?? [])], myProfile);
    const filtered =
      participantEmailSet != null
        ? list.filter(
            (p) =>
              participantEmailSet.has(normalizeEmail(String(p.email ?? ""))) ||
              availability.isMine(p.email),
          )
        : list;
    filtered.sort((a, b) =>
      actorSortName(a).localeCompare(actorSortName(b), "ru"),
    );
    return sortMineFirst(filtered, availability.myEmail);
  }, [availability.isMine, availability.myEmail, myProfile, participantEmailSet, profiles]);

  const iAmInSchedule = actorsSorted.some((profile) =>
    availability.isMine(profile.email),
  );

  const noParticipantsForFilteredChart =
    participantEmailSet != null &&
    participantEmailSet.size === 0 &&
    !availability.myEmail;

  if (noParticipantsForFilteredChart) {
    return null;
  }

  const gridMinWidth = `calc(${ACTOR_COL_VAR} + ${scheduleDays.length * DAY_COL_PX}px)`;

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

          {iAmInSchedule ? (
            <div className="troupe-schedule-preview__hint">
              Кликните по своему дню, чтобы отметить занятость.
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
                    ? "Нет участников для графика по выбранным актёрам."
                    : "Нет данных по участникам (или нет профилей)."}
                </div>
              ) : (
                actorsSorted.slice(0, 200).map((prof) => {
                  const email = String(prof.email ?? "").trim();
                  const displayName = String(prof.displayName ?? "").trim();
                  const actorTitle = displayName || "Без имени";
                  const mine = availability.isMine(email);
                  const dayAvailability = availability.resolveDayAvailability(
                    email,
                    prof.availabilityCalendar,
                    prof.availabilityTimeRanges,
                  );
                  return (
                    <Fragment key={email || actorTitle}>
                      <div
                        className={cn(
                          "troupe-cell troupe-sticky troupe-actor-cell",
                          mine && "troupe-actor-cell--mine",
                        )}
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
                            {mine ? (
                              <div className="troupe-actor-you">Вы</div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      {scheduleDays.map((d) => {
                        const dayKey = toDateKey(d);
                        const visual = getAvailabilityDayVisual(
                          dayAvailability.calendar,
                          dayAvailability.ranges,
                          dayKey,
                        );
                        const isFocus = dayKey === sessionDateKey;
                        const cellTitle = `${dayKey} · ${visual.tooltip}`;
                        return (
                          <div
                            key={`${email}:${dayKey}`}
                            role={mine ? "button" : undefined}
                            tabIndex={mine ? 0 : undefined}
                            className={cn(
                              "troupe-cell troupe-day-cell",
                              visual.cls,
                              isFocus && "focus",
                              mine && "troupe-day-cell--mine",
                            )}
                            title={
                              mine
                                ? `${cellTitle}. Нажмите, чтобы изменить`
                                : cellTitle
                            }
                            onClick={
                              mine
                                ? () => availability.openDayEditor(dayKey)
                                : undefined
                            }
                            onKeyDown={
                              mine
                                ? (e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      availability.openDayEditor(dayKey);
                                    }
                                  }
                                : undefined
                            }
                          />
                        );
                      })}
                    </Fragment>
                  );
                })
              )}
            </div>
          </div>
          <AvailabilityDayModal
            isOpen={Boolean(availability.editingDateIso)}
            dateIso={availability.editingDateIso}
            onClose={availability.closeDayEditor}
          />
        </>
      )}
    </div>
  );
}
