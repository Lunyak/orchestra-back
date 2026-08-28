import { Button } from "@shared/core/button/Button";

export type RoleWorkbookHeaderProps = {
  isActorWorkbookOpen: boolean;
  activeWorkbookSection: string | null;
  projectSlug: string;
  roleDisplayTitle: string;
  selectedActorLabel: string;
  canEdit: boolean;
  onCloseActorWorkbook: () => void;
  onCloseWorkbookSection: () => void;
  onGoToProfile: () => void;
};

export function RoleWorkbookHeader(props: RoleWorkbookHeaderProps) {
  const {
    isActorWorkbookOpen,
    activeWorkbookSection,
    projectSlug,
    roleDisplayTitle,
    selectedActorLabel,
    canEdit,
    onCloseActorWorkbook,
    onCloseWorkbookSection,
    onGoToProfile,
  } = props;

  const title = isActorWorkbookOpen ? "Актёрская тетрадь" : "Рисунок роли";

  return (
    <div className="rolewb-header">
      <div>
        <h2 className="rolewb-header__title">{title}</h2>
        <p className="rolewb-subtitle">
          Проект: <b>{projectSlug}</b> · Роль: <b>{roleDisplayTitle}</b>
          {isActorWorkbookOpen ? (
            <>
              {" · "}
              Актёр: <b>{selectedActorLabel}</b>
              {!canEdit ? <> · только просмотр</> : null}
            </>
          ) : null}
        </p>
      </div>
      <div className="rolewb-row">
        {isActorWorkbookOpen ? (
          <Button className="secondary" type="button" onClick={onCloseActorWorkbook}>
            ← Назад к роли
          </Button>
        ) : null}
        {isActorWorkbookOpen && activeWorkbookSection ? (
          <Button className="secondary" type="button" onClick={onCloseWorkbookSection}>
            ← К разделам
          </Button>
        ) : null}
        <Button className="secondary" type="button" onClick={onGoToProfile}>
          Профиль
        </Button>
      </div>
    </div>
  );
}
