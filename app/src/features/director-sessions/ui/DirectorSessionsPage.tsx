import { CalendarSection } from "@shared/components/calendar/CalendarSection";
import { Buttons } from "@shared/components/buttons/Buttons";
import { Button } from "@shared/core/button/Button";
import { FormTextarea } from "@shared/core/form-textarea/FormTextarea";
import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import React, { useEffect, useState } from "react";
import {
  calledStatusToGatherMark,
  formatTimeHHMM,
  getSessionStartLocalMinutes,
} from "../model/session-page-utils";
import "../../director-session-detail/director-session-detail.css";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import { MiniAvatar } from "../../../shared/components/mini-avatar/MiniAvatar";
import { RehearsalPlanSectionChrome } from "../../../shared/components/rehearsal-plan/RehearsalPlanSectionChrome";
import "../../rehearsals/ui/rehearsals.css";
import "./director-sessions.css";
import {
  useDirectorSessionsPage,
  type DirectorSessionsPageViewModel,
} from "../model/useDirectorSessionsPage";
import type { SessionsSideCalledStatusTone, SlotGatherStatus } from "../model/session-page-types";

export type { DirectorSessionsPageViewModel } from "../model/useDirectorSessionsPage";
export { useDirectorSessionsPage } from "../model/useDirectorSessionsPage";

dayjs.locale("ru");

type SessionsBrowseStage = "calendar" | "day" | "session";

type CalledRow = {
  key: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  avatarLabel: string;
  statusLabel: string;
  statusTone: SessionsSideCalledStatusTone;
};

const SLOT_GATHER_LABELS: Record<SlotGatherStatus, string> = {
  ok: "Все явки",
  warn: "Не все явки",
  bad: "Не собирается",
  none: "Нет материала",
};

function SlotGatherMark({ status }: { status: SlotGatherStatus }) {
  const label = SLOT_GATHER_LABELS[status];
  return (
    <span
      className={cn("sessions-slot-gather-mark", `sessions-slot-gather-mark--${status}`)}
      title={label}
      aria-label={label}
    />
  );
}

function SessionsSlotPreviewRow({
  time,
  projectLabel,
  sceneLabel,
  durationMin,
  gatherStatus,
}: {
  time: string;
  projectLabel: string;
  sceneLabel: string;
  durationMin?: number;
  gatherStatus: SlotGatherStatus;
}) {
  const durationSuffix =
    durationMin != null && durationMin > 0 ? `${durationMin}′` : null;
  const materialParts: string[] = [];
  if (projectLabel) materialParts.push(projectLabel);
  materialParts.push(sceneLabel);
  if (durationSuffix) materialParts.push(durationSuffix);
  const materialLine = materialParts.join(" · ");

  return (
    <div className="sessions-slot-row">
      <span className="sessions-slot-row__time">{time}</span>
      <span className="sessions-slot-row__label" title={materialLine}>
        {materialLine}
      </span>
      <SlotGatherMark status={gatherStatus} />
    </div>
  );
}

function SessionsNavBack({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className="sessions-nav-back" onClick={onClick}>
      {children}
    </button>
  );
}

