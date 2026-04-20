import React, { lazy, Suspense, useEffect, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import { Modal } from "../../shared/core/modal/Modal";
import { Button } from "../../shared/core/button/Button";
import type { ScriptStep } from "../../shared/types/script";
import { STATUSES, statusOf, type KanbanStatus } from "../../shared/components/kanban/kanban-constants";
import type { ProjectRoleInfo } from "../../sync/api";
import "./KanbanStepDetailModal.css";

const KanbanStepMarkdownPanel = lazy(() => import("./KanbanStepMarkdownPanel"));

export type KanbanStepDetailModalProps = {
  step: ScriptStep;
  onClose: () => void;
  setStepStatus: (id: number, st: KanbanStatus) => void;
  setStepDurationMin: (id: number, durationMin: number | undefined) => void;
  rolesLoading: boolean;
  openedRoles: string[];
  getRoleActors: (step: ScriptStep, role: string) => string[];
  displayRoleTitle: (role: string) => string;
  resolveRoleInfo: (role: string) => ProjectRoleInfo | null;
  formatActorList: (actors: string[]) => string;
  navigate: NavigateFunction;
  accessToken: string | null;
  projectName: string | null;
};

type ModalTab = "info" | "script";

export function KanbanStepDetailModal({
  step,
  onClose,
  setStepStatus,
  setStepDurationMin,
  rolesLoading,
  openedRoles,
  getRoleActors,
  displayRoleTitle,
  resolveRoleInfo,
  formatActorList,
  navigate,
  accessToken,
  projectName,
}: KanbanStepDetailModalProps) {
  const [tab, setTab] = useState<ModalTab>("info");

  useEffect(() => {
    setTab("info");
  }, [step.id]);

  return (
    <Modal
      isOpen
      onClose={onClose}
      panelClassName="kanban-step-modal-panel"
      ariaLabel={`Сцена: ${step.title}`}
    >
      <div className="kanban-step-modal__head">
        <div>
          <div className="kanban-step-modal__title">{step.title}</div>
          <div className="kanban-step-modal__meta">Шаг #{step.id}</div>
        </div>
        <button type="button" className="kanban-step-modal__close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </div>

      <div className="kanban-step-modal__tabs" role="tablist" aria-label="Раздел карточки">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "info"}
          className="kanban-step-modal__tab"
          data-active={tab === "info" ? "true" : "false"}
          onClick={() => setTab("info")}
        >
          Карточка
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "script"}
          className="kanban-step-modal__tab"
          data-active={tab === "script" ? "true" : "false"}
          onClick={() => setTab("script")}
        >
          Сценарий
        </button>
      </div>

      <div className="kanban-step-modal__body">
        {tab === "info" ? (
          <>
            <label className="kanban-field">
              <span className="kanban-field-label">Статус готовности</span>
              <select value={statusOf(step)} onChange={(e) => setStepStatus(step.id, e.target.value as KanbanStatus)}>
                {STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="kanban-field">
              <span className="kanban-field-label">Длительность (мин)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={step.durationMin ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setStepDurationMin(step.id, undefined);
                    return;
                  }
                  const num = Number(raw);
                  if (!Number.isFinite(num) || num < 0) return;
                  setStepDurationMin(step.id, num);
                }}
                placeholder="не указано"
              />
            </label>

            <div className="kanban-section">
              <div className="kanban-section-title">Роли и кто играет</div>
              {rolesLoading && (
                <div className="kanban-muted" style={{ marginBottom: 8 }}>
                  Загрузка ролей…
                </div>
              )}
              {openedRoles.length === 0 ? (
                <div className="kanban-muted">
                  Роли не найдены. Вытаскиваем роли из <code>[[Роль]]</code> и пробуем распознать говорящего (например{" "}
                  <code>ЛЕОН: ...</code>).
                </div>
              ) : (
                <div className="kanban-roles-grid">
                  {openedRoles.map((role) => (
                    <label key={role} className="kanban-role-row">
                      <span className="kanban-role-name">{displayRoleTitle(role)}</span>
                      <div className="kanban-role-input-wrap">
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {getRoleActors(step, role).length > 0 ? (
                            getRoleActors(step, role).map((a) => (
                              <span key={`${role}:${a}`} className="kanban-chip">
                                {formatActorList([a])}
                              </span>
                            ))
                          ) : (
                            <span className="kanban-muted">—</span>
                          )}
                        </div>
                        {resolveRoleInfo(role) == null && (
                          <div className="kanban-role-hint warn">
                            Роль не заведена в проекте. Создай её в разделе «Роли», чтобы назначать актёров.
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
              <div className="kanban-step-modal__roles-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate("/roles")}
                  disabled={!accessToken || !projectName}
                  title={!accessToken ? "Нужно войти" : !projectName ? "Нужен проект" : undefined}
                >
                  Открыть «Роли»
                </Button>
              </div>
            </div>
          </>
        ) : (
          <Suspense fallback={<div className="kanban-step-modal__lazy-fallback">Загрузка редактора…</div>}>
            <KanbanStepMarkdownPanel stepId={step.id} />
          </Suspense>
        )}
      </div>
    </Modal>
  );
}
