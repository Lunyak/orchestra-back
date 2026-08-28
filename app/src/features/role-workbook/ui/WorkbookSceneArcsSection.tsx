import cn from "classnames";
import type { RoleSceneArc } from "../model/roleWorkbookNote";

export type WorkbookSceneArcsSectionProps = {
  hidden: boolean;
  roleDisplayTitle: string;
  desiredSceneArcsCount: number;
  sceneArcsForView: RoleSceneArc[];
  canEdit: boolean;
  onChangeText: (idx: number, text: string) => void;
};

export function WorkbookSceneArcsSection(props: WorkbookSceneArcsSectionProps) {
  const {
    hidden,
    roleDisplayTitle,
    desiredSceneArcsCount,
    sceneArcsForView,
    canEdit,
    onChangeText,
  } = props;

  return (
    <div hidden={hidden}>
      <div className="rolewb-card rolewb-section" id="rolewb-section-sceneArcs">
        <div className="rolewb-section-head">
          <span className="rolewb-section-num">11</span>
          <div className="rolewb-card-title">Арка по сценам (что меняется)</div>
        </div>
        <div className="rolewb-hint">
          Для каждой сцены опиши, что происходит с персонажем: чего хочет, что делает, что получает, в
          чём поворот.
        </div>
        <div className="rolewb-hint rolewb-hint--tight">
          Список сцен формируется автоматически из сценария: берём только те сцены, где роль{" "}
          <b>{roleDisplayTitle}</b> встречается в “Тексте” (формат <code>РОЛЬ: ...</code> или{" "}
          <code>[[РОЛЬ]] ...</code>). Найдено сцен: <b>{desiredSceneArcsCount}</b>
        </div>
        <div className="rolewb-scene-arcs-grid">
          {sceneArcsForView.length === 0 ? (
            <div className="rolewb-hint">Пока нет сцен с этой ролью в тексте сценария.</div>
          ) : null}
          {sceneArcsForView.map((a, idx) => (
            <div key={`arc-${idx}`} className="rolewb-scene-block">
              <div className="rolewb-row rolewb-row--between">
                <div className="rolewb-meta rolewb-meta--soft">
                  {a.sceneTitle ? (
                    <>
                      <b>{a.sceneTitle}</b>{" "}
                      {a.sceneId ? <span className="rolewb-scene-id">· #{a.sceneId}</span> : null}
                    </>
                  ) : (
                    <b>Сцена #{idx + 1}</b>
                  )}
                </div>
              </div>
              <textarea
                className={cn("settings-invite-input", "rolewb-textarea")}
                rows={3}
                value={String(a.text ?? "")}
                disabled={!canEdit}
                onChange={(e) => onChangeText(idx, e.target.value)}
                placeholder="Что происходит с персонажем в этой сцене? В чём поворот?"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
