import { Button } from "@shared/core/button/Button";

type AccountingPageHeaderProps = {
  createBlocked: boolean;
  showCreate: boolean;
  createDisabled: boolean;
  onToggleCreate: () => void;
};

export function AccountingPageHeader({
  createBlocked,
  showCreate,
  createDisabled,
  onToggleCreate,
}: AccountingPageHeaderProps) {
  const createTitle = createBlocked
    ? "Доступно владельцу и бухгалтеру / преподавателю"
    : undefined;

  return (
    <div className="accounting-page__header">
      <div>
        <h1 className="accounting-page__title">Бухгалтерия</h1>
        <p className="accounting-page__subtitle">
          Сборы по театрам, студиям и проектам.
        </p>
        <p className="accounting-page__wip" role="status">
          Раздел ещё в разработке — не для продакшена.
        </p>
      </div>
      <Button
        type="button"
        onClick={onToggleCreate}
        disabled={createDisabled}
        title={createTitle}
      >
        {showCreate ? "Отмена" : "Новый сбор"}
      </Button>
    </div>
  );
}
