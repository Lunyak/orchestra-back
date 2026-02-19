import { useState } from 'react';
import { ScriptStep } from "../../shared/types/script";
import './style.css';

export interface ScriptStepsSidebarProps {
  steps: ScriptStep[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onDelete: (id: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  isEditing: boolean;
  onToggleEditing: () => void;
  onAddStep: () => void;
}

export const ScriptStepsSidebar = ({
  steps,
  currentIndex,
  onSelect,
  onPrev,
  onNext,
  onDelete,
  onReorder,
  isEditing,
  onToggleEditing,
  onAddStep,
}: ScriptStepsSidebarProps) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDeleteClick =
    (step: ScriptStep, index: number) => (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      // Power-user shortcut: Shift+Click deletes without confirm.
      if (event.shiftKey) {
        onDelete(step.id);
        return;
      }

      const prefix = `Удалить шаг ${index + 1}${step.title ? `: "${step.title}"` : ""}?`;
      const suffix =
        steps.length <= 1
          ? " После удаления будет создан новый пустой шаг."
          : " Это действие нельзя отменить.";
      const message = `${prefix}${suffix}`;

      if (!window.confirm(message)) return;
      onDelete(step.id);
    };

  const handleDragStart =
    (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
      setDragIndex(index);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop =
    (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData('text/plain');
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
        <div className="script-sidebar-header">
          <button
            className="script-edit-toggle"
            onClick={onToggleEditing}
            title={isEditing ? 'Режим чтения' : 'Режим редактирования'}
          >
            {isEditing ? 'Чтение' : 'Редакт.'}
          </button>
          <div className="script-sidebar-title">Шаги</div>
          <button className="script-add-step" onClick={onAddStep}>
            +
          </button>
        </div>
        <div className="steps-mini-list">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`step-mini-item ${index === currentIndex ? 'active' : ''}${dragOverIndex === index ? ' drag-over' : ''
                }${dragIndex === index ? ' dragging' : ''}`}
              draggable
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver}
              onDragEnter={() => setDragOverIndex(index)}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={handleDrop(index)}
              onDragEnd={handleDragEnd}
            >
              <button
                className="step-mini-btn"
                onClick={() => onSelect(index)}
              >
                {index + 1}. {step.title}
              </button>
              <button
                className="step-mini-delete"
                onClick={handleDeleteClick(step, index)}
                title="Удалить шаг"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="script-navigation">
          <button
            className="script-nav-btn"
            onClick={onPrev}
            disabled={currentIndex === 0}
          >
            ← Предыдущий
          </button>
          <span className="page-indicator">
            Шаг {currentIndex + 1} из {steps.length}
          </span>
          <button
            className="script-nav-btn"
            onClick={onNext}
            disabled={currentIndex === steps.length - 1}
          >
            Следующий →
          </button>
        </div>
      </div>
    </aside>
  );
};
