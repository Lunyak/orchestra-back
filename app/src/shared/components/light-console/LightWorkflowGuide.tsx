import { SCRIPT_MARKDOWN_NOTES_TAB_LABEL } from "../show-script/script-markdown-tab-labels";

export type LightWorkflowGuideProps = {
  variant?: "full" | "compact";
};

export function LightWorkflowGuide({ variant = "full" }: LightWorkflowGuideProps) {
  if (variant === "compact") {
    return (
      <div className="light-workflow-guide light-workflow-guide--compact">
        <p>
          <strong>{SCRIPT_MARKDOWN_NOTES_TAB_LABEL}</strong> — снимок картины. На пульте крутите{" "}
          <strong>F</strong>, выберите{" "}
          <strong>P</strong>, затем <strong>«Записать в картину»</strong>. Театр и репетиция делят
          одну доску F; перелистывание картины в ленте подставляет её снимок.
        </p>
      </div>
    );
  }

  return (
    <div className="light-workflow-guide">
      <div className="light-workflow-guide__title">Как записать свет в картину</div>
      <ol className="light-workflow-guide__steps">
        <li>
          В тексте шага (вкладка <strong>{SCRIPT_MARKDOWN_NOTES_TAB_LABEL}</strong> / Пьеса) есть{" "}
          <code>### Картина N</code> —
          выберите картину в полоске ниже.
        </li>
        <li>
          <strong>P1–P8</strong> — общие пресеты пульта на весь спектакль (все F). P3 — один look, P4 —
          другой; переключение P3↔P4 сразу меняет уровни на доске.
        </li>
        <li>
          <strong>Записать в картину</strong> — снимок момента: какой <strong>P</strong> и какие{" "}
          <strong>F</strong> сейчас. В строке <code>- **Свет**:</code> и на схеме.
        </li>
        <li>
          <strong>Применить на пульт</strong> — загрузить ранее записанный look обратно для правки.
        </li>
      </ol>
      <p className="light-workflow-guide__note">
        Три буквы: <strong>K</strong> — канал (куда софит «привязан»), <strong>F</strong> — ползунок на
        пульте, <strong>P</strong> — пресет всей доски. <strong>Картина</strong> — какой P и F в этом
        моменте пьесы.
      </p>
    </div>
  );
}
