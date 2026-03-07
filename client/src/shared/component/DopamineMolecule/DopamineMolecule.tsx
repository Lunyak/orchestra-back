import { FC } from "react";
import "./DopamineMolecule.css";

interface DopamineMoleculeProps {
  className?: string;
  width?: number;
  height?: number;
}

/**
 * Молекула дофамина (3,4-дигидроксифенилэтиламин):
 * бензольное кольцо (катехол) с двумя OH + цепь -CH2-CH2-NH2.
 * Один непрерывный path для анимации «заряда» по всей структуре.
 */
const DopamineMolecule: FC<DopamineMoleculeProps> = ({
  className = "",
  width = 120,
  height = 140,
}) => {
  const vb = "0 0 100 120";
  const r = 22;
  const cx = 50;
  const cy = 48;

  // Вершины шестиугольника (кольцо), начиная с верхней
  const hex = [
    [cx, cy - r],
    [cx + r * 0.866, cy - r * 0.5],
    [cx + r * 0.866, cy + r * 0.5],
    [cx, cy + r],
    [cx - r * 0.866, cy + r * 0.5],
    [cx - r * 0.866, cy - r * 0.5],
  ];

  // Цепь от верхней вершины вниз: N — C — C — кольцо
  const n = [50, 12];
  const c1 = [50, 28];
  const c2 = [50, 40];
  const topRing = hex[0];

  // Два OH от правых вершин кольца
  const o1 = [78, 34];
  const o2 = [78, 62];
  const ringRightTop = hex[1];
  const ringRightBottom = hex[2];

  // Единый path для анимации заряда: обходим всю молекулу
  const chargePath = [
    `M ${n[0]} ${n[1]}`,
    `L ${c1[0]} ${c1[1]}`,
    `L ${c2[0]} ${c2[1]}`,
    `L ${topRing[0]} ${topRing[1]}`,
    `L ${ringRightTop[0]} ${ringRightTop[1]}`,
    `L ${o1[0]} ${o1[1]}`,
    `L ${ringRightTop[0]} ${ringRightTop[1]}`,
    `L ${ringRightBottom[0]} ${ringRightBottom[1]}`,
    `L ${o2[0]} ${o2[1]}`,
    `L ${ringRightBottom[0]} ${ringRightBottom[1]}`,
    `L ${hex[3][0]} ${hex[3][1]}`,
    `L ${hex[4][0]} ${hex[4][1]}`,
    `L ${hex[5][0]} ${hex[5][1]}`,
    `L ${topRing[0]} ${topRing[1]}`,
  ].join(" ");

  return (
    <svg
      className={`dopamine-molecule ${className}`}
      viewBox={vb}
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="dopamine-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Фоновая обводка пути (статичная) */}
      <path
        className="dopamine-molecule__structure"
        d={chargePath}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Пульсирующий заряд — движется по пути */}
      <path
        className="dopamine-molecule__pulse"
        d={chargePath}
        pathLength="520"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#dopamine-glow)"
      />

      {/* Атомы: круги в узлах */}
      {[n, c1, c2, ...hex, o1, o2].map(([x, y], i) => (
        <circle
          key={i}
          className="dopamine-molecule__atom"
          cx={x}
          cy={y}
          r={i < 3 || i >= 9 ? 5 : 6}
        />
      ))}
    </svg>
  );
};

export default DopamineMolecule;
