import { LabeledToggle } from "../../../shared/core/labeled-toggle/LabeledToggle";

export type FormatPlayTextSplitSectionProps = {
  splitIntoScenes: boolean;
  setSplitIntoScenes: (value: boolean) => void;
  sceneChunksCount: number;
};

export function FormatPlayTextSplitSection({
  splitIntoScenes,
  setSplitIntoScenes,
  sceneChunksCount,
}: FormatPlayTextSplitSectionProps) {
  const splitHint =
    sceneChunksCount > 1
      ? `Получится сцен: ${sceneChunksCount}. Границы — строки «Акт», «Сцена», «Картина», «Действие».`
      : "В тексте нет таких заголовков — добавь «Акт I», «Сцена 1», «Картина 2» и т.п.";

  return (
    <div className="format-play-text-modal__split format-play-text-modal__split--compact">
      <LabeledToggle checked={splitIntoScenes} onChange={setSplitIntoScenes}>
        Разбить на сцены по актам, сценам и картинам
      </LabeledToggle>
      {splitIntoScenes ? (
        <p className="format-play-text-modal__split-hint">{splitHint}</p>
      ) : null}
    </div>
  );
}
