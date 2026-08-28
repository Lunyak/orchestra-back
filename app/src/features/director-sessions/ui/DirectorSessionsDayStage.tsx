import { Buttons } from "@shared/components/buttons/Buttons";
import { Button } from "@shared/core/button/Button";
import type { DirectorRehearsalSession } from "../directorSessionsSync";
import type { DaySessionPreview } from "../model/session-page-types";
import {
  formatTimeHHMM,
  getSessionStartLocalMinutes,
} from "../model/session-page-utils";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import {
  SessionsNavBack,
  SessionsSlotPreviewRow,
} from "./DirectorSessionsShared";

type DirectorSessionsDayStageProps = {
  calendarSelectedDateLabel: string;
  saveError: string | null;
  sessionsForSelectedDay: DirectorRehearsalSession[];
  daySessionPreviewsById: Map<string, DaySessionPreview>;
  onBack: () => void;
  onCreateSession: () => void;
  onOpenSession: (sessionId: string) => void;
  onNavigateToSessionPage: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
};

export function DirectorSessionsDayStage({
  calendarSelectedDateLabel,
  saveError,
  sessionsForSelectedDay,
  daySessionPreviewsById,
  onBack,
  onCreateSession,
  onOpenSession,
  onNavigateToSessionPage,
  onDeleteSession,
}: DirectorSessionsDayStageProps) {
  return (
    <RehearsalsCard className="sessions-day-stage">
      <div className="sessions-nav-head">
        <SessionsNavBack onClick={onBack}>← Календарь</SessionsNavBack>
        <span className="sessions-nav-head__title">
          {calendarSelectedDateLabel}
        </span>
      </div>

      <div className="sessions-day-toolbar">
        <Button
          type="button"
          onClick={onCreateSession}
          title={`Создать сессию на ${calendarSelectedDateLabel}, 20:00`}
        >
          Создать сессию
        </Button>
      </div>
      {saveError ? <div className="rehearsals-error">{saveError}</div> : null}

      <div className="sessions-day-list">
        {sessionsForSelectedDay.length === 0 ? (
          <div className="rehearsals-muted sessions-day-list__empty">
            На этот день сессий нет. Создайте сессию или сделайте двойной клик
            по дате в календаре.
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
                  onClick={() => onOpenSession(s.id)}
                  onDoubleClick={() => onNavigateToSessionPage(s.id)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    onOpenSession(s.id);
                  }}
                  title="Клик — сессия · двойной клик — план и материалы"
                >
                  <span className="sessions-day-item__header">
                    <span className="sessions-day-item__time">{time}</span>
                    <span className="sessions-day-item__header-body">
                      <span className="sessions-day-item__title">{s.title}</span>
                    </span>
                    {gatherSummary ? (
                      <span
                        className="sessions-day-item__gather-summary"
                        title="Слотов с полными явками"
                      >
                        {gatherSummary}
                      </span>
                    ) : null}
                    {published ? (
                      <span className="sessions-day-item__badge sessions-day-item__badge--published">
                        опубликована
                      </span>
                    ) : (
                      <span className="sessions-day-item__badge">черновик</span>
                    )}
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
                  onClick={() => onDeleteSession(s.id)}
                  title="Удалить сессию"
                  aria-label="Удалить сессию"
                />
              </div>
            );
          })
        )}
      </div>
    </RehearsalsCard>
  );
}