function SlotCalledActors({
  rows,
  emptyMessage,
  compact = false,
}: {
  rows: CalledRow[];
  emptyMessage: string;
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rehearsals-muted sessions-slot-called__empty">
        {emptyMessage}
      </div>
    );
  }

  const avatarSize = compact ? 18 : 22;

  return (
    <div
      className={cn(
        "sessions-slot-called",
        compact && "sessions-slot-called--compact",
      )}
    >
      {!compact ? (
        <div className="rehearsals-section-title sessions-slot-called__title">
          Актёры
        </div>
      ) : null}
      <ul className="director-session-page__called-list sessions-slot-called__list">
        {rows.map((row) => {
          const statusHint = row.statusLabel.trim();
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
                size={avatarSize}
              />
              <span
                className={cn(
                  "sessions-slot-gather-mark",
                  `sessions-slot-gather-mark--${markStatus}`,
                )}
                title={statusHint || undefined}
                aria-label={statusHint || undefined}
              />
              <span
                className="director-session-page__called-name"
                title={row.email}
              >
                {row.name}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DirectorSessionsPageView({ vm }: { vm: DirectorSessionsPageViewModel }) {
  const {
    activeSessionId,
    setActiveSessionId,
    navigateToSessionPage,
    activeSession,
    deleteSession,
    createSessionForSelectedDate,
    createSessionAtDate,
    calendarState,
    setCalendarState,
    dotsByDate,
    eventsByDate,
    sessionsForSelectedDay,
    calendarSelectedDateLabel,
    updateActiveSession,
    sessionDateInputId,
    sessionTimeInputId,
    getLocalDateTimeParts,
    toDateKey,
    activeSlotId,
    setActiveSlotId,
    formatSlotTime,
    slotInsights,
    slotGatherStatusBySlotId,
    daySessionPreviewsById,
    publishError,
    sendingAvailabilityReminders,
    availabilityReminderMessage,
    sessionCommentDraft,
    onSessionCommentChange,
    onSessionCommentBlur,
    publishActiveSession,
    publishing,
    activeSessionPublished,
    sendAvailabilityReminders,
    sessionMissingAvailabilityEmails,
    sessionsSideCalledRowsBySlotId,
    sessionIdFromUrl,
    navigate,
  } = vm;

  const [browseStage, setBrowseStage] = useState<SessionsBrowseStage>(() =>
    sessionIdFromUrl ? "session" : "calendar",
  );

  useEffect(() => {
    if (sessionIdFromUrl && activeSessionId) {
      setBrowseStage("session");
    }
  }, [sessionIdFromUrl, activeSessionId]);

  const goCalendar = () => {
    setActiveSessionId(null);
    setActiveSlotId(null);
    setBrowseStage("calendar");
  };

  const goDay = () => {
    setActiveSlotId(null);
    setBrowseStage("day");
  };

  const openDay = (dateKey: string) => {
    setCalendarState((prev) => ({ ...prev, selectedDate: dateKey }));
    setActiveSessionId(null);
    setActiveSlotId(null);
    setBrowseStage("day");
  };

  const openSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setActiveSlotId(null);
    setBrowseStage("session");
  };

  const handleCreateSession = async () => {
    await createSessionForSelectedDate();
    setBrowseStage("session");
  };

  const handleCalendarDoubleClick = async (dateKey: string) => {
    await createSessionAtDate(dateKey);
    setBrowseStage("session");
  };

  const toggleSlot = (slotId: string) => {
    setActiveSlotId((prev) => (prev === slotId ? null : slotId));
  };

  const sortedSlots = [...(activeSession?.slots ?? [])].sort(
    (a, b) => a.offsetMin - b.offsetMin,
  );

  return (
    <div className="rehearsals-page sessions-page">
      <RehearsalPlanSectionChrome activeTab="sessions" />

      <div className="sessions-flow">
        {browseStage === "calendar" ? (
          <RehearsalsCard className="sessions-calendar-card">
            <CalendarSection
              className="sessions-calendar"
              storageMonthKey="director-sessions-calendar-month"
              onStateChange={setCalendarState}
              dotsByDate={dotsByDate}
              eventsByDate={eventsByDate}
              onDayClick={openDay}
              onDayDoubleClick={(date) => void handleCalendarDoubleClick(date)}
              title="Календарь сессий"
              subtitle="Клик — день · двойной клик — новая сессия"
            />
          </RehearsalsCard>
        ) : null}

        {browseStage === "day" ? (
          <RehearsalsCard className="sessions-day-stage">
            <div className="sessions-nav-head">
              <SessionsNavBack onClick={goCalendar}>← Календарь</SessionsNavBack>
              <span className="sessions-nav-head__title">
                {calendarSelectedDateLabel}
              </span>
            </div>

            <div className="sessions-day-toolbar">
              <Button
                type="button"
                onClick={() => void handleCreateSession()}
                title={`Создать сессию на ${calendarSelectedDateLabel}, 20:00`}
              >
                Создать сессию
              </Button>
            </div>

            <div className="sessions-day-list">
              {sessionsForSelectedDay.length === 0 ? (
                <div className="rehearsals-muted sessions-day-list__empty">
                  На этот день сессий нет. Создайте сессию или сделайте двойной
                  клик по дате в календаре.
                </div>
              ) : (
                sessionsForSelectedDay.map((s) => {
                  const time = formatTimeHHMM(
                    getSessionStartLocalMinutes(s.startsAt),
                  );
                  const published = Boolean(String(s.publishedAt ?? "").trim());
                  const preview = daySessionPreviewsById.get(s.id);
                  const gatherSummary = preview?.slotsWithMaterialCount
                    ? `${preview.slotsOkCount}/${preview.slotsWithMaterialCount}`
                    : null;

                  return (
                    <div key={s.id} className="sessions-day-item">
                      <div
                        role="button"
                        tabIndex={0}
                        className="sessions-day-item__main"
                        onClick={() => openSession(s.id)}
                        onDoubleClick={() => navigateToSessionPage(s.id)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
                          e.preventDefault();
                          openSession(s.id);
                        }}
                        title="Клик — сессия · двойной клик — план и материалы"
                      >
                        <span className="sessions-day-item__header">
                          <span className="sessions-day-item__time">{time}</span>
                          <span className="sessions-day-item__header-body">
                            <span className="sessions-day-item__title">
                              {s.title}
                            </span>
                            {published ? (
                              <span className="sessions-day-item__badge sessions-day-item__badge--published">
                                опубликована
                              </span>
                            ) : (
                              <span className="sessions-day-item__badge">
                                черновик
                              </span>
                            )}
                          </span>
                          {gatherSummary ? (
                            <span
                              className="sessions-day-item__gather-summary"
                              title="Слотов с полными явками"
                            >
                              {gatherSummary}
                            </span>
                          ) : null}
                        </span>

                        {preview && preview.slots.length > 0 ? (
                          <ul className="sessions-day-item__slots">
                            {preview.slots.map((slot) => (
                              <li key={slot.slotId}>
                                <SessionsSlotPreviewRow
                                  time={slot.time}
                                  projectLabel={slot.projectLabel}
                                  sceneLabel={slot.sceneLabel}
                                  durationMin={slot.durationMin}
                                  gatherStatus={slot.gatherStatus}
                                />
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        {preview?.commentPreview ? (
                          <p className="sessions-day-item__comment rehearsals-muted">
                            {preview.commentPreview}
                          </p>
                        ) : null}
                      </div>
                      <Buttons.DeleteButton
                        type="button"
                        className="sessions-day-item__delete"
                        onClick={() => void deleteSession(s.id)}
                        title="Удалить сессию"
                        aria-label="Удалить сессию"
                      />
                    </div>
                  );
                })
              )}
            </div>
          </RehearsalsCard>
        ) : null}

        {browseStage === "session" && activeSession ? (
          <RehearsalsCard className="sessions-session-stage">
            <div className="sessions-nav-head">
              <SessionsNavBack onClick={goDay}>← {calendarSelectedDateLabel}</SessionsNavBack>
              <span className="sessions-nav-head__meta rehearsals-muted">
                {formatTimeHHMM(
                  getSessionStartLocalMinutes(activeSession.startsAt),
                )}
                {activeSessionPublished ? " · опубликована" : " · черновик"}
              </span>
            </div>

            <div className="form-textarea sessions-slots__title">
              <input
                className="native-text-input"
                type="text"
                aria-label="Название сессии"
                value={activeSession.title}
                onChange={(e) =>
                  void updateActiveSession({ title: e.target.value })
                }
              />
            </div>

            <FormTextarea
              rootClassName="sessions-session-comment"
              rows={2}
              value={sessionCommentDraft}
              onChange={(e) => onSessionCommentChange(e.target.value)}
              onBlur={onSessionCommentBlur}
              placeholder="Комментарий к сессии"
            />

            <div className="sessions-row">
              <div className={cn("form-textarea", "form-textarea--with-label")}>
                <input
                  id={sessionDateInputId}
                  className="native-text-input"
                  type="date"
                  value={getLocalDateTimeParts(activeSession.startsAt).date}
                  onChange={(e) => {
                    const { time } = getLocalDateTimeParts(
                      activeSession.startsAt,
                    );
                    const next = `${e.target.value}T${time || "20:00"}:00`;
                    const d = new Date(next);
                    if (Number.isFinite(d.getTime()))
                      void updateActiveSession({
                        startsAt: d.toISOString(),
                      });
                  }}
                />
              </div>
              <div className={cn("form-textarea", "form-textarea--with-label")}>
                <input
                  id={sessionTimeInputId}
                  className="native-text-input"
                  type="time"
                  value={getLocalDateTimeParts(activeSession.startsAt).time}
                  onChange={(e) => {
                    const { date } = getLocalDateTimeParts(
                      activeSession.startsAt,
                    );
                    const next = `${date || toDateKey(new Date())}T${e.target.value}:00`;
                    const d = new Date(next);
                    if (Number.isFinite(d.getTime()))
                      void updateActiveSession({
                        startsAt: d.toISOString(),
                      });
                  }}
                />
              </div>
            </div>

            <div className="sessions-session-slots">
              <div className="sessions-session-slots__header">
                <span className="rehearsals-muted">Слоты</span>
                <Button
                  className="sessions-field__plan"
                  type="button"
                  onClick={() =>
                    navigate(
                      `/sessions/${encodeURIComponent(activeSession.id)}`,
                    )
                  }
                  title="Создавать, наполнять и менять порядок слотов"
                >
                  План и материалы
                </Button>
              </div>

              {sortedSlots.length === 0 ? (
                <div className="sessions-slots-empty rehearsals-muted">
                  Слотов пока нет — задай план на странице сессии.
                </div>
              ) : (
                <div className="sessions-slots director-session-slots-panel__timeline">
                  {sortedSlots.map((sl) => {
                    const isActive = sl.id === activeSlotId;
                    const insight = slotInsights.find((x) => x.slotId === sl.id);
                    const projectLabel = insight?.projectLabel ?? "";
                    const sceneLabel = insight?.sceneLabel ?? "Материал не выбран";
                    const slotTime = formatSlotTime(
                      activeSession.startsAt,
                      sl.offsetMin,
                    );
                    const slotProjectLabel = projectLabel || "Материал не выбран";
                    const slotMeta = projectLabel ? sceneLabel : "";
                    const slotNotes = String(sl.notes ?? "").trim();
                    const gatherStatus =
                      slotGatherStatusBySlotId.get(sl.id) ?? "none";
                    const calledRows =
                      sessionsSideCalledRowsBySlotId.get(sl.id) ?? [];
                    const slotEmptyMessage =
                      "Нет актёров по ролям — выбери материал или назначь роли в проекте.";

                    return (
                      <div
                        key={sl.id}
                        className={cn(
                          "sessions-session-slot",
                          "director-session-slots-panel__row",
                          isActive && "sessions-session-slot--active",
                        )}
                      >
                        <Button
                          type="button"
                          className={cn(
                            "rehearsals-item",
                            "sessions-session-slot__main",
                            "director-session-slots-panel__slot-main",
                            isActive && "sessions-session-slot__main--active",
                          )}
                          onClick={() => toggleSlot(sl.id)}
                          aria-expanded={isActive}
                        >
                          <div className="sessions-slot-head">
                            <div className="sessions-slot-title" title={slotTime}>
                              <span className="sessions-slot-title__text">
                                {slotTime}
                              </span>
                            </div>
                            <div className="sessions-session-slot__marks">
                              <SlotGatherMark status={gatherStatus} />
                            </div>
                          </div>
                          <div
                            className="sessions-slot-project"
                            title={slotProjectLabel}
                          >
                            {slotProjectLabel}
                          </div>
                          {slotMeta ? (
                            <div className="sessions-slot-meta" title={slotMeta}>
                              {slotMeta}
                            </div>
                          ) : null}
                          {slotNotes ? (
                            <div
                              className="sessions-slot-notes"
                              title={slotNotes}
                            >
                              {slotNotes}
                            </div>
                          ) : null}
                        </Button>

                        {isActive ? (
                          <SlotCalledActors
                            rows={calledRows}
                            emptyMessage={slotEmptyMessage}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="sessions-session-footer">
              {publishError ? (
                <div className="rehearsals-error">{publishError}</div>
              ) : null}
              {availabilityReminderMessage ? (
                <div className="rehearsals-muted">
                  {availabilityReminderMessage}
                </div>
              ) : null}

              <div className="sessions-slots__container-btns sessions-session-footer__btns">
                <Button
                  type="button"
                  onClick={() => void publishActiveSession()}
                  disabled={publishing}
                  title={
                    activeSessionPublished
                      ? "Пересобрать список участников по календарю, обновить комментарий; при подключённом боте — обновить или отправить сообщение в Telegram"
                      : "Помечает сессию опубликованной; при подключённом боте — дублирует вызов в Telegram"
                  }
                >
                  {publishing
                    ? "Публикую…"
                    : activeSessionPublished
                      ? "Обновить публикацию"
                      : "Опубликовать"}
                </Button>
                <Button
                  type="button"
                  onClick={() => void sendAvailabilityReminders()}
                  disabled={
                    sendingAvailabilityReminders ||
                    sessionMissingAvailabilityEmails.length === 0
                  }
                  title="Отправить в Telegram напоминания актёрам без отметки занятости"
                >
                  {sendingAvailabilityReminders
                    ? "Отправляю…"
                    : `Напомнить в Telegram (${sessionMissingAvailabilityEmails.length})`}
                </Button>
              </div>
            </div>
          </RehearsalsCard>
        ) : null}

        {browseStage === "session" && !activeSession ? (
          <div className="rehearsals-muted sessions-main-empty">
            Сессия не найдена.{" "}
            <button type="button" className="sessions-nav-back" onClick={goDay}>
              Вернуться к списку
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DirectorSessionsPage() {
  const vm = useDirectorSessionsPage();
  if (vm.needsAuth) {
    return (
      <div className="rehearsals-page sessions-page">
        <div className="rehearsals-muted">Нужно войти.</div>
      </div>
    );
  }
  if (vm.loading) {
    return (
      <div className="rehearsals-page sessions-page">
        <div className="rehearsals-muted">Загрузка сессий…</div>
      </div>
    );
  }
  if (vm.error) {
    return (
      <div className="rehearsals-page sessions-page">
        <div className="rehearsals-error">{vm.error}</div>
      </div>
    );
  }
  return <DirectorSessionsPageView vm={vm} />;
}
