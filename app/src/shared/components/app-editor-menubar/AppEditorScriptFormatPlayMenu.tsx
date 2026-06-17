export type AppEditorScriptFormatPlayMenuProps = {
  disabled?: boolean;
  onOpen: () => void;
};

export function AppEditorScriptFormatPlayMenu({
  disabled = false,
  onOpen,
}: AppEditorScriptFormatPlayMenuProps) {
  return (
    <div className="theater-editor-menubar__menu">
      <span className="theater-editor-menubar__menu-title">Пьеса</span>
      <div
        className="theater-editor-menubar__options"
        role="menu"
        aria-label="Форматирование пьесы"
      >
        <button
          type="button"
          role="menuitem"
          className="theater-editor-menubar__option"
          disabled={disabled}
          title={
            disabled
              ? "Откройте шаг на вкладке Текст, Тех. карта или Экспликация"
              : undefined
          }
          onClick={() => {
            if (disabled) return;
            onOpen();
          }}
        >
          Отформатировать текст
        </button>
      </div>
    </div>
  );
}
