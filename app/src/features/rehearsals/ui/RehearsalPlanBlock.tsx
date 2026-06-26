import { useEffect, useState } from "react";
import cn from "classnames";
import { planRehearsal } from "../../../sync/api/rehearsals";

export function RehearsalPlanBlock({
  accessToken,
  rehearsalId,
}: {
  accessToken: string | null;
  rehearsalId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !rehearsalId) return;
    setLoading(true);
    setError(null);
    planRehearsal(accessToken, rehearsalId)
      .then((res) => setData(res))
      .catch(() => setError("Не удалось посчитать план"))
      .finally(() => setLoading(false));
  }, [accessToken, rehearsalId]);

  if (!accessToken) return <div className="rehearsals-muted">Нужно войти.</div>;
  if (loading) return <div className="rehearsals-muted">Считаю…</div>;
  if (error) return <div className="rehearsals-error">{error}</div>;
  if (data?.selectionRequired) {
    return <div className="rehearsals-muted">Сначала выбери сцены для этой репетиции.</div>;
  }
  const items = (data?.items ?? []) as Array<{
    ready: boolean;
    sceneTitle: string;
    sceneName?: string;
    missing: string[];
    availableFromTime?: string;
    lateConstraints?: Array<{ role: string; email: string; availableFromTime: string }>;
    durationMin?: number | null;
  }>;
  const bad = items.filter((x) => !x.ready);
  const good = items
    .filter((x) => x.ready)
    .sort((a, b) => String(a.availableFromTime ?? "").localeCompare(String(b.availableFromTime ?? "")));

  type TimelineScene = {
    playbookName?: string;
    sceneName?: string;
    sceneTitle: string;
    startTime: string;
    endTime: string;
    durationMin: number;
  };

  const timeline = data?.timeline as
    | {
        rehearsalStartTime: string;
        rehearsalEndTime: string;
        durationMin: number;
        scheduledMin: number;
        scenes?: TimelineScene[];
      }
    | null
    | undefined;

  const timelineScenes = timeline?.scenes ?? [];

  if (bad.length === 0 && good.length === 0) return <div className="rehearsals-muted">Собирается.</div>;
  return (
    <div className="rehearsals-plan">
      {timelineScenes.length ? (
        <div className="rehearsals-plan__section">
          <div className={cn("rehearsals-muted", "rehearsals-plan__label")}>
            Таймлайн ({timeline!.rehearsalStartTime}–{timeline!.rehearsalEndTime}, всего {timeline!.durationMin} мин,
            запланировано {timeline!.scheduledMin} мин):
          </div>
          {timelineScenes.slice(0, 50).map((t, idx) => (
            <div key={`tl-${idx}`} className="rehearsals-problem">
              <div className="rehearsals-problem-title">
                {t.startTime}–{t.endTime} · {t.playbookName ?? t.sceneName}: {t.sceneTitle}
              </div>
              <div className="rehearsals-problem-meta">{t.durationMin} мин</div>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn("rehearsals-muted", "rehearsals-muted--section-gap")}>
          Таймлайн появится, когда у готовых сцен будет задана длительность (мин).
        </div>
      )}

      {good.length > 0 && (
        <div className={cn("rehearsals-plan__section", "rehearsals-plan__section--ready")}>
          <div className={cn("rehearsals-muted", "rehearsals-plan__label")}>
            Готовые сцены (с какого времени можно):
          </div>
          {good.slice(0, 20).map((x, idx) => (
            <div key={`g-${idx}`} className="rehearsals-problem">
              <div className="rehearsals-problem-title">
                {x.availableFromTime ? `с ${x.availableFromTime} · ` : ""}
                {(x.sceneName ? `${x.sceneName}: ` : "") + x.sceneTitle}
              </div>
              {!!x.lateConstraints?.length && (
                <div className="rehearsals-problem-meta">
                  {x.lateConstraints
                    .slice(0, 2)
                    .map((c) => `${c.role}: ${c.availableFromTime}`)
                    .join(" · ")}
                </div>
              )}
              {x.durationMin ? (
                <div className="rehearsals-problem-meta">длительность: {x.durationMin} мин</div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {bad.length > 0 && (
        <div>
          <div className={cn("rehearsals-muted", "rehearsals-plan__label")}>
            Не собирается:
          </div>
          {bad.slice(0, 30).map((x, idx) => (
            <div key={`b-${idx}`} className="rehearsals-problem">
              <div className="rehearsals-problem-title">
                {(x.sceneName ? `${x.sceneName}: ` : "") + x.sceneTitle}
              </div>
              <div className="rehearsals-problem-meta">{x.missing.slice(0, 2).join(" · ")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
