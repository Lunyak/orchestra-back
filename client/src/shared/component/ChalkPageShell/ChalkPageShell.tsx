import { FC, ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { ROUTES } from "../../model/routes";
import "../../styles/chalk-page.css";

const ORKESTR_URL = "https://xn--80ahnpgc6b.xn--p1acf/orkestr/";

const CHALK_NAV_ON_BOARD = [
  { key: "team", label: "Команда", to: ROUTES.ABOUTUS },
  { key: "contacts", label: "Контакты", to: ROUTES.CONTACTS },
  { key: "theater", label: "3D холл", disabled: true },
] as const;

type ChalkPageShellProps = {
  children: ReactNode;
  mainClassName?: string;
  scrollable?: boolean;
  showHomeBack?: boolean;
  homeBackTo?: string;
  homeBackLabel?: string;
};

export const ChalkPageShell: FC<ChalkPageShellProps> = ({
  children,
  mainClassName,
  scrollable = false,
  showHomeBack = false,
  homeBackTo,
  homeBackLabel = "На главную",
}) => {
  return (
    <div className="chalk-page">
      <svg className="chalk-page__filters" aria-hidden focusable="false">
        <defs>
          <filter id="chalk-page-text-rough" x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" result="noise" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="1.8"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <div className={cn("chalk-page__stage", scrollable && "chalk-page__stage--scroll")}>
        <div className="chalk-page__wear" aria-hidden />

        <div className="chalk-page__nav-block chalk-page__nav-block--left">
          <nav className="chalk-page__nav" aria-label="Разделы сайта">
            {CHALK_NAV_ON_BOARD.map((item) => {
              if (!("to" in item)) {
                return (
                  <span
                    key={item.key}
                    className={cn("chalk-page__nav-link", "chalk-page__nav-link--blocked")}
                    aria-disabled="true"
                    title="Скоро"
                  >
                    {item.label}
                  </span>
                );
              }

              return (
                <Link key={item.key} to={item.to} className="chalk-page__nav-link">
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {showHomeBack && (
            <Link
              to={homeBackTo ?? ROUTES.HOME}
              className="chalk-page__home-back"
              aria-label={homeBackLabel}
            >
              <span className="chalk-page__home-back-mark" aria-hidden>
                ←
              </span>
            </Link>
          )}
        </div>

        <nav className="chalk-page__nav chalk-page__nav--board-right" aria-label="Оркестр">
          <a
            href={ORKESTR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="chalk-page__nav-link"
          >
            Оркестр
          </a>
        </nav>

        <main className={cn("chalk-page__main", mainClassName)}>{children}</main>
      </div>
    </div>
  );
};
