import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/model/auth-context";
import {
  STATUSES,
  statusOf,
  type KanbanStatus,
} from "../../shared/components/kanban/kanban-constants";
import {
  CustomSelect,
  type CustomSelectOption,
} from "../../shared/core/custom-select/CustomSelect";
import { InlineTextField } from "../../shared/core/inline-text-field/InlineTextField";
import { Modal } from "../../shared/core/modal/Modal";
import type { ScriptStep } from "../../shared/types/script";
import type { ProjectRoleInfo } from "../../sync/api/projects";
import "./KanbanStepDetailModal.css";
import {
  KanbanStepRolesAdminPanel,
  type KanbanStepRolesAdminMember,
} from "./KanbanStepRolesAdminPanel";
import { KanbanStepRoleCastTile } from "./KanbanStepRoleCastTile";
import { KanbanStepRoleDetailPanel } from "./KanbanStepRoleDetailPanel";

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
  projectName: string | null;
  projectRoles: ProjectRoleInfo[];
  roleAssignmentMembers: KanbanStepRolesAdminMember[];
};

type ModalTab = "info" | "script";
type InfoSubPage = "overview" | "roles-admin" | "role-detail";

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
  projectName,
  projectRoles,
  roleAssignmentMembers,
}: KanbanStepDetailModalProps) {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<ModalTab>("info");
  const [infoSubPage, setInfoSubPage] = useState<InfoSubPage>("overview");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const statusSelectOptions: CustomSelectOption[] = STATUSES.map((statusItem) => ({
    value: statusItem.id,
    label: statusItem.label,
  }));

  useEffect(() => {
    setTab("info");
    setInfoSubPage("overview");
    setSelectedRoleId(null);
  }, [step.id]);

  const selectedRole = useMemo(
    () => projectRoles.find((r) => r.id === selectedRoleId) ?? null,
    [projectRoles, selectedRoleId],
  );

  const isRoleDetailPage = tab === "info" && infoSubPage === "role-detail";
  const isRolesAdminPage = tab === "info" && infoSubPage === "roles-admin";
  const isSubNavPage = isRolesAdminPage || isRoleDetailPage;

  const missingSceneRoles = openedRoles.filter((r) => resolveRoleInfo(r) == null);

  const openRoleDetail = (roleId: string) => {
    setSelectedRoleId(roleId);
    setInfoSubPage("role-detail");
  };

  const modalAriaLabel = isRoleDetailPage
    ? `Роль: ${selectedRole?.title ?? ""}`
    : isRolesAdminPage
      ? `Назначения ролей: ${step.title}`
      : `Сцена: ${step.title}`;

  return (
    <Modal
      isOpen
      onClose={onClose}
      panelClassName="kanban-step-modal-panel"
      ariaLabel={modalAriaLabel}
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

      {!isSubNavPage ? (
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
            onClick={() => {
              setTab("info");
              setInfoSubPage("overview");
              setSelectedRoleId(null);
            }}
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
      ) : (
        <div className="kanban-step-modal__subnav">
          <button
            type="button"
            className="kanban-step-modal__back"
            onClick={() => {
              if (isRoleDetailPage) {
                setInfoSubPage("roles-admin");
                setSelectedRoleId(null);
                return;
              }
              setInfoSubPage("overview");
              setSelectedRoleId(null);
            }}
          >
            {isRoleDetailPage ? "← Назад к ролям" : "← Назад к карточке"}
          </button>
          <div className="kanban-step-modal__subnav-title">
            {isRoleDetailPage ? selectedRole?.title ?? "Роль" : "Назначения ролей"}
          </div>
        </div>
      )}

      <div
        className={`kanban-step-modal__body${isSubNavPage ? " kanban-step-modal__body_roles-admin" : ""}`}
      >
        {isRoleDetailPage && selectedRoleId && !selectedRole ? (
          <div className="kanban-muted">Загрузка роли…</div>
        ) : isRoleDetailPage && selectedRole && projectName ? (
          <KanbanStepRoleDetailPanel
            projectName={projectName}
            role={selectedRole}
            projectRoles={projectRoles}
            members={roleAssignmentMembers}
            onDeleted={() => {
              setInfoSubPage("roles-admin");
              setSelectedRoleId(null);
            }}
          />
        ) : isRolesAdminPage ? (
          <KanbanStepRolesAdminPanel
            projectName={projectName}
            projectRoles={projectRoles}
            missingSceneRoles={missingSceneRoles}
            onOpenRole={openRoleDetail}
          />
        ) : tab === "info" ? (
          <>
            <div className="kanban-field__container">
              <label className="kanban-field">
                <span className="kanban-field-label">Статус готовности</span>
                <CustomSelect
                  value={statusOf(step)}
                  options={statusSelectOptions}
                  onChange={(nextValue) =>
                    setStepStatus(step.id, nextValue as KanbanStatus)
                  }
                  aria-label="Статус готовности"
                />
              </label>

              <label className="kanban-field">
                <span className="kanban-field-label">Длительность (мин)</span>
                <InlineTextField
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
                <div className="kanban-step-cast-grid">
                  {openedRoles.map((role) => (
                    <KanbanStepRoleCastTile
                      key={role}
                      roleKey={role}
                      roleTitle={displayRoleTitle(role)}
                      roleInfo={resolveRoleInfo(role)}
                      actorEmails={getRoleActors(step, role)}
                      members={roleAssignmentMembers}
                      accessToken={accessToken}
                    />
                  ))}
                </div>
              )}
              <button
                type="button"
                className="kanban-step-modal__roles-link"
                onClick={() => setInfoSubPage("roles-admin")}
              >
                Назначить актёров и редактировать роли →
              </button>
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
