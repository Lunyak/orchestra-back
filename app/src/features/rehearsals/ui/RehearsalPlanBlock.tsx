import { useEffect, useState } from "react";
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
    return <div className="rehearsals-muted">Сначала выбери сцены (шаги) для этой репетиции.</div>;
  }
  const items = (data?.items ?? []) as Array<{
    ready: boolean;
    stepTitle: string;
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

  const timeline = data?.timeline as
    | {
        rehearsalStartTime: string;
        rehearsalEndTime: string;
        durationMin: number;
        scheduledMin: number;
        steps: Array<{
          sceneName: string;
          stepTitle: string;
          startTime: string;
          endTime: string;
          durationMin: number;
        }>;
      }
    | null
    | undefined;

  if (bad.length === 0 && good.length === 0) return <div className="rehearsals-muted">Собирается.</div>;
  return (
    <div className="rehearsals-plan">
      {timeline?.steps?.length ? (
        <div style={{ marginBottom: 12 }}>
          <div className="rehearsals-muted" style={{ marginBottom: 6 }}>
            Таймлайн ({timeline.rehearsalStartTime}–{timeline.rehearsalEndTime}, всего {timeline.durationMin} мин,
            запланировано {timeline.scheduledMin} мин):
          </div>
          {timeline.steps.slice(0, 50).map((t, idx) => (
            <div key={`tl-${idx}`} className="rehearsals-problem">
              <div className="rehearsals-problem-title">
                {t.startTime}–{t.endTime} · {t.sceneName}: {t.stepTitle}
              </div>
              <div className="rehearsals-problem-meta">{t.durationMin} мин</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rehearsals-muted" style={{ marginBottom: 12 }}>
          Таймлайн появится, когда у готовых шагов будет задана длительность (мин).
        </div>
      )}

      {good.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div className="rehearsals-muted" style={{ marginBottom: 6 }}>
            Готовые шаги (с какого времени можно):
          </div>
          {good.slice(0, 20).map((x, idx) => (
            <div key={`g-${idx}`} className="rehearsals-problem">
              <div className="rehearsals-problem-title">
                {x.availableFromTime ? `с ${x.availableFromTime} · ` : ""}
                {(x.sceneName ? `${x.sceneName}: ` : "") + x.stepTitle}
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
          <div className="rehearsals-muted" style={{ marginBottom: 6 }}>
            Не собирается:
          </div>
          {bad.slice(0, 30).map((x, idx) => (
            <div key={`b-${idx}`} className="rehearsals-problem">
              <div className="rehearsals-problem-title">
                {(x.sceneName ? `${x.sceneName}: ` : "") + x.stepTitle}
              </div>
              <div className="rehearsals-problem-meta">{x.missing.slice(0, 2).join(" · ")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
