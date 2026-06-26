import cn from "classnames";
import { useEffect, useRef, useState } from "react";
import { Modal } from "../../core/modal/Modal";
import {
  MAX_LIGHT_CONSOLE_SLOTS,
  MIN_LIGHT_CONSOLE_SLOTS,
  type LightConsoleLayoutCounts,
} from "./light-channels-mutate";
import "./light-console-settings-modal.css";

export type LightConsoleSettingsModalProps = {
  isOpen: boolean;
  layout: LightConsoleLayoutCounts;
  onClose: () => void;
  onApply: (layout: LightConsoleLayoutCounts) => void;
};

type DraftLayout = {
  channelCount: string;
  faderCount: string;
  programCount: string;
};

function toDraft(layout: LightConsoleLayoutCounts): DraftLayout {
  return {
    channelCount: String(layout.channelCount),
    faderCount: String(layout.faderCount),
    programCount: String(layout.programCount),
  };
}

function parseDraftValue(raw: string, fallback: number): number {
  const parsed = Math.trunc(Number(raw));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(MIN_LIGHT_CONSOLE_SLOTS, Math.min(MAX_LIGHT_CONSOLE_SLOTS, parsed));
}

export function LightConsoleSettingsModal({
  isOpen,
  layout,
  onClose,
  onApply,
}: LightConsoleSettingsModalProps) {
  const [draft, setDraft] = useState<DraftLayout>(() => toDraft(layout));
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setDraft(toDraft(layout));
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, layout]);

  const updateDraft = (key: keyof DraftLayout, value: string) => {
    setDraft((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleApply = () => {
    onApply({
      channelCount: parseDraftValue(draft.channelCount, layout.channelCount),
      faderCount: parseDraftValue(draft.faderCount, layout.faderCount),
      programCount: parseDraftValue(draft.programCount, layout.programCount),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="light-console-settings-modal"
      ariaLabelledBy="light-console-settings-title"
    >
      <header className="light-console-settings-modal__header">
        <h2 id="light-console-settings-title" className="light-console-settings-modal__title">
          Настройка пульта
        </h2>
        <button
          type="button"
          className="light-console-settings-modal__close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
      </header>

      <div className="light-console-settings-modal__body">
        <p className="light-console-settings-modal__intro">
          <strong>K</strong> — каналы памяти слева, <strong>F</strong> — ползунки, <strong>П</strong> —
          кнопки пресетов сверху. Числа задаются независимо.
        </p>

        <label className="light-console-settings-modal__field">
          <span className="light-console-settings-modal__label">Каналы (K)</span>
          <input
            className="light-console-settings-modal__input"
            type="number"
            min={MIN_LIGHT_CONSOLE_SLOTS}
            max={MAX_LIGHT_CONSOLE_SLOTS}
            value={draft.channelCount}
            onChange={(event) => updateDraft("channelCount", event.target.value)}
          />
          <span className="light-console-settings-modal__hint">Кнопки K1, K2… слева на пульте</span>
        </label>

        <label className="light-console-settings-modal__field">
          <span className="light-console-settings-modal__label">Фейдеры (F)</span>
          <input
            className="light-console-settings-modal__input"
            type="number"
            min={MIN_LIGHT_CONSOLE_SLOTS}
            max={MAX_LIGHT_CONSOLE_SLOTS}
            value={draft.faderCount}
            onChange={(event) => updateDraft("faderCount", event.target.value)}
          />
          <span className="light-console-settings-modal__hint">Вертикальные ползунки F1, F2…</span>
        </label>

        <label className="light-console-settings-modal__field">
          <span className="light-console-settings-modal__label">Программы (П)</span>
          <input
            className="light-console-settings-modal__input"
            type="number"
            min={MIN_LIGHT_CONSOLE_SLOTS}
            max={MAX_LIGHT_CONSOLE_SLOTS}
            value={draft.programCount}
            onChange={(event) => updateDraft("programCount", event.target.value)}
          />
          <span className="light-console-settings-modal__hint">Кнопки П1, П2… над фейдерами</span>
        </label>
      </div>

      <footer className={cn("light-console-settings-modal__footer")}>
        <button type="button" className="light-console-settings-modal__btn" onClick={onClose}>
          Отмена
        </button>
        <button
          type="button"
          className={cn("light-console-settings-modal__btn", "light-console-settings-modal__btn--primary")}
          onClick={handleApply}
        >
          Применить
        </button>
      </footer>
    </Modal>
  );
}
