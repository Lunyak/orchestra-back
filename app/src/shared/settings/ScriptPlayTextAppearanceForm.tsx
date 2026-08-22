import { Button } from "@shared/core/button/Button";
import cn from "classnames";
import type { CSSProperties } from "react";
import { useState } from "react";
import { formatSpeakerLabelDisplay } from "../components/show-script/utils/lightTokens";
import {
  applyScriptPlayTextAppearance,
  clampScriptPlayFontSizePx,
  clampScriptPlayLabelFontSizePx,
  clampScriptPlayLineHeight,
  clampScriptPlayLabelTextGapPx,
  clampScriptPlayParagraphGapEm,
  DEFAULT_SCRIPT_PLAY_LINE_HEIGHT,
  DEFAULT_SCRIPT_PLAY_LABEL_TEXT_GAP_PX,
  DEFAULT_SCRIPT_PLAY_PARAGRAPH_GAP_EM,
  getScriptPlayFontFamilyId,
  getScriptPlayFontSizePx,
  getScriptPlayLabelBgColor,
  getScriptPlayLabelFontFamilyId,
  getScriptPlayLabelFontSizePx,
  getScriptPlayLabelFontWeight,
  getScriptPlayLabelTextColor,
  getScriptPlayLabelTextGapPx,
  getScriptPlayLabelTextTransform,
  getScriptPlayLineHeight,
  getScriptPlayParagraphGapEm,
  getScriptPlayTextColor,
  MAX_SCRIPT_PLAY_FONT_SIZE_PX,
  MAX_SCRIPT_PLAY_LABEL_FONT_SIZE_PX,
  MAX_SCRIPT_PLAY_LINE_HEIGHT,
  MAX_SCRIPT_PLAY_LABEL_TEXT_GAP_PX,
  MAX_SCRIPT_PLAY_PARAGRAPH_GAP_EM,
  MIN_SCRIPT_PLAY_FONT_SIZE_PX,
  MIN_SCRIPT_PLAY_LABEL_FONT_SIZE_PX,
  MIN_SCRIPT_PLAY_LINE_HEIGHT,
  MIN_SCRIPT_PLAY_LABEL_TEXT_GAP_PX,
  MIN_SCRIPT_PLAY_PARAGRAPH_GAP_EM,
  SCRIPT_PLAY_FONT_FAMILY_PRESETS,
  SCRIPT_PLAY_LABEL_FONT_WEIGHT_OPTIONS,
  SCRIPT_PLAY_LABEL_TEXT_TRANSFORM_OPTIONS,
  setScriptPlayFontFamilyId,
  setScriptPlayFontSizePx,
  setScriptPlayLabelBgColor,
  setScriptPlayLabelFontFamilyId,
  setScriptPlayLabelFontSizePx,
  setScriptPlayLabelFontWeight,
  setScriptPlayLabelTextColor,
  setScriptPlayLabelTextGapPx,
  setScriptPlayLabelTextTransform,
  setScriptPlayLineHeight,
  setScriptPlayParagraphGapEm,
  setScriptPlayTextColor,
  type ScriptPlayFontFamilyId,
  type ScriptPlayLabelFontFamilyId,
  type ScriptPlayLabelTextTransform,
} from "./scriptPlayFontSize";
import "../components/show-script/style.css";
import "./script-play-text-appearance.css";

export type ScriptPlayTextAppearanceFormProps = {
  compact?: boolean;
};

function resolveAutoLabelFontSizePx(bodyFontSizePx: number): number {
  return clampScriptPlayLabelFontSizePx(Math.round(bodyFontSizePx * 0.92));
}

function rangeFillPercent(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return ((value - min) / (max - min)) * 100;
}

type PlayScriptSizeRangeFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  ariaLabel: string;
  onChange: (value: number) => void;
};

