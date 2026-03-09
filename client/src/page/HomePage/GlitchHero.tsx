import { FC } from "react";
import "./glitch-hero.css";

type GlitchHeroProps = {
  text?: string;
  as?: "div" | "h1" | "h2";
  className?: string;
};

export const GlitchHero: FC<GlitchHeroProps> = ({
  text = "Дофамин",
  as = "div",
  className,
}) => {
  const Tag = as;
  return (
    <Tag
      className={className ? `home-page__glitch-hero ${className}` : "home-page__glitch-hero"}
      aria-label={`${text}.`}
    >
      <div className="home-glitch__card">
        <div className="home-glitch__container">
          <div className="home-glitch__text" data-text={text}>
            <span className="home-glitch__textBase">{text}</span>
            <span className="home-glitch__textScan" data-text={text} aria-hidden>
              {text}
            </span>
          </div>
        </div>
      </div>
    </Tag>
  );
};

