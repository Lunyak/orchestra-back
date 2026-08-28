import { Button } from "@shared/core/button/Button";

type SettingsBotTestPanelProps = {
  testChatId: string;
  setTestChatId: (value: string) => void;
  testText: string;
  setTestText: (value: string) => void;
  testLoading: boolean;
  testError: string | null;
  testOk: string | null;
  canSendTest: boolean;
  onSend: () => void;
};

export function SettingsBotTestPanel({
  testChatId,
  setTestChatId,
  testText,
  setTestText,
  testLoading,
  testError,
  testOk,
  canSendTest,
  onSend,
}: SettingsBotTestPanelProps) {
  return (
    <section className="settings-card settings-bot-section">
      <h3 className="settings-card__title">Тестовое сообщение</h3>
      <div className="settings-bot-grid">
        <label className="settings-bot-field">
          <span className="settings-bot-field__label">chat / peer</span>
          <input
            type="text"
            value={testChatId}
            onChange={(e) => setTestChatId(e.target.value)}
          />
        </label>
        <label className="settings-bot-field settings-bot-field--wide">
          <span className="settings-bot-field__label">Текст</span>
          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            rows={3}
          />
        </label>
      </div>
      <div className="settings-invite-row settings-bot-row settings-bot-row--footer">
        <Button
          type="button"
          className="primary"
          onClick={onSend}
          disabled={testLoading || !canSendTest}
        >
          {testLoading ? "Отправляем…" : "Отправить"}
        </Button>
        {testOk ? (
          <span className="settings-bot-ok" role="status">
            {testOk}
          </span>
        ) : null}
        {testError ? (
          <div className="settings-invite-error settings-invite-error--flush">
            {testError}
          </div>
        ) : null}
      </div>
    </section>
  );
}
