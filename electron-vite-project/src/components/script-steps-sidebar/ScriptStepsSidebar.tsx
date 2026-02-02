import { useState } from 'react';
import { ScriptStep } from '../../types/script';
import { ScriptSidebarOptions } from './ScriptSidebarOptions';
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
  showRequisites: boolean;
  onToggleRequisites: () => void;
  showPlaylist: boolean;
  onTogglePlaylist: () => void;
  showHeaderSounds: boolean;
  onToggleHeaderSounds: () => void;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
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
  showRequisites,
  onToggleRequisites,
  showPlaylist,
  onTogglePlaylist,
  showHeaderSounds,
  onToggleHeaderSounds,
  isCollapsed,
  onToggleCollapsed,
}: ScriptStepsSidebarProps) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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
    <aside className={`script-sidebar${isCollapsed ? ' collapsed' : ''}`}>
      <ScriptSidebarOptions
        showRequisites={showRequisites}
        onToggleRequisites={onToggleRequisites}
        showPlaylist={showPlaylist}
        onTogglePlaylist={onTogglePlaylist}
        showHeaderSounds={showHeaderSounds}
        onToggleHeaderSounds={onToggleHeaderSounds}
        isCollapsed={isCollapsed}
        onToggleCollapsed={onToggleCollapsed}
      />

      {!isCollapsed && (
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
                  onClick={() => onDelete(step.id)}
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
      )}

    </aside>
  );
};
