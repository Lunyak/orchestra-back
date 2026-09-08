import { useState, type PointerEvent } from "react";
import cn from "classnames";
import {
  startTheaterCameraNav,
  stopTheaterCameraNav,
  type TheaterCameraNavDirection,
  type TheaterCameraNavMode,
} from "../model/theater-camera-nav";

const DIRS: {
  id: TheaterCameraNavDirection;
  label: string;
  btnClass: string;
  glyphClass: string;
}[] = [
  {
    id: "up",
    label: "Вверх",
    btnClass: "theater-camera-nav__btn--up",
    glyphClass: "theater-camera-nav__glyph--up",
  },
  {
    id: "left",
    label: "Влево",
    btnClass: "theater-camera-nav__btn--left",
    glyphClass: "theater-camera-nav__glyph--left",
  },
  {
    id: "right",
    label: "Вправо",
    btnClass: "theater-camera-nav__btn--right",
    glyphClass: "theater-camera-nav__glyph--right",
  },
  {
    id: "down",
    label: "Вниз",
    btnClass: "theater-camera-nav__btn--down",
    glyphClass: "theater-camera-nav__glyph--down",
  },
];

export function TheaterCameraNavPad() {
  const [mode, setMode] = useState<TheaterCameraNavMode>("pan");
  const [held, setHeld] = useState<TheaterCameraNavDirection | null>(null);

  const begin = (
    event: PointerEvent<HTMLButtonElement>,
    direction: TheaterCameraNavDirection,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setHeld(direction);
    startTheaterCameraNav(mode, direction);
  };

  const end = () => {
    setHeld(null);
    stopTheaterCameraNav();
  };

  return (
    <div className="theater-camera-nav" aria-label="Навигация камеры">
      <div className="theater-camera-nav__modes" role="group" aria-label="Режим">
        <button
          type="button"
          className={cn(
            "theater-camera-nav__mode",
            mode === "pan" && "is-active",
          )}
          onClick={() => setMode("pan")}
        >
          Сдвиг
        </button>
        <button
          type="button"
          className={cn(
            "theater-camera-nav__mode",
            mode === "orbit" && "is-active",
          )}
          onClick={() => setMode("orbit")}
        >
          Разворот
        </button>
      </div>
      <div className="theater-camera-nav__pad">
        {DIRS.map((dir) => (
          <button
            key={dir.id}
            type="button"
            aria-label={dir.label}
            title={dir.label}
            className={cn(
              "theater-camera-nav__btn",
              dir.btnClass,
              held === dir.id && "is-active",
            )}
            onPointerDown={(event) => begin(event, dir.id)}
            onPointerUp={end}
            onPointerCancel={end}
          >
            <svg
              viewBox="0 0 24 24"
              className={cn("theater-camera-nav__glyph", dir.glyphClass)}
              aria-hidden
            >
              <path d="M12 5 L19 15 H5 Z" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
