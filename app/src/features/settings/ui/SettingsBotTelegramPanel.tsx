import { Buttons } from "@shared/components/buttons/Buttons";
import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { Button } from "@shared/core/button/Button";
import { LabeledCheckbox } from "@shared/core/labeled-checkbox/LabeledCheckbox";
import type { Dispatch, SetStateAction } from "react";
import type {
  BotVariableItem,
  TelegramBotIntegrationSummary,
} from "../../../sync/api/telegram-bots";
import {
  TELEGRAM_BOT_PROP_FIELDS,
  telegramTitle,
  type BotPatchState,
} from "../model/settings-bot-helpers";

type SettingsBotTelegramPanelProps = {
  bot: TelegramBotIntegrationSummary;
  botPatch: BotPatchState;
  setBotPatch: Dispatch<SetStateAction<BotPatchState>>;
  botPatchSaving: boolean;
  botPatchError: string | null;
  onSave: () => void;
  onDelete: () => void;
  vars: BotVariableItem[];
  varsLoading: boolean;
  varsError: string | null;
  newVarKey: string;
  setNewVarKey: (value: string) => void;
  newVarValue: string;
  setNewVarValue: (value: string) => void;
  newVarIsSecret: boolean;
  setNewVarIsSecret: (value: boolean) => void;
  newVarSaving: boolean;
  newVarError: string | null;
  canCreateVar: boolean;
  onCreateVar: () => void;
  onDeleteVar: (key: string) => void;
};

export function SettingsBotTelegramPanel({
  bot,
  botPatch,
  setBotPatch,
  botPatchSaving,
  botPatchError,
  onSave,
  onDelete,
  vars,
  varsLoading,
  varsError,
  newVarKey,
  setNewVarKey,
  newVarValue,
  setNewVarValue,
  newVarIsSecret,
  setNewVarIsSecret,
  newVarSaving,
  newVarError,
  canCreateVar,
  onCreateVar,
  onDeleteVar,
}: SettingsBotTelegramPanelProps) {
  const usernameLabel = bot.botUsername || "—";
  const botIdLabel = bot.botTelegramUserId || "—";
  const newVarInputType = newVarIsSecret ? "password" : "text";
  const hasVars = vars.length > 0;

  return (
    <>
      <section className="settings-card settings-bot-section">
        <div className="settings-bot-detail-head">
          <div className="settings-bot-detail-head__text">
            <h3 className="settings-card__title settings-bot-detail-head__title">
              {telegramTitle(bot)}
            </h3>
            <p className="settings-sync-hint">
              Telegram · @{usernameLabel} · id {botIdLabel}
            </p>
          </div>
          <Button type="button" className="danger" onClick={onDelete}>
            Удалить
          </Button>
        </div>

        <h4 className="settings-bot-subheading">Публикация</h4>
        <div className="settings-bot-props">
          {TELEGRAM_BOT_PROP_FIELDS.map(({ field, label, placeholder }) => (
            <label key={field} className="settings-bot-prop">
              <span className="settings-bot-prop__key" title={field}>
                {label}
              </span>
              <input
                type="text"
                value={botPatch[field]}
                onChange={(e) =>
                  setBotPatch((s) => ({ ...s, [field]: e.target.value }))
                }
                placeholder={placeholder}
              />
            </label>
          ))}
        </div>
        <div className="settings-invite-row settings-bot-row settings-bot-row--footer">
          <Button
            type="button"
            className="primary"
            onClick={onSave}
            disabled={botPatchSaving}
          >
            {botPatchSaving ? "Сохраняем…" : "Сохранить"}
          </Button>
          {botPatchError ? (
            <div className="settings-invite-error settings-invite-error--flush">
              {botPatchError}
            </div>
          ) : null}
        </div>
      </section>

      <section className="settings-card settings-bot-section">
        <h3 className="settings-card__title">Переменные</h3>
        <div className="settings-invite-row settings-bot-row">
          <input
            type="text"
            className="settings-invite-input"
            value={newVarKey}
            onChange={(e) => setNewVarKey(e.target.value)}
            placeholder="key"
          />
          <input
            type={newVarInputType}
            className="settings-invite-input"
            value={newVarValue}
            onChange={(e) => setNewVarValue(e.target.value)}
            placeholder="value"
          />
          <LabeledCheckbox
            className="settings-bot-checkbox"
            checked={newVarIsSecret}
            onChange={setNewVarIsSecret}
          >
            Секрет
          </LabeledCheckbox>
          <Button
            type="button"
            className="primary"
            onClick={onCreateVar}
            disabled={newVarSaving || !canCreateVar}
          >
            {newVarSaving ? "Сохраняем…" : "Добавить"}
          </Button>
        </div>
        {newVarError ? (
          <div className="settings-invite-error">{newVarError}</div>
        ) : null}
        {varsLoading ? (
          <PageLoader variant="view" label="Загрузка…" />
        ) : varsError ? (
          <div className="settings-invite-error">{varsError}</div>
        ) : !hasVars ? (
          <p className="settings-sync-hint">Переменных пока нет.</p>
        ) : (
          <ul className="settings-bot-vars">
            {vars.map((v) => (
              <li key={v.id} className="settings-bot-var-row">
                <code className="settings-bot-var-key">{v.key}</code>
                <span className="settings-bot-var-value">
                  {v.isSecret ? "(секрет)" : v.value}
                </span>
                <Buttons.DeleteButton
                  type="button"
                  className="settings-member-remove settings-bot-var-remove"
                  onClick={() => onDeleteVar(v.key)}
                  aria-label={`Удалить ${v.key}`}
                  title="Удалить"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
