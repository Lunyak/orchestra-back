import { Button } from "@shared/core/button/Button";
import { LabeledCheckbox } from "@shared/core/labeled-checkbox/LabeledCheckbox";
import { Modal } from "@shared/core/modal/Modal";
import { PageLoader } from "@shared/components/page-loader/PageLoader";
import {
  useCallBotSettings,
  type CallNotifyMode,
} from "../model/useCallBotSettings";
import "./call-bot-settings.css";

const ADVANCE_DAYS = [1, 2, 3, 5, 7];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

type CallBotSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function CallBotSettingsModal({
  isOpen,
  onClose,
}: CallBotSettingsModalProps) {
  const vm = useCallBotSettings(isOpen);
  const showAdvanceDays = vm.draft.callNotifyMode === "advance";
  const hasBot = Boolean(vm.bot);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="sessions-bot-settings-modal"
      ariaLabel="Настройки бота"
    >
      <div className="sessions-bot-settings-modal__body">
        <div className="sessions-bot-settings-modal__content">
          <h2 className="sessions-bot-settings-modal__title">Бот и вызов</h2>
          {vm.loading ? (
            <PageLoader variant="view" label="Загрузка настроек…" />
          ) : null}
          {!vm.loading && !hasBot ? (
            <p className="sessions-bot-settings-modal__hint">
              Подключите Telegram-бота в Настройках — тогда вызов можно слать
              по расписанию, не дублируя кнопку «Опубликовать».
            </p>
          ) : null}
          {!vm.loading && hasBot ? (
            <>
              <p className="sessions-bot-settings-modal__hint">
                «Опубликовать» собирает список в приложении. Telegram уходит
                сразу только в режиме «по кнопке»; иначе бот напишет в день
                репетиции или заранее — без лишнего пинга.
              </p>
              <label className="sessions-bot-settings-modal__field">
                <span className="sessions-bot-settings-modal__label">
                  Когда слать вызов
                </span>
                <select
                  className="native-select"
                  value={vm.draft.callNotifyMode}
                  onChange={(event) => {
                    const nextMode = event.target.value as CallNotifyMode;
                    vm.setDraft((prev) => ({
                      ...prev,
                      callNotifyMode: nextMode,
                    }));
                  }}
                >
                  <option value="on_publish">Вместе с «Опубликовать»</option>
                  <option value="same_day">В день репетиции</option>
                  <option value="advance">Заранее</option>
                </select>
              </label>
              {showAdvanceDays ? (
                <label className="sessions-bot-settings-modal__field">
                  <span className="sessions-bot-settings-modal__label">
                    За сколько дней
                  </span>
                  <select
                    className="native-select"
                    value={String(vm.draft.callNotifyAdvanceDays)}
                    onChange={(event) => {
                      const nextDays = Number(event.target.value);
                      vm.setDraft((prev) => ({
                        ...prev,
                        callNotifyAdvanceDays: nextDays,
                      }));
                    }}
                  >
                    {ADVANCE_DAYS.map((days) => (
                      <option key={days} value={days}>
                        {days}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="sessions-bot-settings-modal__field">
                <span className="sessions-bot-settings-modal__label">
                  Час отправки (МСК)
                </span>
                <select
                  className="native-select"
                  value={String(vm.draft.callNotifyHour)}
                  disabled={vm.draft.callNotifyMode === "on_publish"}
                  onChange={(event) => {
                    const nextHour = Number(event.target.value);
                    vm.setDraft((prev) => ({
                      ...prev,
                      callNotifyHour: nextHour,
                    }));
                  }}
                >
                  {HOURS.map((hour) => {
                    const label = `${String(hour).padStart(2, "0")}:00`;
                    return (
                      <option key={hour} value={hour}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </label>
              <LabeledCheckbox
                checked={vm.draft.availabilityRemindEnabled}
                onChange={(checked) => {
                  vm.setDraft((prev) => ({
                    ...prev,
                    availabilityRemindEnabled: checked,
                  }));
                }}
              >
                Писать в личку, если занятость на месяц не заполнена
              </LabeledCheckbox>
            </>
          ) : null}
          {vm.error ? (
            <p className="sessions-bot-settings-modal__error" role="alert">
              {vm.error}
            </p>
          ) : null}
          {vm.message ? (
            <p className="sessions-bot-settings-modal__message">{vm.message}</p>
          ) : null}
        </div>
        <div className="sessions-bot-settings-modal__actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
          {hasBot ? (
            <Button
              type="button"
              variant="secondary"
              disabled={vm.reminding || vm.loading}
              onClick={() => void vm.remindNow()}
            >
              {vm.reminding ? "Отправляю…" : "Напомнить о занятости"}
            </Button>
          ) : null}
          {hasBot ? (
            <Button
              type="button"
              disabled={vm.saving || vm.loading}
              onClick={() => void vm.save()}
            >
              {vm.saving ? "Сохраняю…" : "Сохранить"}
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
