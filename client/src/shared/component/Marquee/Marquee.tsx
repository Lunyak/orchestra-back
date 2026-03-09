import { FC, useMemo } from "react";
import "./Marquee.css";

type MarqueeProps = {
  items: string[];
  className?: string;
  label?: string;
  /** seconds */
  duration?: number;
};

export const Marquee: FC<MarqueeProps> = ({
  items,
  className,
  label = "Бегущая строка",
  duration = 22,
}) => {
  const rootClassName = useMemo(() => {
    return ["marquee", className].filter(Boolean).join(" ");
  }, [className]);

  const content = useMemo(() => {
    const filtered = items.map((s) => s.trim()).filter(Boolean);
    return filtered.length ? filtered : ["…"];
  }, [items]);

  return (
    <div
      className={rootClassName}
      aria-label={label}
      style={{ ["--marquee-duration" as any]: `${duration}s` }}
    >
      <div className="marquee__viewport">
        <div className="marquee__track">
          <div className="marquee__content">
            {content.map((t, i) => (
              <span key={`${t}-${i}`} className="marquee__item">
                {t}
              </span>
            ))}
          </div>
          <div className="marquee__content" aria-hidden="true">
            {content.map((t, i) => (
              <span key={`${t}-${i}-dup`} className="marquee__item">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

