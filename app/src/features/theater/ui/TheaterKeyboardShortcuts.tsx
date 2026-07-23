import { useScriptUI } from "../../script-ui";

export function TheaterKeyboardShortcuts() {
  const { swapTheaterPanels } = useScriptUI();

  return (
    <section
      className="theater-keyboard-hints theater-keyboard-hints--help"
      aria-label="Горячие клавиши 3D-театра"
    >
      <h3 className="theater-keyboard-hints__title">Горячие клавиши</h3>
      <dl>
        <dt>ЛКМ</dt>
        <dd>Вращать камеру вокруг точки</dd>
        <dt>ПКМ / СКМ</dt>
        <dd>Сдвигать камеру</dd>
        <dt>Колёсико</dt>
        <dd>Приблизить / отдалить</dd>
        <dt>W A S D</dt>
        <dd>Перемещение по залу, Shift — быстрее</dd>
        <dt>Q / E</dt>
        <dd>Камера вниз / вверх</dd>
        <dt>Home</dt>
        <dd>Общий вид зала</dd>
        <dt>F</dt>
        <dd>Кадрировать выбранный объект</dd>
        <dt>Ctrl+E</dt>
        <dd>
          {swapTheaterPanels
            ? "Скрыть или показать панели редактирования"
            : "Открыть режим редактирования"}
        </dd>
        <dt>Ctrl+Z / Ctrl+Y</dt>
        <dd>Отмена / повтор</dd>
        <dt>← → ↑ ↓</dt>
        <dd>Сдвиг модели, Shift — точнее</dd>
        <dt>Ctrl+Shift+←/→</dt>
        <dd>Поворот модели на 15°</dd>
        <dt>Ctrl+D</dt>
        <dd>Клонировать выбранное</dd>
        <dt>Ctrl+A</dt>
        <dd>Выбрать всё видимое на вкладке</dd>
        <dt>Delete</dt>
        <dd>Удалить выбранное</dd>
        <dt>H</dt>
        <dd>Скрыть или показать выбранное в 3D</dd>
        <dt>Shift+клик</dt>
        <dd>Добавить объект к выделению</dd>
        <dt>Esc</dt>
        <dd>Снять выделение</dd>
      </dl>
    </section>
  );
}
