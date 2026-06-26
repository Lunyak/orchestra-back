import { useEffect, useMemo, useRef, useState } from "react";

import type { LightCue, ScriptScene, TheaterSpotlight } from "../../types/script";

import { LightChannelSelect } from "../../../features/theater/ui/LightChannelSelect";

import {

  normalizeLightCues,

  resolveSpotlightsAtLightCueTime,

  stepDurationSec,

} from "../../../features/theater/model/theater-light-cues";



export type LightCueTimelineProps = {

  lightChannels: string[];

  durationMin?: number | null;

  cues: LightCue[];

  spotlights: TheaterSpotlight[];

  disabled?: boolean;

  onChangeCues: (next: LightCue[]) => void;

  onApplyPreview: (spotlights: TheaterSpotlight[]) => void;

};



export function LightCueTimeline({

  lightChannels,

  durationMin,

  cues,

  spotlights,

  disabled,

  onChangeCues,

  onApplyPreview,

}: LightCueTimelineProps) {

  const durationSec = stepDurationSec(durationMin);

  const normalized = useMemo(() => normalizeLightCues(cues), [cues]);

  const [scrubSec, setScrubSec] = useState(0);

  const [playing, setPlaying] = useState(false);

  const [loop, setLoop] = useState(false);

  const playStartedRef = useRef<number | null>(null);

  const playFromRef = useRef(0);
  const scrubSecRef = useRef(scrubSec);
  scrubSecRef.current = scrubSec;

  useEffect(() => {
    if (!playing || disabled) return undefined;

    playStartedRef.current = performance.now();
    playFromRef.current = scrubSecRef.current;



    const tick = () => {

      const elapsed = (performance.now() - (playStartedRef.current ?? 0)) / 1000;

      let nextSec = playFromRef.current + elapsed;

      if (nextSec >= durationSec) {

        if (loop) {

          playStartedRef.current = performance.now();

          playFromRef.current = 0;

          nextSec = 0;

        } else {

          setPlaying(false);

          setScrubSec(durationSec);

          onApplyPreview(

            resolveSpotlightsAtLightCueTime(spotlights, normalized, durationSec),

          );

          return;

        }

      }

      setScrubSec(Math.floor(nextSec));

      onApplyPreview(resolveSpotlightsAtLightCueTime(spotlights, normalized, nextSec));

      frameRef.current = requestAnimationFrame(tick);

    };



    const frameRef = { current: requestAnimationFrame(tick) };

    return () => {

      if (frameRef.current != null) {

        cancelAnimationFrame(frameRef.current);

      }

    };

  }, [disabled, durationSec, loop, normalized, onApplyPreview, playing, spotlights]);



  useEffect(() => {

    if (scrubSec > durationSec) {

      setScrubSec(durationSec);

    }

  }, [durationSec, scrubSec]);



  const addCue = () => {

    const nextId = normalized.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;

    const next: LightCue = {

      id: nextId,

      tSec: scrubSec,

      channel: "1",

      intensity: 1,

      enabled: true,

    };

    onChangeCues([...normalized, next]);

  };



  const updateCue = (id: number, patch: Partial<LightCue>) => {

    onChangeCues(

      normalized.map((item) => (item.id === id ? { ...item, ...patch } : item)),

    );

  };



  const removeCue = (id: number) => {

    onChangeCues(normalized.filter((item) => item.id !== id));

  };



  const applyAtScrub = () => {

    onApplyPreview(resolveSpotlightsAtLightCueTime(spotlights, normalized, scrubSec));

  };



  return (

    <div className="light-cue-timeline">

      <div className="light-cue-timeline-header">

        <span>Таймлайн света</span>

        <span className="light-cue-timeline-meta">

          0–{durationSec} с

          {typeof durationMin === "number" && durationMin > 0

            ? ` (сцена ${durationMin} мин)`

            : ""}

        </span>

      </div>

      <div className="light-cue-scrub">

        <input

          type="range"

          min={0}

          max={durationSec}

          step={1}

          value={scrubSec}

          disabled={disabled || playing}

          onChange={(event) => setScrubSec(Number(event.target.value))}

        />

        <span>{scrubSec} с</span>

        <button

          type="button"

          disabled={disabled}

          onClick={() => setPlaying((prev) => !prev)}

        >

          {playing ? "Пауза" : "▶"}

        </button>

        <label className="light-cue-loop">

          <input

            type="checkbox"

            checked={loop}

            disabled={disabled}

            onChange={(event) => setLoop(event.target.checked)}

          />

          loop

        </label>

        <button type="button" disabled={disabled} onClick={applyAtScrub}>

          Превью 3D

        </button>

        <button type="button" disabled={disabled} onClick={addCue}>

          + Cue

        </button>

      </div>

      <div className="light-cue-track">

        {normalized.map((cue) => {

          const left = durationSec > 0 ? (cue.tSec / durationSec) * 100 : 0;

          return (

            <button

              key={cue.id}

              type="button"

              className="light-cue-marker"

              style={{ left: `${Math.min(100, Math.max(0, left))}%` }}

              title={`${cue.tSec}с · канал ${cue.channel}`}

              disabled={disabled}

              onClick={() => setScrubSec(cue.tSec)}

            />

          );

        })}

      </div>

      <div className="light-cue-list">

        {normalized.length === 0 ? (

          <p className="light-cue-empty">Cue не заданы — добавьте ключевые моменты света</p>

        ) : (

          normalized.map((cue) => (

            <div key={cue.id} className="light-cue-row">

              <input

                type="number"

                min={0}

                max={durationSec}

                step={1}

                value={cue.tSec}

                disabled={disabled}

                onChange={(event) =>

                  updateCue(cue.id, { tSec: Math.max(0, Number(event.target.value) || 0) })

                }

              />

              <LightChannelSelect

                lightChannels={lightChannels}

                value={cue.channel}

                allowEmpty={false}

                disabled={disabled}

                onChange={(channel) => updateCue(cue.id, { channel })}

                className="light-cue-channel-select"

              />

              <input

                type="number"

                min={0}

                max={2}

                step={0.1}

                value={cue.intensity ?? 1}

                disabled={disabled}

                onChange={(event) =>

                  updateCue(cue.id, {

                    intensity: Math.max(0, Number(event.target.value) || 0),

                  })

                }

              />

              <label className="light-cue-enabled">

                <input

                  type="checkbox"

                  checked={cue.enabled !== false}

                  disabled={disabled}

                  onChange={(event) => updateCue(cue.id, { enabled: event.target.checked })}

                />

                вкл

              </label>

              <button type="button" disabled={disabled} onClick={() => removeCue(cue.id)}>

                ×

              </button>

            </div>

          ))

        )}

      </div>

    </div>

  );

}



export function readSceneLightCues(scene: Pick<ScriptScene, "lightCues"> | undefined): LightCue[] {

  return normalizeLightCues(scene?.lightCues ?? []);

}

