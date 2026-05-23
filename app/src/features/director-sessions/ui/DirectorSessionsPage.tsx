import { Buttons } from "@shared/components/buttons/Buttons";
import { ListItem } from "@shared/components/list-item/ListItem";
import { Button } from "@shared/core/button/Button";
import { FormTextarea } from "@shared/core/form-textarea/FormTextarea";
import cn from "classnames";
import React from "react";
import "../../director-session-detail/director-session-detail.css";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import { MiniAvatar } from "../../../shared/components/mini-avatar/MiniAvatar";
import "../../../pages/rehearsals/style.css";
import "../../../pages/sessions/style.css";
import {
  useDirectorSessionsPage,
  type DirectorSessionsPageViewModel,
} from "../model/useDirectorSessionsPage";

export type { DirectorSessionsPageViewModel } from "../model/useDirectorSessionsPage";
export { useDirectorSessionsPage } from "../model/useDirectorSessionsPage";

export function DirectorSessionsPageView({ vm }: { vm: DirectorSessionsPageViewModel }) {
  const {
    sessionsCount,
    activeIndex,
    sessions,
    activeSessionId,
    setActiveSessionId,
    draggedSessionId,
    setDraggedSessionId,
    navigateToSessionPage,
    suppressSessionRowClickUntilRef,
    cancelSessionRowLongPress,
    onSessionRowPointerDown,
    onSessionRowPointerMove,
    activeSession,
    moveSessionDelta,
    deleteSession,
    createSession,
    moveSessionBefore,
    updateActiveSession,
    sessionDateInputId,
    sessionTimeInputId,
    getLocalDateTimeParts,
    toDateKey,
    activeSlotId,
    setActiveSlotId,
    formatSlotTime,
    slotInsights,
    slotRowToneClassBySlotId,
    slotAvailabilityById,
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
    sessionsSideCalledRows,
    activeSlotInsight,
    navigate,
  } = vm;
  return (
    <>
      <div className="rehearsals-page sessions-page">
        <div className="rehearsals-head">
          <div className="rehearsals-meta">Сессии</div>
        </div>

        <div className="sessions-layout">
          <aside className="sessions-side">
            <RehearsalsCard>
              <div className="sessions-actions">
                <Button
                  type="button"
                  onClick={() =>
                    activeSessionId &&
                    void moveSessionDelta(activeSessionId, -1)
                  }
                  disabled={activeIndex <= 0}
                  title="Переместить выбранную сессию вверх"
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    activeSessionId && void moveSessionDelta(activeSessionId, 1)
                  }
                  disabled={
                    activeIndex < 0 || activeIndex === sessionsCount - 1
                  }
                  title="Переместить выбранную сессию вниз"
                >
                  ↓
                </Button>
                <Buttons.DeleteButton
                  type="button"
                  className="sessions-actions__btn-delete"
                  onClick={() =>
                    activeSessionId && void deleteSession(activeSessionId)
                  }
                  disabled={activeIndex < 0}
                  title="Удалить выбранную сессию"
                />
              </div>
              <div className="sessions-list">
                {(sessions ?? []).map((s, index) => (
                  <div
                    key={s.id}
                    className={`sessions-sessionRow ${s.id === activeSessionId ? "active" : ""}`}
                    title="Выбор: клик · открыть сессию: двойной клик или долгое нажатие"
                    onClick={() => {
                      if (Date.now() < suppressSessionRowClickUntilRef.current)
                        return;
                      setActiveSessionId(s.id);
                    }}
                    onDoubleClick={() => navigateToSessionPage(s.id)}
                    onPointerDown={(e) => onSessionRowPointerDown(e, s.id)}
                    onPointerMove={(e) => onSessionRowPointerMove(e, s.id)}
                    onPointerUp={cancelSessionRowLongPress}
                    onPointerCancel={cancelSessionRowLongPress}
                    onContextMenu={(e) => e.preventDefault()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const dragId =
                        e.dataTransfer.getData("text/plain") ||
                        draggedSessionId;
                      if (!dragId) return;
                      void moveSessionBefore(dragId, s.id);
                    }}
                  >
                    <ListItem
                      className={`sessions-listItem-row ${s.id === activeSessionId ? "active" : ""} ${draggedSessionId === s.id ? "dragging" : ""}`}
                    >
                      <span
                        className="sessions-sessionRow__dragHandle"
                        draggable
                        title="Перетащи за ручку, чтобы изменить порядок"
                        role="presentation"
                        onPointerDown={(e) => e.stopPropagation()}
                        onDragStart={(e) => {
                          cancelSessionRowLongPress();
                          e.dataTransfer.setData("text/plain", s.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggedSessionId(s.id);
                        }}
                        onDragEnd={() => setDraggedSessionId(null)}
                      >
                        ⋮⋮
                      </span>
                      <button
                        type="button"
                        className="rehearsals-item"
                        title="Выбор — клик · страница сессии — двойной клик или долгое нажатие"
                      >
                        <div className="rehearsals-item-title">{s.title}</div>
                      </button>
                    </ListItem>
                  </div>
                ))}
                <Buttons.AddButton
                  type="button"
                  onClick={createSession}
                  title="Новая сессия"
                  aria-label="Добавить сессию"
                />
              </div>
            </RehearsalsCard>
          </aside>

          <div className="sessions-main">
            {!activeSession ? (
              <div className="rehearsals-muted">Выбери или создай сессию.</div>
            ) : (
              <div className="sessions-panels">
                <RehearsalsCard fluid>
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

                  <div className="sessions-row">
                    <div
                      className={cn(
                        "form-textarea",
                        "form-textarea--with-label",
                      )}
                    >
                      <input
                        id={sessionDateInputId}
                        className="native-text-input"
                        type="date"
                        value={
                          getLocalDateTimeParts(activeSession.startsAt).date
                        }
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
                    <div
                      className={cn(
                        "form-textarea",
                        "form-textarea--with-label",
                      )}
                    >
                      <input
                        id={sessionTimeInputId}
                        className="native-text-input"
                        type="time"
                        value={
                          getLocalDateTimeParts(activeSession.startsAt).time
                        }
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

                  <div className="sessions-slots-readonly">
                    <div className="sessions-slots-readonly__head">
                      <span className="rehearsals-muted">Слоты (обзор)</span>
                    </div>
                    {(!activeSession.slots ||
                      activeSession.slots.length === 0) && (
                      <div className="sessions-slots-empty rehearsals-muted">
                        Слотов пока нет — задай план на странице сессии (кнопка
                        выше).
                      </div>
                    )}
                    {[...(activeSession.slots ?? [])]
                      .sort((a, b) => a.offsetMin - b.offsetMin)
                      .map((sl) => (
                        <button
                          key={sl.id}
                          type="button"
                          className={`sessions-slots-readonly__row ${sl.id === activeSlotId ? "active" : ""} ${slotRowToneClassBySlotId.get(sl.id) ?? ""}`.trim()}
                          onClick={() => setActiveSlotId(sl.id)}
                        >
                          <div className="sessions-slots-readonly__time">
                            {formatSlotTime(
                              activeSession.startsAt,
                              sl.offsetMin,
                            )}{" "}
                            · {sl.durationMin} мин
                          </div>
                          <div className="sessions-slots-readonly__meta">
                            {slotInsights.find((x) => x.slotId === sl.id)
                              ?.title ??
                              (sl.ref
                                ? `${sl.ref.projectSlug} · шаг #${sl.ref.stepId}`
                                : "Материал не выбран")}
                          </div>
                          {String(sl.notes ?? "").trim() ? (
                            <div
                              className="sessions-slots-readonly__notes"
                              title={String(sl.notes).trim()}
                            >
                              {String(sl.notes).trim()}
                            </div>
                          ) : null}
                          {(() => {
                            const av = slotAvailabilityById.get(sl.id);
                            if (!av) return null;
                            const total =
                              av.free.length +
                              av.busy.length +
                              av.unknown.length;
                            if (total === 0) return null;
                            return (
                              <div className="rehearsals-muted sessions-slots-readonly__avail">
                                по доступности: свободны <b>{av.free.length}</b>{" "}
                                / {total}
                                {av.unknown.length ? (
                                  <>
                                    {" "}
                                    · не отмечено: <b>{av.unknown.length}</b>
                                  </>
                                ) : null}
                                {av.busy.length ? (
                                  <>
                                    {" "}
                                    · заняты: <b>{av.busy.length}</b>
                                  </>
                                ) : null}
                              </div>
                            );
                          })()}
                          {(() => {
                            const info = slotInsights.find(
                              (x) => x.slotId === sl.id,
                            );
                            if (!info || !sl.ref) return null;
                            if (info.ready) {
                              return (
                                <div className="rehearsals-muted sessions-slot-ok">
                                  Собирается
                                </div>
                              );
                            }
                            if (info.missingRoles.length) {
                              return (
                                <div className="rehearsals-error sessions-slot-bad">
                                  Не собирается: нет назначений для{" "}
                                  {info.missingRoles.slice(0, 4).join(", ")}
                                  {info.missingRoles.length > 4
                                    ? ` +${info.missingRoles.length - 4}`
                                    : ""}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </button>
                      ))}
                  </div>
                  {publishError && (
                    <div className="rehearsals-error">{publishError}</div>
                  )}
                  {availabilityReminderMessage ? (
                    <div className="rehearsals-muted">{availabilityReminderMessage}</div>
                  ) : null}

                  <FormTextarea
                    rootClassName="form-textarea--section"
                    rows={3}
                    value={sessionCommentDraft}
                    onChange={(e) => onSessionCommentChange(e.target.value)}
                    onBlur={onSessionCommentBlur}
                    placeholder="Комментарий к сессии"
                  />

                  <div className="sessions-slots__container-btns">
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

                    <Button
                      className="sessions-field__plan"
                      type="button"
                      onClick={() =>
                        navigate(
                          `/sessions/${encodeURIComponent(activeSession.id)}`,
                        )
                      }
                      title="Создавать, наполнять и менять порядок слотов — на странице сессии"
                    >
                      План и материалы
                    </Button>
                  </div>
                </RehearsalsCard>

                {activeSession ? (
                  <div
                    className="sessions-side-called"
                    style={{ marginTop: 12 }}
                  >
                    <div className="rehearsals-section-title">
                      {activeSlotId ? "В выбранном слоте" : "Участники сессии"}
                      {activeSlotInsight ? (
                        <span
                          className="rehearsals-muted"
                          style={{ fontWeight: 600 }}
                        >
                          {" "}
                          · {activeSlotInsight.time}
                        </span>
                      ) : null}
                    </div>
                    {sessionsSideCalledRows.length === 0 ? (
                      <div
                        className="rehearsals-muted"
                        style={{ fontSize: 12 }}
                      >
                        {activeSlotId
                          ? "Нет актёров по ролям (выбери материал в слоте или назначь роли в проекте)."
                          : "Нет участников: опубликуй сессию или назначь материалы в слотах."}
                      </div>
                    ) : (
                      <div className="director-session-page__called-scroll">
                        <ul className="director-session-page__called-list">
                          {sessionsSideCalledRows.map((row) => (
                            <li
                              key={row.key}
                              className={cn(
                                "director-session-page__called-item",
                                row.statusTone === "confirmed" &&
                                  "director-session-page__called-item--confirmed",
                              )}
                            >
                              <MiniAvatar
                                src={row.avatarUrl}
                                label={row.avatarLabel}
                                title={row.email}
                                size={22}
                              />
                              <div className="director-session-page__called-item-main">
                                <span
                                  className="director-session-page__called-name"
                                  title={row.email}
                                >
                                  {row.name}
                                </span>
                                {row.statusLabel ? (
                                  <span
                                    className={
                                      row.statusTone === "confirmed"
                                        ? "director-session-page__called-status director-session-page__called-status--confirmed"
                                        : `director-session-page__called-status director-session-page__called-status--${row.statusTone}`
                                    }
                                  >
                                    {row.statusLabel}
                                  </span>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* <RehearsalsCard fluid title="Материалы">
                <div className="sessions-row sessions-material-controls">
                  <select
                    className="native-select"
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                  >
                    {visibleProjects.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <input
                    className="native-text-input"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="поиск по названию/тексту"
                  />
                </div>
                <div className="sessions-material-subtools">
                  <label className="sessions-check">
                    <input
                      type="checkbox"
                      checked={onlySelectable}
                      onChange={(e) => setOnlySelectable(e.target.checked)}
                    />
                    <span className="rehearsals-muted">
                      только сцены, которые можно выбрать (по ролям свободных
                      актёров)
                    </span>
                  </label>
                  {membersLoading && (
                    <span className="rehearsals-muted">
                      загружаю участников…
                    </span>
                  )}
                </div>

                {stepsLoading && (
                  <div className="rehearsals-muted sessions-help">
                    Загружаю шаги…
                  </div>
                )}

                <div className="sessions-material-list">
                  {filteredStepsForList.slice(0, 200).map((s) => (
                    <ListItem
                      key={`${projectFilter}:${s.id}`}
                      className="sessions-listItem-row"
                      draggable
                      onDragStart={(e) => {
                        const payload: DragStepRefPayload = {
                          kind: "stepRef",
                          projectSlug: projectFilter,
                          stepId: s.id,
                          durationMin:
                            s.durationMin == null
                              ? undefined
                              : Math.max(
                                  1,
                                  Math.floor(Number(s.durationMin) || 1),
                                ),
                        };
                        e.dataTransfer.setData(
                          DND_MIME_STEP_REF,
                          JSON.stringify(payload),
                        );
                        e.dataTransfer.effectAllowed = "copy";
                        setMaterialDragPayload(payload);
                      }}
                      onDragEnd={() => setMaterialDragPayload(null)}
                    >
                      <button
                        type="button"
                        className="rehearsals-item"
                        title="Открыть текст и выбрать (или перетащи в слот)"
                        onClick={() => {
                          setMaterialPreview({
                            projectSlug: projectFilter,
                            step: s,
                          });
                        }}
                      >
                        <div className="rehearsals-item-title">
                          #{s.id} {s.title}
                        </div>
                      </button>
                    </ListItem>
                  ))}
                  {filteredStepsForList.length === 0 && (
                    <div className="rehearsals-muted">Ничего не найдено.</div>
                  )}
                </div>

                {materialPreview && (
                  <div
                    className="sessions-modal-backdrop"
                    role="presentation"
                    onClick={() => setMaterialPreview(null)}
                  >
                    <div
                      className="sessions-modal"
                      role="dialog"
                      aria-modal="true"
                      aria-label="Материал"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="sessions-modal-head">
                        <div>
                          <div className="sessions-modal-title">
                            {materialPreview.projectSlug} · #
                            {materialPreview.step.id}{" "}
                            {materialPreview.step.title}
                          </div>
                          <div className="rehearsals-muted">
                            кликни “Назначить”, чтобы положить в выбранный слот
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMaterialPreview(null)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="sessions-modal-actions">
                        <Button
                          type="button"
                          disabled={!activeSlotId}
                          onClick={() => {
                            if (!activeSlotId) return;
                            void attachToSlot(activeSlotId, {
                              projectSlug: materialPreview.projectSlug,
                              stepId: materialPreview.step.id,
                            });
                            setMaterialPreview(null);
                          }}
                        >
                          Назначить в выбранный слот
                        </Button>
                        {!activeSlotId && (
                          <div className="rehearsals-muted">
                            Сначала выбери слот слева
                          </div>
                        )}
                      </div>
                      <pre className="sessions-modal-text">
                        {markdownToPlainText(
                          String(
                            materialPreview.step.playMarkdown ??
                              materialPreview.step.markdown ??
                              "",
                          ),
                        )}
                      </pre>
                    </div>
                  </div>
                )}

                <div className="rehearsals-section">
                  <div className="rehearsals-section-title">
                    График актёров на {sessionDateKey ?? "—"}
                  </div>
                  {!sessionDateKey ? (
                    <div className="rehearsals-muted">
                      Сначала выбери дату сессии.
                    </div>
                  ) : (
                    <>
                      <div
                        className="rehearsals-muted"
                        style={{ marginTop: 6 }}
                      >
                        Месяц: <b>{troupeScheduleMonthKey}</b> · выбранный день
                        подсвечен
                      </div>
                      <div className="troupe-legend" style={{ marginTop: 8 }}>
                        <span className="troupe-legend-item">
                          <span className="troupe-dot free" /> свободен
                        </span>
                        <span className="troupe-legend-item">
                          <span className="troupe-dot partial" /> свободен
                          (время)
                        </span>
                        <span className="troupe-legend-item">
                          <span className="troupe-dot busy" /> занят
                        </span>
                        <span className="troupe-legend-item">
                          <span className="troupe-dot unknown" /> не отмечено
                        </span>
                      </div>

                      <div
                        className="troupe-schedule"
                        role="region"
                        aria-label="График занятости актёров"
                      >
                        <div
                          className="troupe-grid"
                          style={{
                            gridTemplateColumns:
                              troupeScheduleGridTemplateColumns,
                            minWidth: 240 + troupeScheduleDays.length * 28,
                          }}
                        >
                          <div className="troupe-cell troupe-sticky troupe-header-cell"></div>
                          {troupeScheduleDays.map((d) => {
                            const dayKey = toDateKey(d);
                            const isFocus = dayKey === sessionDateKey;
                            const n = d.toLocaleDateString("ru-RU", {
                              day: "numeric",
                            });
                            const wd = d.toLocaleDateString("ru-RU", {
                              weekday: "short",
                            });
                            return (
                              <div
                                key={dayKey}
                                className={`troupe-cell troupe-header-cell ${isFocus ? "focus" : ""}`}
                                title={dayKey}
                              >
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    lineHeight: "14px",
                                  }}
                                >
                                  {n}
                                </div>
                                <div
                                  style={{
                                    fontSize: 10,
                                    opacity: 0.7,
                                    lineHeight: "12px",
                                  }}
                                >
                                  {wd}
                                </div>
                              </div>
                            );
                          })}

                          {troupeScheduleActors.length === 0 ? (
                            <div
                              className="troupe-cell troupe-empty"
                              style={{
                                gridColumn: `1 / span ${troupeScheduleDays.length + 1}`,
                              }}
                            >
                              Нет данных по участникам проекта (или нет
                              профилей).
                            </div>
                          ) : (
                            troupeScheduleActors.slice(0, 200).map((a) => {
                              const label = a.displayName
                                ? `${a.displayName} (${a.email})`
                                : a.email;
                              return (
                                <React.Fragment key={a.email}>
                                  <div
                                    className="troupe-cell troupe-sticky troupe-actor-cell"
                                    title={label}
                                  >
                                    <div
                                      style={{
                                        minWidth: 0,
                                        display: "flex",
                                        gap: 10,
                                        alignItems: "center",
                                      }}
                                    >
                                      <MiniAvatar
                                        src={
                                          String(a.avatarUrl ?? "").trim() ||
                                          null
                                        }
                                        label={label}
                                        size={22}
                                      />
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: 2,
                                          justifyContent: "center",
                                          minWidth: 0,
                                        }}
                                      >
                                        <div
                                          className="troupe-actor-name"
                                          title={label}
                                        >
                                          {a.displayName
                                            ? a.displayName
                                            : a.email}
                                        </div>
                                        <div
                                          className="troupe-actor-email"
                                          title={a.email}
                                        >
                                          {a.email}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  {troupeScheduleDays.map((d) => {
                                    const dayKey = toDateKey(d);
                                    const cal = a.availabilityCalendar ?? {};
                                    const ranges =
                                      (a.availabilityTimeRanges ?? {})[
                                        dayKey
                                      ] ?? [];
                                    const st =
                                      cal?.[dayKey] === "present"
                                        ? "present"
                                        : cal?.[dayKey] === "absent"
                                          ? "absent"
                                          : "unknown";
                                    const cls =
                                      st === "absent"
                                        ? "busy"
                                        : ranges.length > 0
                                          ? "partial"
                                          : st === "present"
                                            ? "free"
                                            : "unknown";
                                    const tooltip =
                                      st === "absent"
                                        ? "Занят"
                                        : ranges.length > 0
                                          ? `Свободен: ${ranges.map((r) => `${r.from}–${r.to}`).join(", ")}`
                                          : st === "present"
                                            ? "Свободен"
                                            : "Не отмечено";
                                    const isFocus = dayKey === sessionDateKey;
                                    return (
                                      <div
                                        key={`${a.email}:${dayKey}`}
                                        className={`troupe-cell troupe-day-cell ${cls} ${isFocus ? "focus" : ""}`}
                                        title={`${dayKey} • ${tooltip}`}
                                      />
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </RehearsalsCard> */}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function DirectorSessionsPage() {
  const vm = useDirectorSessionsPage();
  if (vm.needsAuth) {
    return <div className="rehearsals-muted">Нужно войти.</div>;
  }
  if (vm.loading) {
    return <div className="rehearsals-muted">Загрузка сессий…</div>;
  }
  if (vm.error) {
    return <div className="rehearsals-error">{vm.error}</div>;
  }
  return <DirectorSessionsPageView vm={vm} />;
}