function PlayScriptSizeRangeField({
  label,
  value,
  min,
  max,
  ariaLabel,
  onChange,
}: PlayScriptSizeRangeFieldProps) {
  const fillPercent = rangeFillPercent(value, min, max);
  const rangeStyle = {
    ["--range-fill" as string]: `${fillPercent}%`,
  } as CSSProperties;

  return (
    <label className="settings-script-text-field">
      <span className="settings-script-text-field__label">{label}</span>
      <span className="settings-script-text-field__control settings-script-text-field__control--range">
        <input
          className="settings-script-text-field__range"
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          aria-label={ariaLabel}
          style={rangeStyle}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="settings-script-text-field__range-value" aria-hidden>
          {value}px
        </span>
      </span>
    </label>
  );
}

type PlayScriptColorFieldProps = {
  label: string;
  pickerValue: string;
  textValue: string;
  placeholder: string;
  pickerAriaLabel: string;
  hexAriaLabel: string;
  resetDisabled: boolean;
  onPickerChange: (value: string) => void;
  onTextChange: (value: string) => void;
  onReset: () => void;
};

function PlayScriptColorField({
  label,
  pickerValue,
  textValue,
  placeholder,
  pickerAriaLabel,
  hexAriaLabel,
  resetDisabled,
  onPickerChange,
  onTextChange,
  onReset,
}: PlayScriptColorFieldProps) {
  return (
    <div className="settings-script-text-field">
      <span className="settings-script-text-field__label">{label}</span>
      <span className="settings-script-text-field__control">
        <div className="settings-form-color-row">
          <input
            className="settings-script-text-color__picker"
            type="color"
            value={pickerValue}
            aria-label={pickerAriaLabel}
            onChange={(event) => onPickerChange(event.target.value)}
          />
          <input
            className="settings-script-text-field__input settings-script-text-color__hex"
            type="text"
            value={textValue}
            placeholder={placeholder}
            aria-label={hexAriaLabel}
            onChange={(event) => onTextChange(event.target.value)}
          />
          <Button
            type="button"
            className="settings-form-color-row__reset secondary"
            disabled={resetDisabled}
            onClick={onReset}
          >
            Сброс
          </Button>
        </div>
      </span>
    </div>
  );
}

