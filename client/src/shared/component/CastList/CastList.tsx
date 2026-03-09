import { FC } from "react";
import type { CastItem } from "../../model/showCast";
import "./CastList.css";

type CastListProps = {
  items: CastItem[];
  className?: string;
};

export const CastList: FC<CastListProps> = ({ items, className }) => {
  return (
    <dl className={className ? `cast-list ${className}` : "cast-list"}>
      {items.map((it) => (
        <div key={`${it.role}-${it.actor}`} className="cast-list__row">
          <dt className="cast-list__role">{it.role}</dt>
          <dd className="cast-list__actor">{it.actor}</dd>
        </div>
      ))}
    </dl>
  );
};

