import { Buttons } from "@shared/components/buttons/Buttons";
import { Button } from "@shared/core/button/Button";
import { LabeledCheckbox } from "@shared/core/labeled-checkbox/LabeledCheckbox";
import type { MessengerBridgeSummary } from "../../../sync/api/messenger-bots";
import {
  platformLabel,
  type BridgeOption,
} from "../model/settings-bot-helpers";

type SettingsBotBridgesPanelProps = {
  bridges: MessengerBridgeSummary[];
  bridgeOptions: BridgeOption[];
  bridgeTitle: string;
  setBridgeTitle: (value: string) => void;
  bridgePrimaryKey: string;
  setBridgePrimaryKey: (value: string) => void;
  bridgeMirrorKeys: string[];
  bridgeSaving: boolean;
  bridgeError: string | null;
  canCreateBridge: boolean;
  onToggleMirror: (key: string) => void;
  onCreateBridge: () => void;
  onToggleBridge: (bridgeId: string, enabled: boolean) => void;
  onDeleteBridge: (bridgeId: string) => void;
};

export function SettingsBotBridgesPanel({
  bridges,
  bridgeOptions,
  bridgeTitle,
  setBridgeTitle,
  bridgePrimaryKey,
  setBridgePrimaryKey,
  bridgeMirrorKeys,
  bridgeSaving,
  bridgeError,
  canCreateBridge,
  onToggleMirror,
  onCreateBridge,
  onToggleBridge,
  onDeleteBridge,
}: SettingsBotBridgesPanelProps) {
  const hasBridges = bridges.length > 0;
  const mirrorOptions = bridgeOptions.filter(
    (o) => o.key !== bridgePrimaryKey,
  );

  return (
    <section className="settings-card settings-bot-section">
      <h3 className="settings-card__title">Синхронизация групп</h3>
      <p className="settings-sync-hint">
        Один primary-источник. Сообщения людей из его чата копируются в зеркала
        (без эха от ботов).
      </p>

      {hasBridges ? (
        <ul className="settings-bot-bridges">
          {bridges.map((b) => {
            const primary = b.members.find((m) => m.role === "primary");
            const mirrors = b.members.filter((m) => m.role === "mirror");
            const primaryLabel = primary
              ? platformLabel(primary.platform)
              : "—";
            const mirrorsLabel =
              mirrors.map((m) => platformLabel(m.platform)).join(", ") || "—";
            const statusLabel = b.enabled ? "вкл" : "выкл";
            const toggleLabel = b.enabled ? "Выкл" : "Вкл";

            return (
              <li key={b.id} className="settings-bot-bridge-row">
                <div className="settings-bot-bridge-row__main">
                  <strong>{b.title || "Мост"}</strong>
                  <span className="settings-sync-hint">
                    {statusLabel} · primary {primaryLabel} → {mirrorsLabel}
                  </span>
                </div>
                <div className="settings-bot-bridge-row__actions">
                  <Button
                    type="button"
                    onClick={() => onToggleBridge(b.id, b.enabled)}
                  >
                    {toggleLabel}
                  </Button>
                  <Buttons.DeleteButton
                    type="button"
                    className="settings-member-remove"
                    onClick={() => onDeleteBridge(b.id)}
                    aria-label="Удалить мост"
                    title="Удалить"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="settings-sync-hint">Мостов пока нет.</p>
      )}

      <h4 className="settings-bot-subheading">Новый мост</h4>
      <div className="settings-invite-row settings-bot-row">
        <input
          type="text"
          className="settings-invite-input"
          value={bridgeTitle}
          onChange={(e) => setBridgeTitle(e.target.value)}
          placeholder="Название моста"
        />
      </div>
      <label className="settings-bot-field">
        <span className="settings-bot-field__label">Primary</span>
        <select
          value={bridgePrimaryKey}
          onChange={(e) => setBridgePrimaryKey(e.target.value)}
        >
          <option value="">Выберите канал</option>
          {bridgeOptions.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div className="settings-bot-mirror-list">
        <span className="settings-bot-field__label">Зеркала</span>
        {mirrorOptions.map((o) => {
          const checked = bridgeMirrorKeys.includes(o.key);
          return (
            <LabeledCheckbox
              key={o.key}
              className="settings-bot-checkbox"
              checked={checked}
              onChange={() => onToggleMirror(o.key)}
            >
              {o.label}
            </LabeledCheckbox>
          );
        })}
      </div>
      <div className="settings-invite-row settings-bot-row settings-bot-row--footer">
        <Button
          type="button"
          className="primary"
          onClick={onCreateBridge}
          disabled={bridgeSaving || !canCreateBridge}
        >
          {bridgeSaving ? "Создаём…" : "Создать мост"}
        </Button>
        {bridgeError ? (
          <div className="settings-invite-error settings-invite-error--flush">
            {bridgeError}
          </div>
        ) : null}
      </div>
    </section>
  );
}
