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
  const hasPrevious = vm.copyHasPreviousPicture;
  const hasNext = vm.copyHasNextPicture;
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

  const scopeHint =
    scope === "all"
      ? "Все объекты выбранных категорий на этой сцене."
      : "Только то, что сейчас выделено на сцене.";
  const sendHint =
    scope === "all"
      ? "На соседней картине эти категории заменятся. Остальные картины не трогаются."
      : "Выбранное добавится на соседнюю картину. Остальные картины не трогаются.";

  return (
    <div className="theater-layout-panel theater-layout-panel--copy">
      <TheaterCollapsibleSection
        sectionId="copy-source"
        title="1. Что берём"
        summary="Категории и объём"
        defaultOpen
      >
        <p className="theater-copy-lead">Отметьте категории.</p>
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
            Софиты и их настройки ({spotlightCount})
          </LabeledCheckbox>
        </div>
        <p className="theater-copy-lead">Сколько объектов.</p>
        <div className="theater-btn-row">
          <TheaterBtn
            active={scope === "all"}
            onClick={() => setScope("all")}
          >
            Все на сцене
          </TheaterBtn>
          <TheaterBtn
            active={scope === "selected"}
            onClick={() => setScope("selected")}
          >
            Только выбранные
          </TheaterBtn>
        </div>
        <p className="theater-layout-hint">{scopeHint}</p>
      </TheaterCollapsibleSection>
      <TheaterCollapsibleSection
        sectionId="copy-send"
        title="2. Отправить на соседнюю картину"
        summary="Только эта картина"
        defaultOpen
      >
        <p className="theater-layout-hint">{sendHint}</p>
        <div className="theater-btn-row theater-btn-row--stack">
          <TheaterBtn
            disabled={!canCopyOut || !hasPrevious}
            title="Скопировать на предыдущую картину"
            onClick={() =>
              vm.copyTheaterSetToAdjacentPicture("previous", copyOptions)
            }
          >
            На предыдущую картину
          </TheaterBtn>
          <TheaterBtn
            disabled={!canCopyOut || !hasNext}
            title="Скопировать на следующую картину"
            onClick={() => vm.copyTheaterSetToAdjacentPicture("next", copyOptions)}
          >
            На следующую картину
          </TheaterBtn>
        </div>
      </TheaterCollapsibleSection>
      <TheaterCollapsibleSection
        sectionId="copy-pull"
        title="3. Взять с соседней картины"
        summary="Подставить в эту картину"
      >
        <p className="theater-layout-hint">
          В эту картину попадут все объекты отмеченных категорий. Другие картины
          на сцене останутся как есть.
        </p>
        <div className="theater-btn-row theater-btn-row--stack">
          <TheaterBtn
            disabled={!canApplyIn || !hasPrevious}
            title="Взять с предыдущей картины"
            onClick={() =>
              vm.applyTheaterSetFromAdjacentPicture("previous", copyOptions)
            }
          >
            С предыдущей картины
          </TheaterBtn>
          <TheaterBtn
            disabled={!canApplyIn || !hasNext}
            title="Взять со следующей картины"
            onClick={() =>
              vm.applyTheaterSetFromAdjacentPicture("next", copyOptions)
            }
          >
            Со следующей картины
          </TheaterBtn>
        </div>
      </TheaterCollapsibleSection>
      <TheaterCollapsibleSection
        sectionId="copy-kadr"
        title="4. Картина"
        summary="Записать или применить снимок"
      >
        {hasKadrs ? (
          <>
            <p className="theater-layout-hint">
              Снимок мизансцены. «Записать» сохраняет текущий набор, «Взять» —
              ставит его на эту сцену.
            </p>
            <TheaterSelect
              label="Картина"
              value={resolvedKadrId}
              options={kadrOptions}
              onChange={setKadrId}
            />
            <div className="theater-btn-row theater-btn-row--stack">
              <TheaterBtn
                disabled={!canUseKadr}
                title="Записать выбранное в снимок картины"
                onClick={() =>
                  vm.writeTheaterSetToKadr(resolvedKadrId, copyOptions)
                }
              >
                Записать в картину
              </TheaterBtn>
              <TheaterBtn
                disabled={!canApplyKadr}
                title="Применить снимок картины к этой сцене"
                onClick={() =>
                  vm.applyTheaterSetFromKadr(resolvedKadrId, copyOptions)
                }
              >
                Взять из картины
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
        sectionId="copy-wipe"
        title="5. Удалить с этой сцены"
        summary="Мебель или свет"
      >
        <p className="theater-layout-hint">
          Актёров и декор не трогает. Свет удаляется вместе с настройками.
        </p>
        <div className="theater-btn-row theater-btn-row--stack">
          <TheaterBtn
            className="theater-btn--danger"
            disabled={!canClearFurniture}
            title="Удалить всю мебель на этой сцене"
            onClick={clearFurniture}
          >
            Удалить мебель ({allFurnitureCount})
          </TheaterBtn>
          <TheaterBtn
            className="theater-btn--danger"
            disabled={!canClearSpotlights}
            title="Удалить все софиты на этой сцене"
            onClick={clearSpotlights}
          >
            Удалить свет ({allSpotlightCount})
          </TheaterBtn>
        </div>
      </TheaterCollapsibleSection>
    </div>
  );
}
