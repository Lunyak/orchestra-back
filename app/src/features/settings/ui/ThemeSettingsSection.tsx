import cn from "classnames";
import { Button } from "@shared/core/button/Button";
import { THEME_SWITCHING_ENABLED } from "../../../shared/settings/themePreferences";
import { readCurrentThemeTokenValues } from "../../../shared/styles/theme/apply-theme";
import { useTheme } from "../../../shared/styles/theme/ThemeProvider";
import { BUILT_IN_THEMES, THEME_EDITOR_TOKENS } from "../../../shared/styles/theme/types";
import type { CustomTheme, ThemeId } from "../../../shared/styles/theme/types";
import { useState } from "react";
import "./theme-settings.css";

function toColorInput(value: string): string {
  const hex = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return "#808080";
}

function ThemeEditor({
  initialName,
  initialVariables,
  onSave,
  onCancel,
}: {
  initialName: string;
  initialVariables: Record<string, string>;
  onSave: (name: string, variables: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [variables, setVariables] = useState(initialVariables);

  return (
    <div className="theme-editor">
      <div className="theme-editor__header">
        <input
          className="theme-editor__name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название темы"
        />
      </div>
      <div className="theme-editor__tokens">
        {THEME_EDITOR_TOKENS.map((token) => (
          <label key={token.key} className="theme-editor__token">
            <span className="theme-editor__token-label">{token.label}</span>
            <span className="theme-editor__token-row">
              <input
                type="color"
                className="theme-editor__token-color"
                value={toColorInput(variables[token.key] ?? "#808080")}
                onChange={(e) =>
                  setVariables((prev) => ({ ...prev, [token.key]: e.target.value }))
                }
              />
              <input
                className="theme-editor__token-value"
                value={variables[token.key] ?? ""}
                onChange={(e) =>
                  setVariables((prev) => ({ ...prev, [token.key]: e.target.value }))
                }
              />
            </span>
          </label>
        ))}
      </div>
      <div className="theme-editor__actions">
        <Button type="button" className="primary" onClick={() => onSave(name, variables)}>
          Сохранить тему
        </Button>
        <Button type="button" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </div>
  );
}

export function ThemeSettingsSection() {
  const {
    activeThemeId,
    customThemes,
    setTheme,
    createCustomTheme,
    updateCustomTheme,
    removeCustomTheme,
  } = useTheme();

  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [editingTheme, setEditingTheme] = useState<CustomTheme | null>(null);
  const [draftName, setDraftName] = useState("Моя тема");
  const [draftVariables, setDraftVariables] = useState<Record<string, string>>({});

  if (!THEME_SWITCHING_ENABLED) return null;

  const openCreateEditor = () => {
    setEditingTheme(null);
    setDraftName("Моя тема");
    setDraftVariables(readCurrentThemeTokenValues());
    setEditorMode("create");
  };

  const openEditEditor = (theme: CustomTheme) => {
    setEditingTheme(theme);
    setDraftName(theme.name);
    setDraftVariables({ ...theme.variables });
    setEditorMode("edit");
  };

  const closeEditor = () => {
    setEditorMode(null);
    setEditingTheme(null);
  };

  return (
    <section className="settings-card theme-settings">
      <h3 className="settings-card__title">Тема оформления</h3>
      <p className="theme-settings__hint">
        Встроенные темы задаются в CSS. Свои темы сохраняются в браузере и переопределяют ключевые
        цвета через переменные из <code>variables.css</code>.
      </p>

      <div className="theme-settings__grid">
        {BUILT_IN_THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            className={cn("theme-card", activeThemeId === theme.id && "theme-card--active")}
            aria-pressed={activeThemeId === theme.id}
            onClick={() => setTheme(theme.id)}
          >
            <div className="theme-card__swatches">
              {theme.preview.map((color) => (
                <span
                  key={color}
                  className="theme-card__swatch"
                  style={{ "--theme-swatch-color": color } as React.CSSProperties}
                />
              ))}
            </div>
            <div className="theme-card__name">{theme.name}</div>
            <div className="theme-card__desc">{theme.description}</div>
          </button>
        ))}
      </div>

      {customThemes.length > 0 ? (
        <div className="theme-custom-list">
          <h3>Свои темы</h3>
          {customThemes.map((theme) => {
            const themeId: ThemeId = `custom:${theme.id}`;
            return (
              <div key={theme.id} className="theme-custom-row">
                <span>{theme.name}</span>
                <div className="theme-custom-row__actions">
                  <Button
                    type="button"
                    className={cn(activeThemeId === themeId ? "button--active" : "secondary")}
                    onClick={() => setTheme(themeId)}
                  >
                    {activeThemeId === themeId ? "Активна" : "Применить"}
                  </Button>
                  <Button type="button" onClick={() => openEditEditor(theme)}>
                    Редактировать
                  </Button>
                  <Button type="button" className="danger" onClick={() => removeCustomTheme(theme.id)}>
                    Удалить
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {!editorMode ? (
        <div className="theme-editor__actions">
          <Button type="button" className="primary" onClick={openCreateEditor}>
            Создать тему из текущей
          </Button>
        </div>
      ) : (
        <ThemeEditor
          key={editorMode === "edit" ? editingTheme?.id : "create"}
          initialName={draftName}
          initialVariables={draftVariables}
          onSave={(name, variables) => {
            if (editorMode === "edit" && editingTheme) {
              updateCustomTheme({
                ...editingTheme,
                name,
                variables,
                updatedAt: Date.now(),
              });
            } else {
              createCustomTheme(name, variables);
            }
            closeEditor();
          }}
          onCancel={closeEditor}
        />
      )}
    </section>
  );
}
