import { Button } from "@shared/core/button/Button";
import { FormTextarea } from "@shared/core/form-textarea/FormTextarea";
import { LabeledCheckbox } from "@shared/core/labeled-checkbox/LabeledCheckbox";
import cn from "classnames";
import { projectSessionPath } from "../../../app/router/paths";
import type { DirectorRehearsalSession } from "../directorSessionsSync";
import type {
  SlotGatherStatus,
  SlotInsight,
} from "../model/session-page-types";
import {
  formatTimeHHMM,
  getSessionStartLocalMinutes,
} from "../model/session-page-utils";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import type { CalledRow } from "./DirectorSessionsShared";
import {
  SessionsNavBack,
  SlotCalledActors,
  SlotGatherMark,
} from "./DirectorSessionsShared";

type DirectorSessionsSessionStageProps = {
  projectName: string;
  activeSession: DirectorRehearsalSession;
  activeSessionPublished: boolean;
  calendarSelectedDateLabel: string;
  sessionDateInputId: string;
  sessionTimeInputId: string;
  sessionCommentDraft: string;
  onSessionCommentChange: (value: string) => void;
  onSessionCommentBlur: () => void;
  updateActiveSession: (patch: Partial<DirectorRehearsalSession>) => void;
  getLocalDateTimeParts: (iso: string) => { date: string; time: string };
  toDateKey: (d: Date) => string;
  formatSlotTime: (startsAt: string, offsetMin: number) => string;
  activeSlotId: string | null;
  onToggleSlot: (slotId: string) => void;
  slotInsights: SlotInsight[];
  slotGatherStatusBySlotId: Map<string, SlotGatherStatus>;
  sessionsSideCalledRowsBySlotId: Map<string, CalledRow[]>;
  publishError: string | null;
  saveError: string | null;
  availabilityReminderMessage: string | null;
  includeUnavailableInCall: boolean;
  setIncludeUnavailableInCall: (value: boolean) => void;
  publishing: boolean;
  onPublish: () => void;
  sendingAvailabilityReminders: boolean;
  sessionMissingAvailabilityEmails: string[];
  onSendAvailabilityReminders: () => void;
  onBack: () => void;
  onNavigate: (path: string) => void;
};

export function DirectorSessionsSessionStage({
  projectName,
  activeSession,
  activeSessionPublished,
  calendarSelectedDateLabel,
  sessionDateInputId,
  sessionTimeInputId,
  sessionCommentDraft,
  onSessionCommentChange,
  onSessionCommentBlur,
  updateActiveSession,
  getLocalDateTimeParts,
  toDateKey,
  formatSlotTime,
  activeSlotId,
  onToggleSlot,
  slotInsights,
  slotGatherStatusBySlotId,
  sessionsSideCalledRowsBySlotId,
  publishError,
  saveError,
  availabilityReminderMessage,
  includeUnavailableInCall,
  setIncludeUnavailableInCall,
  publishing,
  onPublish,
  sendingAvailabilityReminders,
  sessionMissingAvailabilityEmails,
  onSendAvailabilityReminders,
  onBack,
  onNavigate,
}: DirectorSessionsSessionStageProps) {
  const sortedSlots = [...(activeSession.slots ?? [])].sort(
    (a, b) => a.offsetMin - b.offsetMin,
  );

  return (
    <RehearsalsCard className="sessions-session-stage">
      <div className="sessions-nav-head">
        <SessionsNavBack onClick={onBack}>
          ← {calendarSelectedDateLabel}
        </SessionsNavBack>
        <span className="sessions-nav-head__meta rehearsals-muted">
          {formatTimeHHMM(getSessionStartLocalMinutes(activeSession.startsAt))}
          {activeSessionPublished ? " · опубликована" : " · черновик"}
        </span>
      </div>

      <div className="form-textarea sessions-slots__title">
        <input
          className="native-text-input"
          type="text"
          aria-label="Название сессии"
          value={activeSession.title}
          onChange={(e) => void updateActiveSession({ title: e.target.value })}
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
              const { time } = getLocalDateTimeParts(activeSession.startsAt);
              const next = `${e.target.value}T${time || "20:00"}:00`;
              const d = new Date(next);
              if (Number.isFinite(d.getTime()))
                void updateActiveSession({ startsAt: d.toISOString() });
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
              const { date } = getLocalDateTimeParts(activeSession.startsAt);
              const next = `${date || toDateKey(new Date())}T${e.target.value}:00`;
              const d = new Date(next);
              if (Number.isFinite(d.getTime()))
                void updateActiveSession({ startsAt: d.toISOString() });
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
              onNavigate(projectSessionPath(projectName, activeSession.id))
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
                    onClick={() => onToggleSlot(sl.id)}
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
                      <div
                        className={cn(
                          "sessions-slot-meta",
                          sl.isProgRun && "sessions-slot-meta--prog-run",
                        )}
                        title={slotMeta}
                      >
                        {slotMeta}
                      </div>
                    ) : null}
                    {slotNotes ? (
                      <div className="sessions-slot-notes" title={slotNotes}>
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
        {saveError ? <div className="rehearsals-error">{saveError}</div> : null}
        {availabilityReminderMessage ? (
          <div className="rehearsals-muted">{availabilityReminderMessage}</div>
        ) : null}

        <div className="sessions-slots__container-btns sessions-session-footer__btns">
          <LabeledCheckbox
            className="sessions-session-footer__call-toggle"
            checked={includeUnavailableInCall}
            onChange={setIncludeUnavailableInCall}
          >
            Звать без занятости / с отрицательной
          </LabeledCheckbox>
          <Button
            type="button"
            onClick={onPublish}
            disabled={publishing}
            title={
              activeSessionPublished
                ? "Пересобрать список участников. Telegram обновит уже отправленное сообщение или уйдёт по расписанию бота"
                : "Собирает вызов в приложении. Telegram — сразу или по расписанию бота, смотрите кнопку «Бот» в списке"
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
            onClick={onSendAvailabilityReminders}
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
  );
}