export function ScriptPlayTextAppearanceForm({
  compact = false,
}: ScriptPlayTextAppearanceFormProps) {
  const [playFontSizePx, setPlayFontSizePxState] = useState(() => getScriptPlayFontSizePx());
  const [playTextColor, setPlayTextColorState] = useState(() => getScriptPlayTextColor());
  const [playFontFamilyId, setPlayFontFamilyIdState] = useState(() => getScriptPlayFontFamilyId());
  const [playLabelFontSizeCustom, setPlayLabelFontSizeCustom] = useState(
    () => getScriptPlayLabelFontSizePx() != null,
  );
  const [playLabelFontSizePx, setPlayLabelFontSizePxState] = useState(() => {
    const stored = getScriptPlayLabelFontSizePx();
    if (stored != null) return stored;
    return resolveAutoLabelFontSizePx(getScriptPlayFontSizePx());
  });
  const [playLabelTextColor, setPlayLabelTextColorState] = useState(() => getScriptPlayLabelTextColor());
  const [playLabelBgColor, setPlayLabelBgColorState] = useState(() => getScriptPlayLabelBgColor());
  const [playLabelFontFamilyId, setPlayLabelFontFamilyIdState] = useState(() =>
    getScriptPlayLabelFontFamilyId(),
  );
  const [playLabelFontWeight, setPlayLabelFontWeightState] = useState(() => getScriptPlayLabelFontWeight());
  const [playLabelTextTransform, setPlayLabelTextTransformState] = useState(() =>
    getScriptPlayLabelTextTransform(),
  );
  const [playLineHeightInput, setPlayLineHeightInput] = useState(() => {
    const value = getScriptPlayLineHeight();
    return value == null ? String(DEFAULT_SCRIPT_PLAY_LINE_HEIGHT) : String(value);
  });
  const [playLabelTextGapInput, setPlayLabelTextGapInput] = useState(() => {
    const value = getScriptPlayLabelTextGapPx();
    return value == null ? String(DEFAULT_SCRIPT_PLAY_LABEL_TEXT_GAP_PX) : String(value);
  });
  const [playParagraphGapInput, setPlayParagraphGapInput] = useState(() => {
    const value = getScriptPlayParagraphGapEm();
    return value == null ? String(DEFAULT_SCRIPT_PLAY_PARAGRAPH_GAP_EM) : String(value);
  });

  const playTextColorPickerValue = playTextColor || "#cbd5e1";
  const playLabelTextColorPickerValue = playLabelTextColor || "#94a3b8";
  const playLabelBgColorPickerValue = playLabelBgColor || "#1e3a5f";

  return (
    <section
      className={cn(
        "settings-card",
        "settings-script-text-card",
        "script-play-text-appearance",
        compact && "script-play-text-appearance--compact",
      )}
      aria-label="Стили отображения markdown"
    >
      <header className="settings-script-text-head">
        <h3 className="settings-card__title">Текст пьесы</h3>
        {compact ? null : (
          <p className="settings-script-text-head__hint">Вкладка «Текст» в сценарии и в спектакле</p>
        )}
      </header>

      <div className="settings-script-text-preview" aria-live="polite">
        <div className="settings-script-text-preview__title">Пример</div>
        <div className="settings-script-text-preview__body markdown-preview markdown-preview--play-inline-labels">
          <p className="markdown-dialog-line markdown-dialog-line--label-role">
            <span className="markdown-dialog-label">
              <span className="markdown-speaker-label" title="КРОТКИХ">
                {formatSpeakerLabelDisplay("КРОТКИХ")}
              </span>
            </span>
            <span className="markdown-dialog-text">
              <em className="markdown-parenthetical-remark">(весело)</em> Найдём!
            </span>
          </p>
          <p className="markdown-dialog-line markdown-dialog-line--label-role">
            <span className="markdown-dialog-label">
              <span className="markdown-speaker-label" title="ИВАН">
                {formatSpeakerLabelDisplay("ИВАН")}
              </span>
            </span>
            <span className="markdown-dialog-text">
              Вторая строка — с новой реплики, как в пьесе.
            </span>
          </p>
        </div>
      </div>

      <div className="settings-script-text-columns">
        <div className="settings-script-text-panel">
          <h4 className="settings-script-text-panel__title">Реплика</h4>

          <PlayScriptSizeRangeField
            label="Размер"
            value={playFontSizePx}
            min={MIN_SCRIPT_PLAY_FONT_SIZE_PX}
            max={MAX_SCRIPT_PLAY_FONT_SIZE_PX}
            ariaLabel="Размер шрифта реплики, px"
            onChange={(raw) => {
              const next = clampScriptPlayFontSizePx(raw);
              setPlayFontSizePxState(next);
              setScriptPlayFontSizePx(next);
              if (!playLabelFontSizeCustom) {
                setPlayLabelFontSizePxState(resolveAutoLabelFontSizePx(next));
              }
              applyScriptPlayTextAppearance();
            }}
          />

          <PlayScriptColorField
            label="Цвет"
            pickerValue={playTextColorPickerValue}
            textValue={playTextColor}
            placeholder="Цвет темы"
            pickerAriaLabel="Цвет текста реплики"
            hexAriaLabel="HEX цвета реплики"
            resetDisabled={!playTextColor}
            onPickerChange={(value) => {
              const next = setScriptPlayTextColor(value);
              setPlayTextColorState(next);
              applyScriptPlayTextAppearance();
            }}
            onTextChange={(value) => {
              const next = setScriptPlayTextColor(value);
              setPlayTextColorState(next);
              applyScriptPlayTextAppearance();
            }}
            onReset={() => {
              setScriptPlayTextColor("");
              setPlayTextColorState("");
              applyScriptPlayTextAppearance();
            }}
          />

          <label className="settings-script-text-field">
            <span className="settings-script-text-field__label">Шрифт</span>
            <span className="settings-script-text-field__control">
              <select
                className="settings-script-text-field__input settings-script-text-field__select"
                value={playFontFamilyId}
                aria-label="Шрифт текста реплики"
                onChange={(event) => {
                  const value = event.target.value as ScriptPlayFontFamilyId;
                  const next = setScriptPlayFontFamilyId(value);
                  setPlayFontFamilyIdState(next);
                  applyScriptPlayTextAppearance();
                }}
              >
                {SCRIPT_PLAY_FONT_FAMILY_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className="settings-script-text-field">
            <span className="settings-script-text-field__label">Интервал</span>
            <span className="settings-script-text-field__control">
              <input
                className="settings-script-text-field__input"
                type="number"
                min={MIN_SCRIPT_PLAY_LINE_HEIGHT}
                max={MAX_SCRIPT_PLAY_LINE_HEIGHT}
                step={0.05}
                value={playLineHeightInput}
                aria-label="Межстрочный интервал"
                onChange={(event) => {
                  const raw = event.target.value.trim();
                  setPlayLineHeightInput(raw);
                  if (raw === "") {
                    setScriptPlayLineHeight(null);
                    setPlayLineHeightInput(String(DEFAULT_SCRIPT_PLAY_LINE_HEIGHT));
                    applyScriptPlayTextAppearance();
                    return;
                  }
                  const next = clampScriptPlayLineHeight(Number(raw));
                  setPlayLineHeightInput(String(next));
                  setScriptPlayLineHeight(next);
                  applyScriptPlayTextAppearance();
                }}
              />
            </span>
          </label>

          <label className="settings-script-text-field">
            <span className="settings-script-text-field__label">Межабзац</span>
            <span className="settings-script-text-field__control">
              <input
                className="settings-script-text-field__input"
                type="number"
                min={MIN_SCRIPT_PLAY_PARAGRAPH_GAP_EM}
                max={MAX_SCRIPT_PLAY_PARAGRAPH_GAP_EM}
                step={0.05}
                value={playParagraphGapInput}
                aria-label="Отступ между абзацами, em"
                onChange={(event) => {
                  const raw = event.target.value.trim();
                  setPlayParagraphGapInput(raw);
                  if (raw === "") {
                    setScriptPlayParagraphGapEm(null);
                    setPlayParagraphGapInput(String(DEFAULT_SCRIPT_PLAY_PARAGRAPH_GAP_EM));
                    applyScriptPlayTextAppearance();
                    return;
                  }
                  const next = clampScriptPlayParagraphGapEm(Number(raw));
                  setPlayParagraphGapInput(String(next));
                  setScriptPlayParagraphGapEm(next);
                  applyScriptPlayTextAppearance();
                }}
              />
            </span>
          </label>
        </div>

        <div className="settings-script-text-panel">
          <h4 className="settings-script-text-panel__title">Лейбл роли</h4>

          <PlayScriptSizeRangeField
            label="Размер"
            value={playLabelFontSizePx}
            min={MIN_SCRIPT_PLAY_LABEL_FONT_SIZE_PX}
            max={MAX_SCRIPT_PLAY_LABEL_FONT_SIZE_PX}
            ariaLabel="Размер шрифта лейбла роли, px"
            onChange={(raw) => {
              const next = clampScriptPlayLabelFontSizePx(raw);
              setPlayLabelFontSizeCustom(true);
              setPlayLabelFontSizePxState(next);
              setScriptPlayLabelFontSizePx(next);
              applyScriptPlayTextAppearance();
            }}
          />

          <PlayScriptColorField
            label="Цвет"
            pickerValue={playLabelTextColorPickerValue}
            textValue={playLabelTextColor}
            placeholder="Как у реплики"
            pickerAriaLabel="Цвет текста лейбла роли"
            hexAriaLabel="HEX цвета лейбла"
            resetDisabled={!playLabelTextColor}
            onPickerChange={(value) => {
              const next = setScriptPlayLabelTextColor(value);
              setPlayLabelTextColorState(next);
              applyScriptPlayTextAppearance();
            }}
            onTextChange={(value) => {
              const next = setScriptPlayLabelTextColor(value);
              setPlayLabelTextColorState(next);
              applyScriptPlayTextAppearance();
            }}
            onReset={() => {
              setScriptPlayLabelTextColor("");
              setPlayLabelTextColorState("");
              applyScriptPlayTextAppearance();
            }}
          />

          <PlayScriptColorField
            label="Фон"
            pickerValue={playLabelBgColorPickerValue}
            textValue={playLabelBgColor}
            placeholder="Как в теме"
            pickerAriaLabel="Фон лейбла роли"
            hexAriaLabel="HEX фона лейбла"
            resetDisabled={!playLabelBgColor}
            onPickerChange={(value) => {
              const next = setScriptPlayLabelBgColor(value);
              setPlayLabelBgColorState(next);
              applyScriptPlayTextAppearance();
            }}
            onTextChange={(value) => {
              const next = setScriptPlayLabelBgColor(value);
              setPlayLabelBgColorState(next);
              applyScriptPlayTextAppearance();
            }}
            onReset={() => {
              setScriptPlayLabelBgColor("");
              setPlayLabelBgColorState("");
              applyScriptPlayTextAppearance();
            }}
          />

          <label className="settings-script-text-field">
            <span className="settings-script-text-field__label">Шрифт</span>
            <span className="settings-script-text-field__control">
              <select
                className="settings-script-text-field__input settings-script-text-field__select"
                value={playLabelFontFamilyId}
                aria-label="Шрифт лейбла роли"
                onChange={(event) => {
                  const value = event.target.value as ScriptPlayLabelFontFamilyId;
                  const next = setScriptPlayLabelFontFamilyId(value);
                  setPlayLabelFontFamilyIdState(next);
                  applyScriptPlayTextAppearance();
                }}
              >
                <option value="inherit">Как у текста реплики</option>
                {SCRIPT_PLAY_FONT_FAMILY_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className="settings-script-text-field">
            <span className="settings-script-text-field__label">Отступ</span>
            <span className="settings-script-text-field__control">
              <input
                className="settings-script-text-field__input"
                type="number"
                min={MIN_SCRIPT_PLAY_LABEL_TEXT_GAP_PX}
                max={MAX_SCRIPT_PLAY_LABEL_TEXT_GAP_PX}
                step={1}
                value={playLabelTextGapInput}
                aria-label="Отступ между лейблом и текстом, px"
                onChange={(event) => {
                  const raw = event.target.value.trim();
                  setPlayLabelTextGapInput(raw);
                  if (raw === "") {
                    setScriptPlayLabelTextGapPx(null);
                    applyScriptPlayTextAppearance();
                    return;
                  }
                  const next = clampScriptPlayLabelTextGapPx(Number(raw));
                  setScriptPlayLabelTextGapPx(next);
                  applyScriptPlayTextAppearance();
                }}
              />
            </span>
          </label>

          <div className="settings-script-text-field-row">
            <label className="settings-script-text-field">
              <span className="settings-script-text-field__label">Жирность</span>
              <span className="settings-script-text-field__control">
                <select
                  className="settings-script-text-field__input settings-script-text-field__select"
                  value={playLabelFontWeight}
                  aria-label="Начертание лейбла роли"
                  onChange={(event) => {
                    const next = setScriptPlayLabelFontWeight(Number(event.target.value));
                    setPlayLabelFontWeightState(next);
                    applyScriptPlayTextAppearance();
                  }}
                >
                  {SCRIPT_PLAY_LABEL_FONT_WEIGHT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <label className="settings-script-text-field">
              <span className="settings-script-text-field__label">Регистр</span>
              <span className="settings-script-text-field__control">
                <select
                  className="settings-script-text-field__input settings-script-text-field__select"
                  value={playLabelTextTransform}
                  aria-label="Регистр лейбла роли"
                  onChange={(event) => {
                    const next = setScriptPlayLabelTextTransform(
                      event.target.value as ScriptPlayLabelTextTransform,
                    );
                    setPlayLabelTextTransformState(next);
                    applyScriptPlayTextAppearance();
                  }}
                >
                  {SCRIPT_PLAY_LABEL_TEXT_TRANSFORM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
