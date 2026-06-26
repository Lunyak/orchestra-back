import cn from "classnames";
import React, { useState } from "react";
import { ScriptScene } from "../../types/script";
import { Buttons } from "../buttons/Buttons";
import { ListItem } from "../list-item/ListItem";
import "./style.css";

export interface ScriptScenesSidebarProps {
  scenes: ScriptScene[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onDelete: (id: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  isEditing: boolean;
  onToggleEditing: () => void;
  onAddScene: () => void;
}

export const ScriptScenesSidebar = ({
  scenes,
  currentIndex,
  onSelect,
  onPrev,
  onNext,
  onDelete,
  onReorder,
  isEditing,
  onToggleEditing,
  onAddScene,
}: ScriptScenesSidebarProps) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDeleteClick =
    (scene: ScriptScene, index: number) =>
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      // Power-user shortcut: Shift+Click deletes without confirm.
      if (event.shiftKey) {
        onDelete(scene.id);
        return;
      }

      const prefix = `Удалить сцену ${index + 1}${scene.title ? `: "${scene.title}"` : ""}?`;
      const suffix =
        scenes.length <= 1
          ? " Сценарий станет пустым — можно снова добавить материал."
          : " Это действие нельзя отменить.";
      const message = `${prefix}${suffix}`;

      if (!window.confirm(message)) return;
      onDelete(scene.id);
    };

  const handleDragStart =
    (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
      setDragIndex(index);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop =
    (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("text/plain");
      const fromIndex = Number(raw);
      if (!Number.isFinite(fromIndex)) return;
      if (fromIndex === index) return;
      onReorder(fromIndex, index);
      setDragIndex(null);
      setDragOverIndex(null);
    };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <aside className="script-sidebar">
      <div className="script-sidebar-content">
        <div className="scenes-mini-list">
          {scenes.length === 0 ? (
            <p className="script-sidebar-empty">Добавьте материал в сценарий</p>
          ) : null}
          {          scenes.map((scene, index) => {
            const isActive = index === currentIndex;
            return (
              <ListItem
                key={`${scene.id}:${index}`}
                className={cn(
                  "scene-mini-item",
                  isActive && "scene-mini-item--active",
                  dragOverIndex === index && "scene-mini-item--drag-over",
                  dragIndex === index && "scene-mini-item--dragging",
                )}
                draggable
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver}
                onDragEnter={() => setDragOverIndex(index)}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={handleDrop(index)}
                onDragEnd={handleDragEnd}
              >
                <button
                  className="scene-mini-btn"
                  onClick={() => onSelect(index)}
                >
                  {index + 1}. {scene.title}
                </button>
                {isActive && (
                  <Buttons.DeleteButton
                    className="scene-mini-btn-delete"
                    variant="scene"
                    onClick={handleDeleteClick(scene, index)}
                    title="Удалить сцену"
                    aria-label="Удалить сцену"
                  />
                )}
              </ListItem>
            );
          })}
          <Buttons.AddButton
            onClick={onAddScene}
            title="Добавить сцену"
            aria-label="Добавить сцену"
          />
        </div>
        <div className="script-navigation">
          <button
            className="script-nav-btn"
            onClick={onPrev}
            disabled={currentIndex === 0 || scenes.length === 0}
          >
            ←
          </button>
          <span className="page-indicator">
            {scenes.length === 0
              ? "Нет сцен"
              : `Сцена ${currentIndex + 1} из ${scenes.length}`}
          </span>
          <button
            className="script-nav-btn"
            onClick={onNext}
            disabled={currentIndex === scenes.length - 1 || scenes.length === 0}
          >
            →
          </button>
        </div>
      </div>
    </aside>
  );
};
