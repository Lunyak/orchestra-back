import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import type { ScriptScene } from "../../../shared/types/script";

export type SpectacleRunSceneTextProps = {
  scene: ScriptScene | null;
};

export function SpectacleRunSceneText({ scene }: SpectacleRunSceneTextProps) {
  if (!scene) {
    return <p className="spectacle-run-text__empty">Сцена не выбрана</p>;
  }

  const body = String(scene.playMarkdown ?? "").trim();
  if (!body) {
    return (
      <div className="spectacle-run-text__empty">
        <strong>{scene.title || `Сцена ${scene.id}`}</strong>
        <p>Текст сцены пуст</p>
      </div>
    );
  }

  return (
    <div className="spectacle-run-text__body markdown-preview">
      {scene.title ? <h2 className="spectacle-run-text__scene-title">{scene.title}</h2> : null}
      <ReactMarkdown remarkPlugins={[remarkBreaks]}>{body}</ReactMarkdown>
    </div>
  );
}
