import { useState } from "react";
import { LabeledCheckbox } from "../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { isTheaterDecorModel } from "../../model/theater-decor-catalog";
import { kadrDisplayTitle } from "../../model/kadr-store";
import { readSceneLightKadrs } from "../../model/light-kadrs";
import { isTheaterPersonModel } from "../../model/theater-model-builtin";
import type { TheaterCopyCategory, TheaterCopyScope } from "../../model/theater-copy-set";
import { TheaterCollapsibleSection } from "../TheaterCollapsibleSection";
import { TheaterBtn, TheaterSelect } from "../theater-controls-ui";
import type { TheaterControlsTabProps } from "./types";

export function TheaterControlsCopyTab({ vm }: TheaterControlsTabProps) {
  const [includeFurniture, setIncludeFurniture] = useState(true);
  const [includeDecor, setIncludeDecor] = useState(true);
  const [includeSpotlights, setIncludeSpotlights] = useState(true);
  const [scope, setScope] = useState<TheaterCopyScope>("all");
  const [kadrId, setKadrId] = useState("");

  const categories: TheaterCopyCategory[] = [
    ...(includeFurniture ? (["furniture"] as const) : []),
    ...(includeDecor ? (["decor"] as const) : []),
    ...(includeSpotlights ? (["spotlights"] as const) : []),
  ];
  const copyOptions = { categories, scope };
  const hasCategories = categories.length > 0;
  const hasPrevious = vm.currentPage > 0;
  const hasNext = vm.currentPage < vm.sceneCount - 1;
  const selectedModelIds =
    vm.multiSelectedModelIds.length > 0
      ? vm.multiSelectedModelIds
      : vm.activeModelId != null
        ? [vm.activeModelId]
        : [];
  const selectedSpotlightIds =
    vm.multiSelectedSpotlightIds.length > 0
      ? vm.multiSelectedSpotlightIds
      : vm.activeSpotlightId != null
        ? [vm.activeSpotlightId]
        : [];
  const selectedModelIdSet = new Set(selectedModelIds);
  const selectedSpotlightIdSet = new Set(selectedSpotlightIds);
  const furnitureItems = vm.models.filter((item) => !isTheaterDecorModel(item));
  const decorItems = vm.models.filter((item) => isTheaterDecorModel(item));
  const furnitureCount =
    scope === "selected"
      ? furnitureItems.filter((item) => selectedModelIdSet.has(item.id)).length
      : furnitureItems.length;
  const decorCount =
    scope === "selected"
      ? decorItems.filter((item) => selectedModelIdSet.has(item.id)).length
      : decorItems.length;
  const spotlightCount =
    scope === "selected"
      ? vm.displaySpotlights.filter((item) =>
          selectedSpotlightIdSet.has(item.id),
        ).length
      : vm.displaySpotlights.length;
  const selectedCount =
    (includeFurniture ? furnitureCount : 0) +
    (includeDecor ? decorCount : 0) +
    (includeSpotlights ? spotlightCount : 0);
  const hasCopyableSource = scope === "all" || selectedCount > 0;
  const canCopyOut =
    Boolean(vm.currentScene) && hasCategories && hasCopyableSource;
  const canApplyIn = Boolean(vm.currentScene) && hasCategories;
  const kadrs = readSceneLightKadrs(vm.currentScene).kadrs;
  const resolvedKadrId =
    kadrs.some((item) => item.id === kadrId) ? kadrId : (kadrs[0]?.id ?? "");
  const kadrOptions = kadrs.map((item) => ({
    value: item.id,
    label: kadrDisplayTitle(item),
  }));
  const hasKadrs = kadrs.length > 0;
  const canUseKadr = canCopyOut && hasKadrs && Boolean(resolvedKadrId);
  const canApplyKadr = canApplyIn && hasKadrs && Boolean(resolvedKadrId);
  const allFurnitureCount = furnitureItems.filter(
    (item) => !isTheaterPersonModel(item),
  ).length;
  const allSpotlightCount = vm.displaySpotlights.length;
  const canClearFurniture = Boolean(vm.currentScene) && allFurnitureCount > 0;
  const canClearSpotlights = Boolean(vm.currentScene) && allSpotlightCount > 0;

  const clearFurniture = () => {
    if (!window.confirm("Удалить всю мебель с этой сцены?")) return;
    vm.clearTheaterFurniture();
  };
  const clearSpotlights = () => {
    if (!window.confirm("Удалить все софиты с этой сцены?")) return;
    vm.clearTheaterSpotlights();
  };

  return (
    <div className="theater-layout-panel">
      <TheaterCollapsibleSection
        sectionId="copy-categories"
        title="Что копировать"
        summary="Мебель, декор, софиты"
        defaultOpen
      >
        <div className="theater-compact-checks">
          <LabeledCheckbox
            checked={includeFurniture}
            onChange={setIncludeFurniture}
          >
            Мебель ({furnitureCount})
          </LabeledCheckbox>
          <LabeledCheckbox checked={includeDecor} onChange={setIncludeDecor}>
            Декор ({decorCount})
          </LabeledCheckbox>
          <LabeledCheckbox
            checked={includeSpotlights}
            onChange={setIncludeSpotlights}
          >
            Софиты и настройки ({spotlightCount})
          </LabeledCheckbox>
        </div>
        <p className="theater-layout-hint">Источник на этой сцене</p>
        <div className="theater-btn-row">
          <TheaterBtn
            active={scope === "all"}
            onClick={() => setScope("all")}
          >
            Все
          </TheaterBtn>
          <TheaterBtn
            active={scope === "selected"}
            onClick={() => setScope("selected")}
          >
            Выбранные
          </TheaterBtn>
        </div>
      </TheaterCollapsibleSection>
      <TheaterCollapsibleSection
        sectionId="copy-to-scene"
        title="На другую сцену"
        summary="С теми же координатами"
        defaultOpen
      >
        <p className="theater-layout-hint">
          Все — заменить на соседней. Выбранные — добавить.
        </p>
        <div className="theater-btn-row">
          <TheaterBtn
            disabled={!canCopyOut || !hasPrevious}
            title="Скопировать на предыдущую сцену"
            onClick={() =>
              vm.copyTheaterSetToAdjacentScene("previous", copyOptions)
            }
          >
            ← Предыдущая
          </TheaterBtn>
          <TheaterBtn
            disabled={!canCopyOut || !hasNext}
            title="Скопировать на следующую сцену"
            onClick={() => vm.copyTheaterSetToAdjacentScene("next", copyOptions)}
          >
            Следующая →
          </TheaterBtn>
        </div>
      </TheaterCollapsibleSection>
      <TheaterCollapsibleSection
        sectionId="copy-from-scene"
        title="Взять с другой сцены"
        summary="Заменить выбранные категории"
        defaultOpen
      >
        <p className="theater-layout-hint">
          Берёт все объекты категорий, не только выделение.
        </p>
        <div className="theater-btn-row">
          <TheaterBtn
            disabled={!canApplyIn || !hasPrevious}
            title="Взять с предыдущей сцены"
            onClick={() =>
              vm.applyTheaterSetFromAdjacentScene("previous", copyOptions)
            }
          >
            ← С предыдущей
          </TheaterBtn>
          <TheaterBtn
            disabled={!canApplyIn || !hasNext}
            title="Взять со следующей сцены"
            onClick={() =>
              vm.applyTheaterSetFromAdjacentScene("next", copyOptions)
            }
          >
            Со следующей →
          </TheaterBtn>
        </div>
      </TheaterCollapsibleSection>
      <TheaterCollapsibleSection
        sectionId="copy-kadrs"
        title="Картины"
        summary="Снимок мизансцены"
        defaultOpen
      >
        {hasKadrs ? (
          <>
            <TheaterSelect
              label="Картина"
              value={resolvedKadrId}
              options={kadrOptions}
              onChange={setKadrId}
            />
            <div className="theater-btn-row">
              <TheaterBtn
                disabled={!canUseKadr}
                title="Записать выбранное в снимок картины"
                onClick={() =>
                  vm.writeTheaterSetToKadr(resolvedKadrId, copyOptions)
                }
              >
                Записать
              </TheaterBtn>
              <TheaterBtn
                disabled={!canApplyKadr}
                title="Применить снимок картины к этой сцене"
                onClick={() =>
                  vm.applyTheaterSetFromKadr(resolvedKadrId, copyOptions)
                }
              >
                Взять
              </TheaterBtn>
            </div>
          </>
        ) : (
          <p className="theater-layout-hint">
            Сначала создайте картину в ленте под сценой.
          </p>
        )}
      </TheaterCollapsibleSection>
      <TheaterCollapsibleSection
        sectionId="copy-clear"
        title="Очистить эту сцену"
        summary="Мебель и свет отдельно"
        defaultOpen
      >
        <p className="theater-layout-hint">
          Актёров и декор не трогает. Софиты удаляются вместе с настройками.
        </p>
        <div className="theater-btn-row">
          <TheaterBtn
            disabled={!canClearFurniture}
            title="Удалить всю мебель на этой сцене"
            onClick={clearFurniture}
          >
            Мебель ({allFurnitureCount})
          </TheaterBtn>
          <TheaterBtn
            disabled={!canClearSpotlights}
            title="Удалить все софиты на этой сцене"
            onClick={clearSpotlights}
          >
            Свет ({allSpotlightCount})
          </TheaterBtn>
        </div>
      </TheaterCollapsibleSection>
    </div>
  );
}
