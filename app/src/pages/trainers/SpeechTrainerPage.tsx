import { Button } from "@shared/core/button/Button";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../shared/store/hooks";
import {
  type ReadingPresetId,
  selectSpeechTrainerUi,
  speechTrainerUiActions,
  type SpeechMode,
} from "../../features/trainers/model/speechTrainerUiSlice";
import { TrainerDevNotice } from "../../features/trainers/ui/TrainerDevNotice";
import "./style.css";

type Phase = { label: string; seconds: number };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function createClick(ctx: AudioContext) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "square";
  o.frequency.value = 1200;
  g.gain.value = 0;
  o.connect(g);
  g.connect(ctx.destination);
  o.start();
  return {
    fire() {
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(0.0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.002);
      g.gain.linearRampToValueAtTime(0.0, t + 0.03);
    },
    stop() {
      try {
        o.stop();
      } catch {}
      try {
        o.disconnect();
        g.disconnect();
      } catch {}
    },
  };
}

export function SpeechTrainerPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const ui = useAppSelector(selectSpeechTrainerUi);

  useEffect(() => {
    dispatch(speechTrainerUiActions.initSpeechTrainerUi());
  }, [dispatch]);

  const setMode = (value: SpeechMode) => dispatch(speechTrainerUiActions.setSpeechMode({ value }));

  const phases: Phase[] = useMemo(
    () => [
      { label: "Вдох", seconds: 4 },
      { label: "Задержка", seconds: 2 },
      { label: "Выдох", seconds: 6 },
    ],
    [],
  );

  const [breathingOn, setBreathingOn] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [phaseLeft, setPhaseLeft] = useState(phases[0]?.seconds ?? 0);

  useEffect(() => {
    if (!breathingOn) return;
    const t = window.setInterval(() => {
      setPhaseLeft((prev) => {
        const next = prev - 1;
        if (next > 0) return next;
        setPhaseIdx((pi) => (pi + 1) % phases.length);
        return phases[(phaseIdx + 1) % phases.length]?.seconds ?? 0;
      });
    }, 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breathingOn, phases.length, phaseIdx]);

  useEffect(() => {
    if (!breathingOn) return;
    setPhaseLeft(phases[phaseIdx]?.seconds ?? 0);
  }, [breathingOn, phaseIdx, phases]);

  const [metroReady, setMetroReady] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const clickRef = useRef<ReturnType<typeof createClick> | null>(null);
  const metroTimerRef = useRef<number | null>(null);

  const stopMetronome = () => {
    if (metroTimerRef.current != null) {
      window.clearInterval(metroTimerRef.current);
      metroTimerRef.current = null;
    }
    try {
      clickRef.current?.stop();
    } catch {}
    clickRef.current = null;
    try {
      audioCtxRef.current?.close();
    } catch {}
    audioCtxRef.current = null;
    setMetroReady(false);
    dispatch(speechTrainerUiActions.setSpeechMetronomeOn({ value: false }));
  };

  const startMetronome = async () => {
    if (typeof window === "undefined") return;
    stopMetronome();
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;
    const click = createClick(ctx);
    clickRef.current = click;
    setMetroReady(true);

    const bpm = clamp(ui.metronomeBpm, 30, 220);
    const intervalMs = Math.round((60_000 / bpm) * 1);
    click.fire();
    metroTimerRef.current = window.setInterval(() => {
      click.fire();
    }, intervalMs);
    dispatch(speechTrainerUiActions.setSpeechMetronomeOn({ value: true }));
  };

  useEffect(() => {
    // If BPM changes while running — restart metronome.
    if (!ui.metronomeOn) return;
    void startMetronome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.metronomeBpm]);

  useEffect(() => {
    return () => {
      stopMetronome();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const presets = useMemo(
    () =>
      [
        {
          id: "base" as const,
          title: "База",
          plain:
            "Говори спокойно и опирайся на дыхание. Делай паузы после смысловых кусков. " +
            "Темп важнее громкости: сначала чётко, потом быстрее.",
          pauses:
            "Говори спокойно || и опирайся на дыхание. || Делай паузы || после смысловых кусков. " +
            "|| Темп важнее громкости: || сначала чётко, || потом быстрее.",
          stresses:
            "Говори споко́йно и опира́йся на дыха́ние. Де́лай пау́зы после смысловы́х куско́в. " +
            "Те́мп ва́жнее гро́мкости: сна́чала чётко, пото́м бы́стрее.",
        },
        {
          id: "stage" as const,
          title: "Сцена",
          plain:
            "Я выхожу на сцену и держу внимание. Я слышу партнёра и отвечаю точно. " +
            "Я знаю, зачем говорю эту фразу.",
          pauses:
            "Я выхо́жу на сце́ну || и держу́ внима́ние. || Я слы́шу партнёра || и отвеча́ю то́чно. " +
            "|| Я зна́ю, || заче́м говорю́ э́ту фра́зу.",
          stresses:
            "Я выхо́жу на сце́ну и держу́ внима́ние. Я слы́шу партнёра и отвеча́ю то́чно. " +
            "Я зна́ю, заче́м говорю́ э́ту фра́зу.",
        },
        {
          id: "news" as const,
          title: "Диктор",
          plain:
            "Сегодня мы подводим итоги репетиционного дня. Впереди — работа с ритмом, паузами и точностью подачи.",
          pauses:
            "Сего́дня || мы подводим ито́ги || репетицио́нного дня. || Впереди́ — || работа́ с ри́тмом, || пау́зами || и то́чностью пода́чи.",
          stresses:
            "Сего́дня мы подводи́м ито́ги репетицио́нного дня. Впереди́ — работа́ с ри́тмом, пау́зами и то́чностью пода́чи.",
        },
      ] as const,
    [],
  );

  const preset = useMemo(() => {
    return presets.find((p) => p.id === ui.presetId) ?? presets[0]!;
  }, [presets, ui.presetId]);

  const readingText = useMemo(() => {
    const withStresses = ui.showStresses ? preset.stresses : preset.plain;
    const base = withStresses;
    if (!ui.showPauses) return base;
    // if showPauses is on — prefer explicit pause-marked version (keeps stress marks too).
    const paused = ui.showStresses ? preset.pauses : preset.pauses;
    return paused;
  }, [preset.pauses, preset.plain, preset.stresses, ui.showPauses, ui.showStresses]);

  const setPreset = (value: ReadingPresetId) =>
    dispatch(speechTrainerUiActions.setSpeechPresetId({ value }));

  return (
    <div className="app-layout trainers-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="trainers-view">
            <TrainerDevNotice />

            <div className="trainers-tab-head trainers-row--spread">
              <div>
                <div className="trainers-tab-title">Речь</div>
                <p className="trainers-lead">Дыхание + чтение с темпом (метроном).</p>
              </div>
              <div className="trainers-toolbar">
                <Button className="secondary" type="button" onClick={() => navigate("/profile")}>
                  Профиль
                </Button>
                <Button className="secondary" type="button" onClick={() => navigate("/trainers")}>
                  Все тренажёры
                </Button>
              </div>
            </div>

            <div className="trainers-row trainers-row--mt">
              <button
                type="button"
                className="trainer-pill"
                data-active={ui.mode === "breathing" ? "true" : "false"}
                onClick={() => setMode("breathing")}
              >
                Дыхание
              </button>
              <button
                type="button"
                className="trainer-pill"
                data-active={ui.mode === "reading" ? "true" : "false"}
                onClick={() => setMode("reading")}
              >
                Чтение
              </button>
              <button
                type="button"
                className="trainer-pill"
                data-active={ui.showText ? "true" : "false"}
                onClick={() => dispatch(speechTrainerUiActions.setSpeechShowText({ value: !ui.showText }))}
              >
                {ui.showText ? "Текст: виден" : "Текст: скрыт"}
              </button>
            </div>

            {ui.mode === "breathing" ? (
              <div className="trainer-card trainers-row--mt">
                <div className="trainer-card-title">Цикл</div>
                <div className="trainer-card-text">
                  Упрощённый цикл: вдох 4с → задержка 2с → выдох 6с. Держи плечи свободными.
                </div>

                <div className="trainers-phase">
                  Фаза: <b>{phases[phaseIdx]?.label ?? "—"}</b> · осталось: <b>{phaseLeft}s</b>
                </div>

                <div className="trainers-row trainers-row--mt">
                  {!breathingOn ? (
                    <Button
                      type="button"
                      onClick={() => {
                        setPhaseIdx(0);
                        setPhaseLeft(phases[0]?.seconds ?? 0);
                        setBreathingOn(true);
                      }}
                    >
                      Старт
                    </Button>
                  ) : (
                    <Button
                      className="danger"
                      type="button"
                      onClick={() => {
                        setBreathingOn(false);
                        setPhaseIdx(0);
                        setPhaseLeft(phases[0]?.seconds ?? 0);
                      }}
                    >
                      Стоп
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="trainer-card trainers-row--mt">
                <div className="trainer-card-title">Чтение: темп, паузы, ударения</div>
                <div className="trainer-card-text">
                  Включи метроном и читай текст на темп. Для паузировки используй маркер <b>||</b>. Если “сыпется”
                  дикция — снизь BPM.
                </div>

                <div className="trainers-row trainers-row--mt">
                  <span className="trainers-field-label">Текст</span>
                  <select
                    className="settings-invite-input"
                    value={preset.id}
                    onChange={(e) => {
                      const v = String(e.target.value ?? "");
                      if (v === "base" || v === "stage" || v === "news") setPreset(v);
                    }}
                  >
                    {presets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="trainer-pill"
                    data-active={ui.showPauses ? "true" : "false"}
                    onClick={() => dispatch(speechTrainerUiActions.setSpeechShowPauses({ value: !ui.showPauses }))}
                  >
                    {ui.showPauses ? "Паузы: вкл" : "Паузы"}
                  </button>
                  <button
                    type="button"
                    className="trainer-pill"
                    data-active={ui.showStresses ? "true" : "false"}
                    onClick={() =>
                      dispatch(speechTrainerUiActions.setSpeechShowStresses({ value: !ui.showStresses }))
                    }
                  >
                    {ui.showStresses ? "Ударения: вкл" : "Ударения"}
                  </button>
                </div>

                <div className="trainers-row trainers-row--mt">
                  <span className="trainers-field-label">BPM</span>
                  <input
                    type="range"
                    min={30}
                    max={220}
                    value={ui.metronomeBpm}
                    onChange={(e) =>
                      dispatch(speechTrainerUiActions.setSpeechMetronomeBpm({ value: Number(e.target.value) }))
                    }
                  />
                  <span className="trainers-timer">{ui.metronomeBpm}</span>
                  {!ui.metronomeOn ? (
                    <Button type="button" onClick={startMetronome}>
                      Включить
                    </Button>
                  ) : (
                    <Button className="danger" type="button" onClick={stopMetronome}>
                      Выключить
                    </Button>
                  )}
                  {ui.metronomeOn && metroReady ? (
                    <span className="trainers-stat">играет…</span>
                  ) : null}
                </div>

                {ui.showText ? <div className="trainers-reading-text">“{readingText}”</div> : null}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

