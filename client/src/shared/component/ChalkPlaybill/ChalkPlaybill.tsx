import { FC, useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { ROUTES } from "../../model/routes";
import { siteAsset } from "../../model/siteAssets";
import type { SiteEvent } from "../../model/siteContent";

const AFISHA_DESKTOP_QUERY = "(min-width: 900px)";

type ChalkPlaybillProps = {
  items: SiteEvent[];
  loading: boolean;
  className?: string;
};

function useAfishaDesktop() {
  const read = () => window.matchMedia(AFISHA_DESKTOP_QUERY).matches;
  const [enabled, setEnabled] = useState(read);

  useEffect(() => {
    const desktop = window.matchMedia(AFISHA_DESKTOP_QUERY);
    const sync = () => setEnabled(desktop.matches);
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, []);

  return enabled;
}

export const ChalkPlaybill: FC<ChalkPlaybillProps> = ({ items, loading, className }) => {
  const isEmpty = items.length === 0;
  const isDesktop = useAfishaDesktop();
  const [hovered, setHovered] = useState<SiteEvent | null>(null);

  return (
    <section className={cn("chalk-playbill", className)} aria-label="Афиша спектаклей">
      {loading ? (
        <p className="chalk-playbill__status" role="status">
          Загрузка афиши…
        </p>
      ) : isEmpty ? (
        <p className="chalk-playbill__status" role="status">
          Не удалось загрузить афишу. Проверьте соединение и обновите страницу.
        </p>
      ) : (
        <>
          <div className="chalk-playbill__list" role="list">
            {items.map((event) => (
              <PlaybillRow
                key={event.slug}
                event={event}
                onHover={isDesktop ? setHovered : undefined}
              />
            ))}
          </div>
          <p className="chalk-playbill__hint">билеты — на странице спектакля</p>
        </>
      )}
      {isDesktop && hovered && <AfishaHoverBoard event={hovered} />}
    </section>
  );
};

function PlaybillRow({
  event,
  onHover,
}: {
  event: SiteEvent;
  onHover?: (event: SiteEvent | null) => void;
}) {
  const title = event.name?.trim() || "Спектакль";
  const dateLabel = event.soon
    ? "скоро"
    : event.date?.trim() || event.type?.trim() || "дата уточняется";
  const ageLabel = event.old?.trim();
  const isSoon = event.soon;
  const rowClassName = cn("chalk-playbill__row", isSoon && "chalk-playbill__row--soon");

  const posterSource = event.listImage?.trim() || event.cardImage;
  const poster = posterSource ? siteAsset(posterSource) : "";

  const content = (
    <>
      {poster && (
        <span className="chalk-playbill__poster-wrap">
          <img className="chalk-playbill__poster" src={poster} alt="" />
          {isSoon && <span className="chalk-playbill__soon">скоро</span>}
          {ageLabel && <span className="chalk-playbill__age">{ageLabel}</span>}
        </span>
      )}
      <div className="chalk-playbill__main">
        {ageLabel && <span className="chalk-playbill__badge">{ageLabel}</span>}
        <span className="chalk-playbill__title">{title}</span>
      </div>
      <span className="chalk-playbill__date">{dateLabel}</span>
    </>
  );

  if (isSoon) {
    return (
      <div
        className={rowClassName}
        role="listitem"
        aria-label={`${title}, скоро`}
        onMouseEnter={onHover ? () => onHover(event) : undefined}
        onMouseLeave={onHover ? (mouseEvent) => leaveRow(mouseEvent, onHover) : undefined}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      to={`/${ROUTES.EVENTS}/${encodeURIComponent(event.slug)}`}
      className={rowClassName}
      role="listitem"
      aria-label={`${title}, ${dateLabel}`}
      onMouseEnter={onHover ? () => onHover(event) : undefined}
      onMouseLeave={onHover ? (mouseEvent) => leaveRow(mouseEvent, onHover) : undefined}
    >
      {content}
    </Link>
  );
}

function leaveRow(mouseEvent: MouseEvent, onHover: (event: SiteEvent | null) => void) {
  const next = mouseEvent.relatedTarget;
  if (next instanceof Element && next.closest(".chalk-afisha-board")) return;
  onHover(null);
}

function AfishaHoverBoard({ event }: { event: SiteEvent }) {
  const title = event.name?.trim() || "Спектакль";
  const poster = event.sideImage ? siteAsset(event.sideImage) : "";
  const tint = colorToCss(event.colorBackground);

  useEffect(() => {
    if (!tint) return;
    const scene = document.querySelector(".chalk-flip");
    const target = scene instanceof HTMLElement ? scene : document.documentElement;
    target.style.setProperty("--afisha-page-bg", tint);
    return () => {
      target.style.removeProperty("--afisha-page-bg");
    };
  }, [tint]);

  if (!poster) return null;

  return createPortal(
    <div className="chalk-afisha-board">
      <div className="chalk-afisha-board__poster chalk-afisha-board__poster--left">
        {poster && <img className="chalk-afisha-board__img" src={poster} alt="" />}
      </div>
      <div className="chalk-afisha-board__poster chalk-afisha-board__poster--right">
        {poster && <img className="chalk-afisha-board__img" src={poster} alt={title} />}
      </div>
    </div>,
    document.body
  );
}

function colorToCss(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  const color = value & 0xffffff;
  const red = (color >> 16) & 255;
  const green = (color >> 8) & 255;
  const blue = color & 255;
  return `rgba(${red}, ${green}, ${blue}, 0.2)`;
}
