import type { TheaterControlsTabProps } from "./types";
import { TheaterBtn } from "../theater-controls-ui";

export function TheaterControlsToolbar({ vm }: TheaterControlsTabProps) {
  const { activeTab, setActiveTab, setEditMode } = vm;

  return (
    <div
      className="theater-tabs theater-tabs--editor-menubar"
      role="tablist"
      aria-label="Раздел настроек театра"
    >
      <TheaterBtn
        active={activeTab === "navigate"}
        onClick={() => setActiveTab("navigate")}
        title="Сцена, проект, закладки камеры"
      >
        Обзор
      </TheaterBtn>
      <TheaterBtn
        active={activeTab === "spotlights"}
        onClick={() => {
          setActiveTab("spotlights");
          setEditMode("spotlights");
        }}
      >
        Софиты
      </TheaterBtn>
      <TheaterBtn
        active={activeTab === "models"}
        onClick={() => {
          setActiveTab("models");
          setEditMode("models");
        }}
      >
        Модели
      </TheaterBtn>
      <TheaterBtn
        active={activeTab === "decor"}
        onClick={() => {
          setActiveTab("decor");
          setEditMode("decor");
        }}
      >
        Декор
      </TheaterBtn>
      <TheaterBtn active={activeTab === "layout"} onClick={() => setActiveTab("layout")}>
        План
      </TheaterBtn>
    </div>
  );
}
