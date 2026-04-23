import { lazy, Suspense, useEffect, useState } from "react";
import {
  STATUSES,
  statusOf,
  type KanbanStatus,
} from "../../shared/components/kanban/kanban-constants";
import { Modal } from "../../shared/core/modal/Modal";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import type { ScriptStep } from "../../shared/types/script";
import type { ProjectRoleInfo } from "../../sync/api";
import "./KanbanStepDetailModal.css";
import {
  KanbanStepRolesAdminPanel,
  type KanbanStepRolesAdminMember,
} from "./KanbanStepRolesAdminPanel";

const KanbanStepMarkdownPanel = lazy(() => import("./KanbanStepMarkdownPanel"));

function normalizeActorEmail(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function findAssignmentMember(
  members: KanbanStepRolesAdminMember[],
  rawEmail: string,
): KanbanStepRolesAdminMember | null {
  const e = normalizeActorEmail(rawEmail);
  if (!e) return null;
  return members.find((m) => normalizeActorEmail(m.email) === e) ?? null;
}

/** Подпись на чипе: имя и фамилия, иначе displayName, иначе email. */
function actorChipDisplay(
  m: KanbanStepRolesAdminMember | null,
  fallbackEmail: string,
): { label: string; avatarUrl: string | null; title: string } {
  const email = String(fallbackEmail ?? "").trim();
  if (!m?.profile) {
    return { label: email || "?", avatarUrl: null, title: email };
  }
  const p = m.profile;
  const full =
    `${String(p.firstName ?? "").trim()} ${String(p.lastName ?? "").trim()}`.trim();
  if (full) {
    return {
      label: full,
      avatarUrl: String(p.avatarUrl ?? "").trim() || null,
      title: email ? `${full} (${email})` : full,
    };
  }
  const display = String(p.displayName ?? "").trim();
  if (display) {
    return {
      label: display,
      avatarUrl: String(p.avatarUrl ?? "").trim() || null,
      title: email ? `${display} (${email})` : display,
    };
  }
  return {
    label: email || "?",
    avatarUrl: String(p.avatarUrl ?? "").trim() || null,
    title: email,
  };
}

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
  accessToken: string | null;
  projectName: string | null;
  projectRoles: ProjectRoleInfo[];
  roleAssignmentMembers: KanbanStepRolesAdminMember[];
  onProjectRolesUpdated: (roles: ProjectRoleInfo[]) => void;
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
  accessToken,
  projectName,
  projectRoles,
  roleAssignmentMembers,
  onProjectRolesUpdated,
}: KanbanStepDetailModalProps) {
  const [tab, setTab] = useState<ModalTab>("info");

  useEffect(() => {
    setTab("info");
  }, [step.id]);

  const missingSceneRoles = openedRoles.filter(
    (r) => resolveRoleInfo(r) == null,
  );

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
        <button
          type="button"
          className="kanban-step-modal__close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>

      <div
        className="kanban-step-modal__tabs"
        role="tablist"
        aria-label="Раздел карточки"
      >
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
            <div className="kanban-field__container">
              <label className="kanban-field">
                <span className="kanban-field-label">Статус готовности</span>
                <select
                  value={statusOf(step)}
                  onChange={(e) =>
                    setStepStatus(step.id, e.target.value as KanbanStatus)
                  }
                >
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
            </div>

            <div className="kanban-section">
              <div className="kanban-section-title">Роли и кто играет</div>
              {rolesLoading && (
                <div className="kanban-muted" style={{ marginBottom: 8 }}>
                  Загрузка ролей…
                </div>
              )}
              {openedRoles.length === 0 ? (
                <div className="kanban-muted">
                  Роли не найдены. Вытаскиваем роли из <code>[[Роль]]</code> и
                  пробуем распознать говорящего (например <code>ЛЕОН: ...</code>
                  ).
                </div>
              ) : (
                <div className="kanban-roles-grid">
                  {openedRoles.map((role) => (
                    <label key={role} className="kanban-role-row">
                      <span className="kanban-role-name">
                        {displayRoleTitle(role)}
                      </span>
                      <div className="kanban-role-input-wrap">
                        <div
                          style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                        >
                          {getRoleActors(step, role).length > 0 ? (
                            getRoleActors(step, role).map((a) => {
                              const member = findAssignmentMember(
                                roleAssignmentMembers,
                                a,
                              );
                              const { label, avatarUrl, title } = actorChipDisplay(
                                member,
                                a,
                              );
                              return (
                                <span
                                  key={`${role}:${a}`}
                                  className="kanban-chip kanban-chip--person"
                                  title={title}
                                >
                                  <MiniAvatar
                                    src={avatarUrl}
                                    label={label}
                                    size={18}
                                    title={title}
                                  />
                                  <span className="kanban-chip__person-name">
                                    {label}
                                  </span>
                                </span>
                              );
                            })
                          ) : (
                            <span className="kanban-muted">—</span>
                          )}
                        </div>
                        {resolveRoleInfo(role) == null && (
                          <div className="kanban-role-hint warn">
                            Роль не заведена в проекте. Создай её ниже в блоке
                            «Создание и назначения ролей».
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
              <KanbanStepRolesAdminPanel
                accessToken={accessToken}
                projectName={projectName}
                projectRoles={projectRoles}
                members={roleAssignmentMembers}
                missingSceneRoles={missingSceneRoles}
                onProjectRolesUpdated={onProjectRolesUpdated}
              />
            </div>
          </>
        ) : (
          <Suspense
            fallback={
              <div className="kanban-step-modal__lazy-fallback">
                Загрузка редактора…
              </div>
            }
          >
            <KanbanStepMarkdownPanel stepId={step.id} />
          </Suspense>
        )}
      </div>
    </Modal>
  );
}
