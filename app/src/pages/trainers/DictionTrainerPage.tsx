import { Button } from "@shared/core/button/Button";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../shared/store/hooks";
import {
  dictionTrainerUiActions,
  selectDictionExercises,
  selectDictionTrainerUi,
  type DictionAttempt,
} from "../../features/trainers/model/dictionTrainerUiSlice";
import "./style.css";

function formatMs(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
}

export function DictionTrainerPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const ui = useAppSelector(selectDictionTrainerUi);
  const exercises = useMemo(() => selectDictionExercises(), []);

  const [running, setRunning] = useState(false);
  const startedAtRef = useRef<number>(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [note, setNote] = useState("");

  const exercisesFiltered = useMemo(() => {
    if (ui.selectedLevel === "all") return exercises;
    return exercises.filter((e) => e.level === ui.selectedLevel);
  }, [exercises, ui.selectedLevel]);

  useEffect(() => {
    if (running) return;
    if (ui.selectedLevel === "all") return;
    const allowed = exercisesFiltered;
    if (allowed.length === 0) return;
    const current = String(ui.selectedExerciseId ?? "");
    const ok = allowed.some((e) => e.id === current);
    if (!ok) dispatch(dictionTrainerUiActions.setDictionSelectedExercise({ value: allowed[0]!.id }));
  }, [dispatch, exercisesFiltered, running, ui.selectedExerciseId, ui.selectedLevel]);

  const attemptsByExercise = useMemo(() => {
    const map = new Map<string, DictionAttempt[]>();
    for (const a of ui.attempts ?? []) {
      const id = String(a.exerciseId ?? "");
      const arr = map.get(id);
      if (arr) arr.push(a);
      else map.set(id, [a]);
    }
    return map;
  }, [ui.attempts]);

  const selectedStats = useMemo(() => {
    const id = String(ui.selectedExerciseId ?? "");
    const list = attemptsByExercise.get(id) ?? [];
    if (list.length === 0) return { count: 0, bestMs: null as number | null, avgMs: null as number | null };
    const bestMs = Math.min(...list.map((x) => x.durationMs));
    const lastN = list.slice(-10);
    const avgMs = Math.round(lastN.reduce((acc, x) => acc + x.durationMs, 0) / Math.max(1, lastN.length));
    return { count: list.length, bestMs, avgMs };
  }, [attemptsByExercise, ui.selectedExerciseId]);

  const selected = useMemo(() => {
    const id = ui.selectedExerciseId;
    return exercises.find((e) => e.id === id) ?? exercisesFiltered[0] ?? exercises[0] ?? null;
  }, [exercises, exercisesFiltered, ui.selectedExerciseId]);

  useEffect(() => {
    dispatch(dictionTrainerUiActions.initDictionTrainerUi());
  }, [dispatch]);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 150);
    return () => window.clearInterval(t);
  }, [running]);

  const start = () => {
    if (!selected) return;
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setRunning(true);
  };

  const finish = () => {
    if (!selected) return;
    const durationMs = Math.max(0, Date.now() - startedAtRef.current);
    const attempt: DictionAttempt = {
      id: `att-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      exerciseId: selected.id,
      finishedAtIso: new Date().toISOString(),
      durationMs,
      note: note.trim() || undefined,
    };
    dispatch(dictionTrainerUiActions.addDictionAttempt({ attempt }));
    setRunning(false);
    setElapsedMs(0);
    setNote("");
  };

  return (
    <div className="app-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="trainers-view">
            <div className="trainer-row" style={{ justifyContent: "space-between" }}>
              <div>
                <h2 style={{ marginBottom: 0 }}>Дикция</h2>
                <p className="trainers-subtitle">Скороговорки + замеры попыток.</p>
              </div>
              <div className="trainer-row">
                <Button className="secondary" type="button" onClick={() => navigate("/profile")}>
                  Профиль
                </Button>
                <Button className="secondary" type="button" onClick={() => navigate("/trainers")}>
                  Все тренажёры
                </Button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <div className="trainer-card">
                <div className="trainer-card-title">Упражнение</div>
                <div style={{ marginTop: 8 }}>
                  <div className="trainer-row" style={{ marginBottom: 8 }}>
                    <button
                      type="button"
                      className="trainer-pill"
                      data-active={ui.selectedLevel === "all" ? "true" : "false"}
                      onClick={() => dispatch(dictionTrainerUiActions.setDictionSelectedLevel({ value: "all" }))}
                      disabled={running}
                    >
                      Все
                    </button>
                    <button
                      type="button"
                      className="trainer-pill"
                      data-active={ui.selectedLevel === 1 ? "true" : "false"}
                      onClick={() => dispatch(dictionTrainerUiActions.setDictionSelectedLevel({ value: 1 }))}
                      disabled={running}
                    >
                      Уровень 1
                    </button>
                    <button
                      type="button"
                      className="trainer-pill"
                      data-active={ui.selectedLevel === 2 ? "true" : "false"}
                      onClick={() => dispatch(dictionTrainerUiActions.setDictionSelectedLevel({ value: 2 }))}
                      disabled={running}
                    >
                      Уровень 2
                    </button>
                    <button
                      type="button"
                      className="trainer-pill"
                      data-active={ui.selectedLevel === 3 ? "true" : "false"}
                      onClick={() => dispatch(dictionTrainerUiActions.setDictionSelectedLevel({ value: 3 }))}
                      disabled={running}
                    >
                      Уровень 3
                    </button>
                  </div>
                  <select
                    className="settings-invite-input trainer-select"
                    value={selected?.id ?? ""}
                    onChange={(e) =>
                      dispatch(dictionTrainerUiActions.setDictionSelectedExercise({ value: e.target.value }))
                    }
                    disabled={running}
                  >
                    {(exercisesFiltered.length > 0 ? exercisesFiltered : exercises).map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} (ур. {ex.level})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="trainer-row" style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="trainer-pill"
                    data-active={ui.showText ? "true" : "false"}
                    onClick={() => dispatch(dictionTrainerUiActions.setDictionShowText({ value: !ui.showText }))}
                  >
                    {ui.showText ? "Текст: виден" : "Текст: скрыт"}
                  </button>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    Совет: сначала читай медленно и чётко, потом ускоряйся.
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    Попыток: <b>{selectedStats.count}</b>
                    {selectedStats.bestMs != null ? (
                      <>
                        {" "}
                        · лучшее: <b>{formatMs(selectedStats.bestMs)}</b>
                      </>
                    ) : null}
                    {selectedStats.avgMs != null ? (
                      <>
                        {" "}
                        · среднее (10): <b>{formatMs(selectedStats.avgMs)}</b>
                      </>
                    ) : null}
                  </div>
                </div>

                {ui.showText && selected ? (
                  <div style={{ marginTop: 10, fontSize: 14, lineHeight: "20px" }}>
                    “{selected.text}”
                  </div>
                ) : null}
              </div>

              <div className="trainer-card">
                <div className="trainer-card-title">Попытка</div>
                <div className="trainer-row" style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Время:</div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{formatMs(elapsedMs)}</div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <textarea
                    className="settings-invite-input"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Заметка (например: сбился на 2-й строке, ускорился к концу)…"
                    rows={3}
                    disabled={!running}
                    style={{ maxWidth: "unset", width: "100%" }}
                  />
                </div>
                <div className="trainer-row" style={{ marginTop: 10 }}>
                  {!running ? (
                    <Button className="primary" type="button" onClick={start} disabled={!selected}>
                      Старт
                    </Button>
                  ) : (
                    <Button className="primary" type="button" onClick={finish}>
                      Завершить и сохранить
                    </Button>
                  )}
                  {running ? (
                    <Button
                      className="danger"
                      type="button"
                      onClick={() => {
                        setRunning(false);
                        setElapsedMs(0);
                        setNote("");
                      }}
                    >
                      Сбросить
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="trainer-card">
                <div className="trainer-row" style={{ justifyContent: "space-between" }}>
                  <div className="trainer-card-title">История (последние 50)</div>
                  <Button
                    className="danger"
                    type="button"
                    onClick={() => dispatch(dictionTrainerUiActions.clearDictionAttempts())}
                    disabled={(ui.attempts ?? []).length === 0}
                  >
                    Очистить
                  </Button>
                </div>

                {(ui.attempts ?? []).length === 0 ? (
                  <div className="trainer-card-text">Пока пусто.</div>
                ) : (
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {[...(ui.attempts ?? [])]
                      .slice()
                      .reverse()
                      .slice(0, 12)
                      .map((a) => {
                        const ex = exercises.find((e) => e.id === a.exerciseId);
                        return (
                          <div
                            key={a.id}
                            style={{
                              border: "1px solid rgba(255,255,255,0.10)",
                              borderRadius: 10,
                              padding: 10,
                              background: "rgba(255,255,255,0.03)",
                              display: "grid",
                              gap: 6,
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 800 }}>
                              {ex?.title ?? a.exerciseId} · {formatMs(a.durationMs)} {ex?.level ? `(ур. ${ex.level})` : ""}
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.7 }}>
                              {new Date(a.finishedAtIso).toLocaleString("ru-RU")}
                            </div>
                            {a.note ? <div style={{ fontSize: 12, opacity: 0.85 }}>{a.note}</div> : null}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

