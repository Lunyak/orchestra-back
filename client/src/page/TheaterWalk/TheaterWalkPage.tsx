import { Canvas } from "@react-three/fiber";
import { FC, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Seo } from "../../shared/component/Seo/Seo";
import { ROUTES } from "../../shared/model/routes";
import type { SiteEvent } from "../../shared/model/siteContent";
import { fetchSiteEvents, readSiteEventsCache } from "../../shared/model/siteContent";
import { TheaterScene } from "./TheaterScene";
import "./style.css";

const TheaterWalkPage: FC = () => {
  const [events, setEvents] = useState<SiteEvent[]>(() => readSiteEventsCache() ?? []);
  const [facing, setFacing] = useState("впереди · дальняя стена");
  const [showHelp, setShowHelp] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchSiteEvents()
      .then((remote) => {
        if (!alive) return;
        if (remote?.length) setEvents(remote);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="theater-walk">
      <Seo
        title="Театр 3D (эксперимент) — Дофамин"
        description="Экспериментальный 3D-холл театра «Дофамин»: афиша мелом и картины команды."
        canonicalPath="/театр"
        noindex
      />

      <div className="theater-walk__canvas">
        <Canvas
          dpr={[1, 1.5]}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl, events }) => {
            gl.domElement.style.touchAction = "none";
            gl.domElement.style.cursor = "grab";
            // Keep native pointer events on canvas for drag-look
            events.enabled = false;
          }}
          onPointerDown={() => setShowHelp(false)}
        >
          <TheaterScene events={events} onFacingChange={setFacing} />
        </Canvas>
      </div>

      <div className="theater-walk__hud">
        <div className="theater-walk__top">
          <Link to={ROUTES.HOME} className="theater-walk__btn">
            Выйти
          </Link>
          <div className="theater-walk__facing" aria-live="polite">
            смотришь: {facing}
          </div>
          <a
            href="https://xn--80ahnpgc6b.xn--p1acf/orkestr/"
            target="_blank"
            rel="noopener noreferrer"
            className="theater-walk__btn"
          >
            Soft Оркестр
          </a>
        </div>

        {showHelp && (
          <div className="theater-walk__help">
            <p className="theater-walk__help-title">Как ходить</p>
            <p className="theater-walk__help-text">
              <strong>ЛКМ зажать и тянуть</strong> — смотреть
              <br />
              <strong>WASD</strong> — ходить · <strong>R</strong> — на старт
              <br />
              Красная полоса / афиша — слева · стена чемоданов с актёрами — справа
            </p>
            <button
              type="button"
              className="theater-walk__btn"
              onClick={() => setShowHelp(false)}
            >
              Понятно
            </button>
          </div>
        )}

        <p className="theater-walk__hint">
          <strong>ЛКМ + тяни</strong> смотреть · <strong>WASD</strong> ходить · <strong>R</strong> старт
        </p>
      </div>
    </div>
  );
};

export const Component = TheaterWalkPage;
