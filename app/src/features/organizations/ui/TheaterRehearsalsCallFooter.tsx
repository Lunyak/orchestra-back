import { Button } from "@shared/core/button/Button";
import { LabeledCheckbox } from "@shared/core/labeled-checkbox/LabeledCheckbox";

type TheaterRehearsalsCallFooterProps = {
  publishError: string;
  selectedCanManage: boolean;
  selectedCanPublish: boolean;
  selectedPublished: boolean;
  creating: boolean;
  publishing: boolean;
  includeUnavailableInCall: boolean;
  onIncludeUnavailableChange: (value: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onPublish: () => void;
  onOpen: () => void;
};

export function TheaterRehearsalsCallFooter({
  publishError,
  selectedCanManage,
  selectedCanPublish,
  selectedPublished,
  creating,
  publishing,
  includeUnavailableInCall,
  onIncludeUnavailableChange,
  onEdit,
  onDelete,
  onPublish,
  onOpen,
}: TheaterRehearsalsCallFooterProps) {
  const publishTitle = selectedPublished
    ? "Пересобрать список участников. Telegram обновит уже отправленное сообщение или уйдёт по расписанию бота"
    : "Собирает вызов в приложении. Telegram — сразу или по расписанию бота, смотрите кнопку «Бот» в списке";
  const publishLabel = publishing
    ? "Публикую…"
    : selectedPublished
      ? "Обновить публикацию"
      : "Опубликовать";

  return (
    <div className="sessions-session-footer theater-rehearsals-page__call-footer">
      {publishError ? (
        <div className="rehearsals-error" role="alert">
          {publishError}
        </div>
      ) : null}
      <div className="theater-rehearsals-page__footer-actions">
        {selectedCanManage ? (
          <div className="theater-rehearsals-page__footer-row">
            <Button
              type="button"
              onClick={onEdit}
              disabled={creating}
              title="Изменить название и время"
            >
              Изменить
            </Button>
            <Button
              type="button"
              onClick={onDelete}
              disabled={creating}
              title="Удалить репетицию"
            >
              Удалить
            </Button>
          </div>
        ) : null}
        {selectedCanPublish ? (
          <LabeledCheckbox
            className="sessions-session-footer__call-toggle"
            checked={includeUnavailableInCall}
            onChange={onIncludeUnavailableChange}
          >
            Звать без занятости / с отрицательной
          </LabeledCheckbox>
        ) : (
          <p className="rehearsals-muted theater-rehearsals-page__call-hint">
            Публикация вызова доступна для репетиций театра.
          </p>
        )}
        <div className="theater-rehearsals-page__footer-row">
          {selectedCanPublish ? (
            <Button
              type="button"
              onClick={onPublish}
              disabled={publishing || creating}
              title={publishTitle}
            >
              {publishLabel}
            </Button>
          ) : null}
          <Button type="button" onClick={onOpen}>
            Открыть репетицию
          </Button>
        </div>
      </div>
    </div>
  );
}
