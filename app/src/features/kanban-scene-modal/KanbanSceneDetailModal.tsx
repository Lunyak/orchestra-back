import { PageLoader } from "@shared/components/page-loader/PageLoader";
import cn from "classnames";
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
import type { ScriptScene } from "../../shared/types/script";
import type { ProjectRoleInfo } from "../../sync/api/projects";
import "./KanbanSceneDetailModal.css";
import {
  KanbanSceneRolesAdminPanel,
  type KanbanSceneRolesAdminMember,
} from "./KanbanSceneRolesAdminPanel";
import { KanbanSceneRoleCastTile } from "./KanbanSceneRoleCastTile";
import { KanbanSceneRoleDetailPanel } from "./KanbanSceneRoleDetailPanel";

const KanbanSceneMarkdownPanel = lazy(() => import("./KanbanSceneMarkdownPanel"));

export type KanbanSceneDetailModalProps = {
  scene: ScriptScene;
  onClose: () => void;
  setSceneStatus: (id: number, st: KanbanStatus) => void;
  setSceneDurationMin: (id: number, durationMin: number | undefined) => void;
  rolesLoading: boolean;
  openedRoles: string[];
  getRoleActors: (scene: ScriptScene, role: string) => string[];
  displayRoleTitle: (role: string) => string;
  resolveRoleInfo: (role: string) => ProjectRoleInfo | null;
  projectName: string | null;
  projectRoles: ProjectRoleInfo[];
  roleAssignmentMembers: KanbanSceneRolesAdminMember[];
};

type ModalTab = "info" | "script";
type InfoSubPage = "overview" | "roles-admin" | "role-detail";

export function KanbanSceneDetailModal({
  scene,
  onClose,
  setSceneStatus,
  setSceneDurationMin,
  rolesLoading,
  openedRoles,
  getRoleActors,
  displayRoleTitle,
  resolveRoleInfo,
  projectName,
  projectRoles,
  roleAssignmentMembers,
}: KanbanSceneDetailModalProps) {
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
  }, [scene.id]);

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
      ? `Назначения ролей: ${scene.title}`
      : `Сцена: ${scene.title}`;

  return (
    <Modal
      isOpen
      onClose={onClose}
      panelClassName="kanban-scene-modal"
      ariaLabel={modalAriaLabel}
    >
      <div className="kanban-scene-modal__header">
        <div>
          <div className="kanban-scene-modal__title">{scene.title}</div>
          <div className="kanban-scene-modal__meta">Сцена #{scene.id}</div>
        </div>
        <button
          type="button"
          className="kanban-scene-modal__close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>

      {!isSubNavPage ? (
        <div
          className="kanban-scene-modal__tabs"
          role="tablist"
          aria-label="Раздел карточки"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "info"}
            className="kanban-scene-modal__tab"
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
            className="kanban-scene-modal__tab"
            data-active={tab === "script" ? "true" : "false"}
            onClick={() => setTab("script")}
          >
            Сценарий
          </button>
        </div>
      ) : (
        <div className="kanban-scene-modal__subnav">
          <button
            type="button"
            className="kanban-scene-modal__back"
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
          <div className="kanban-scene-modal__subnav-title">
            {isRoleDetailPage ? selectedRole?.title ?? "Роль" : "Назначения ролей"}
          </div>
        </div>
      )}

      <div
        className={cn("kanban-scene-modal__body", isSubNavPage && "kanban-scene-modal__body--subnav")}
      >
        {isRoleDetailPage && selectedRoleId && !selectedRole ? (
          <PageLoader variant="view" label="Загрузка роли…" />
        ) : isRoleDetailPage && selectedRole && projectName ? (
          <KanbanSceneRoleDetailPanel
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
          <KanbanSceneRolesAdminPanel
            projectName={projectName}
            projectRoles={projectRoles}
            missingSceneRoles={missingSceneRoles}
            onOpenRole={openRoleDetail}
          />
        ) : tab === "info" ? (
          <>
            <div className="kanban-field__container">
              <label className="kanban-field">
                <span className="kanban-field__label">Статус готовности</span>
                <CustomSelect
                  value={statusOf(scene)}
                  options={statusSelectOptions}
                  onChange={(nextValue) =>
                    setSceneStatus(scene.id, nextValue as KanbanStatus)
                  }
                  aria-label="Статус готовности"
                />
              </label>

              <label className="kanban-field">
                <span className="kanban-field__label">Длительность (мин)</span>
                <InlineTextField
                  type="number"
                  min={0}
                  step={1}
                  value={scene.durationMin ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setSceneDurationMin(scene.id, undefined);
                      return;
                    }
                    const num = Number(raw);
                    if (!Number.isFinite(num) || num < 0) return;
                    setSceneDurationMin(scene.id, num);
                  }}
                  placeholder="не указано"
                />
              </label>
            </div>

            <div className="kanban-section">
              <div className="kanban-section__title">Роли и кто играет</div>
              {rolesLoading && (
                <PageLoader variant="view" label="Загрузка ролей…" />
              )}
              {openedRoles.length === 0 ? (
                <div className="kanban-muted">
                  Роли не найдены. Вытаскиваем роли из <code>[[Роль]]</code> и
                  пробуем распознать говорящего (например <code>ЛЕОН: ...</code>
                  ).
                </div>
              ) : (
                <div className="kanban-scene-cast-grid">
                  {openedRoles.map((role) => (
                    <KanbanSceneRoleCastTile
                      key={role}
                      roleKey={role}
                      roleTitle={displayRoleTitle(role)}
                      roleInfo={resolveRoleInfo(role)}
                      actorEmails={getRoleActors(scene, role)}
                      members={roleAssignmentMembers}
                      accessToken={accessToken}
                      onOpenRole={openRoleDetail}
                      onOpenRolesAdmin={() => setInfoSubPage("roles-admin")}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <Suspense
            fallback={
              <PageLoader variant="view" label="Загрузка редактора…" />
            }
          >
            <KanbanSceneMarkdownPanel sceneId={scene.id} />
          </Suspense>
        )}
      </div>
    </Modal>
  );
}
