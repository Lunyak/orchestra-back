export type LightWorkflowGuideProps = {
  variant?: "full" | "compact";
};

export function LightWorkflowGuide({ variant = "full" }: LightWorkflowGuideProps) {
  if (variant === "compact") {
    return (
      <div className="light-workflow-guide light-workflow-guide--compact">
        <p>
          <strong>Схема</strong> показывает записанный look. Настройте фейдеры на вкладке{" "}
          <strong>«Свет»</strong>, затем <strong>«Записать в картину»</strong> — сюда подтянутся
          программа и все положения фейдеров.
        </p>
      </div>
    );
  }

  return (
    <div className="light-workflow-guide">
      <div className="light-workflow-guide__title">Как записать свет в картину</div>
      <ol className="light-workflow-guide__steps">
        <li>
          В тексте шага (вкладка <strong>Схема</strong> / Пьеса) есть <code>### Картина N</code> —
          выберите картину в полоске ниже.
        </li>
        <li>
          <strong>Программы П1–П8</strong> — пресеты всего пульта на весь спектакль: софиты + уровни.
          Выберите П3, выставите look → сохранится в П3; П4 — другой look. Переключение П3↔П4
          резко меняет свет на пульте.
        </li>
        <li>
          <strong>Записать в картину</strong> — снимок для <em>этой картины в тексте</em>: какая программа
          активна (П…) + все фейдеры сейчас. На схеме и в строке <code>- **Свет**:</code>.
        </li>
        <li>
          <strong>Применить на пульт</strong> — загрузить ранее записанный look обратно для правки.
        </li>
      </ol>
      <p className="light-workflow-guide__note">
        Два уровня: <strong>программы</strong> — общие пресеты на всю сцену; <strong>картина</strong> — какой
        номер П и какие фейдеры в этом моменте спектакля. Каналы K1–K8 — подписи заливки ниже.
      </p>
    </div>
  );
}
