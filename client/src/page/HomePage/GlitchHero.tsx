import { FC } from "react";
import "./glitch-hero.css";

type GlitchHeroProps = {
  text?: string;
  as?: "div" | "h1" | "h2";
  className?: string;
  /** Треугольник вместо первой буквы «Д» */
  triangleForD?: boolean;
};

const TriangleMark = () => (
  <svg
    className="home-glitch__triangle"
    viewBox="0 0 64 56"
    fill="none"
    aria-hidden
  >
    <path
      d="M32 4 L60 52 H4 Z"
      stroke="currentColor"
      strokeWidth="5.5"
      strokeLinejoin="miter"
    />
  </svg>
);

function resolveDisplay(text: string, triangleForD: boolean) {
  const shouldReplace =
    triangleForD &&
    (text.startsWith("Д") ||
      text.startsWith("д") ||
      text.startsWith("D") ||
      text.startsWith("d"));

  if (!shouldReplace) {
    return { visible: text, showTriangle: false };
  }

  return { visible: text.slice(1), showTriangle: true };
}

export const GlitchHero: FC<GlitchHeroProps> = ({
  text = "ДОФАМИН",
  as = "div",
  className,
  triangleForD = false,
}) => {
  const Tag = as;
  const { visible, showTriangle } = resolveDisplay(text, triangleForD);
  const rootClass = className
    ? `home-page__glitch-hero ${className}`
    : "home-page__glitch-hero";
  const textClass = showTriangle
    ? "home-glitch__text home-glitch__text--with-mark"
    : "home-glitch__text";

  return (
    <Tag className={rootClass} aria-label={`${text}.`}>
      <div className="home-glitch__card">
        <div className="home-glitch__container">
          <div className={textClass}>
            {showTriangle && <TriangleMark />}
            <span className="home-glitch__letters" data-text={visible}>
              <span className="home-glitch__textBase">{visible}</span>
              <span className="home-glitch__textScan" aria-hidden>
                {visible}
              </span>
            </span>
          </div>
        </div>
      </div>
    </Tag>
  );
};
