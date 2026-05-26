import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { TheaterLayout } from "../../../shared/types/script";
import {
  applyHallLayoutFromCustomOutline,
  applySeatCountToLayout,
  applyTheaterHallTemplate,
  fitCustomLayoutToSeatCount,
  THEATER_HALL_TEMPLATES,
} from "../model/theater-hall-templates";

export type UseTheaterHallLayoutArgs = {
  layout: TheaterLayout;
  onTheaterLayoutChange?: Dispatch<SetStateAction<TheaterLayout>>;
  setDecorActionMessage: (message: string | null) => void;
};

export function useTheaterHallLayout({
  layout,
  onTheaterLayoutChange,
  setDecorActionMessage,
}: UseTheaterHallLayoutArgs) {
  const applyHallTemplate = useCallback(
    (templateId: string) => {
      const next = applyTheaterHallTemplate(layout, templateId);
      onTheaterLayoutChange?.(next);
      const template = THEATER_HALL_TEMPLATES.find((item) => item.id === templateId);
      setDecorActionMessage(
        template ? `Шаблон зала: ${template.label}` : "Шаблон зала применён",
      );
    },
    [layout, onTheaterLayoutChange, setDecorActionMessage],
  );

  const fitLayoutToSeatCount = useCallback(
    (targetSeats: number) => {
      const seats = Math.max(0, Math.trunc(targetSeats));
      const next = fitCustomLayoutToSeatCount(layout, seats);
      onTheaterLayoutChange?.(next);
      const rows = next.seatRows ?? 0;
      const perRow = next.seatsPerRow ?? 0;
      const total = rows * perRow;
      setDecorActionMessage(
        seats > 0
          ? `Зал ~${total} мест (${rows}×${perRow}), контур масштабирован`
          : `Зал без кресел, контур масштабирован`,
      );
    },
    [layout, onTheaterLayoutChange, setDecorActionMessage],
  );

  const applyTargetSeatCount = useCallback(
    (targetSeats: number) => {
      const seats = Math.max(0, Math.trunc(targetSeats));
      const next = applySeatCountToLayout(layout, seats);
      onTheaterLayoutChange?.(next);
      const rows = next.seatRows ?? 0;
      const perRow = next.seatsPerRow ?? 0;
      const total = rows * perRow;
      setDecorActionMessage(
        seats > 0
          ? `Сетка кресел: ${rows}×${perRow} = ${total} мест`
          : "Кресла отключены (0 рядов)",
      );
    },
    [layout, onTheaterLayoutChange, setDecorActionMessage],
  );

  const fitLayoutFromOutline = useCallback(
    (targetSeats: number) => {
      const seats = Math.max(0, Math.trunc(targetSeats));
      const next = applyHallLayoutFromCustomOutline(layout, { targetSeats: seats });
      onTheaterLayoutChange?.(next);
      const rows = next.seatRows ?? 0;
      const perRow = next.seatsPerRow ?? 0;
      const total = rows * perRow;
      setDecorActionMessage(
        seats > 0
          ? `Зал ${next.hallWidth}×${next.hallDepth} м по контуру, ~${total} мест (${rows}×${perRow})`
          : `Зал ${next.hallWidth}×${next.hallDepth} м по контуру`,
      );
    },
    [layout, onTheaterLayoutChange, setDecorActionMessage],
  );

  return {
    applyHallTemplate,
    fitLayoutToSeatCount,
    applyTargetSeatCount,
    fitLayoutFromOutline,
  };
}
