import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { ScriptStep } from "../../../shared/types/script";

export type SpectacleRunStepTextProps = {
  step: ScriptStep | null;
};

export function SpectacleRunStepText({ step }: SpectacleRunStepTextProps) {
  if (!step) {
    return <p className="spectacle-run-text__empty">Шаг не выбран</p>;
  }

  const body = String(step.playMarkdown ?? step.markdown ?? "").trim();
  if (!body) {
    return (
      <div className="spectacle-run-text__empty">
        <strong>{step.title || `Шаг ${step.id}`}</strong>
        <p>Текст шага пуст</p>
      </div>
    );
  }

  return (
    <div className="spectacle-run-text__body markdown-preview">
      {step.title ? <h2 className="spectacle-run-text__step-title">{step.title}</h2> : null}
      <ReactMarkdown remarkPlugins={[remarkBreaks]}>{body}</ReactMarkdown>
    </div>
  );
}
