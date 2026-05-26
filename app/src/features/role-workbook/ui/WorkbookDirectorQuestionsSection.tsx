import { Button } from "@shared/core/button/Button";
import type { RoleDirectorQuestion } from "../model/roleWorkbookNote";

export type WorkbookSceneOption = {
  stepId?: number;
  stepTitle?: string;
};

export type WorkbookDirectorQuestionsSectionProps = {
  sectionNum: number;
  questions: RoleDirectorQuestion[];
  sceneOptions: WorkbookSceneOption[];
  canEdit: boolean;
  isDirectorView: boolean;
  onChangeQuestions: (next: RoleDirectorQuestion[]) => void;
};

export function WorkbookDirectorQuestionsSection({
  sectionNum,
  questions,
  sceneOptions,
  canEdit,
  isDirectorView,
  onChangeQuestions,
}: WorkbookDirectorQuestionsSectionProps) {
  const addQuestion = () => {
    const firstScene = sceneOptions[0];
    onChangeQuestions([
      ...questions,
      {
        text: "",
        stepId: firstScene?.stepId,
        stepTitle: firstScene?.stepTitle,
      },
    ]);
  };

  const updateQuestion = (idx: number, patch: Partial<RoleDirectorQuestion>) => {
    const next = questions.slice();
    const cur = next[idx];
    if (!cur) return;
    next[idx] = { ...cur, ...patch };
    onChangeQuestions(next);
  };

  const removeQuestion = (idx: number) => {
    onChangeQuestions(questions.filter((_, i) => i !== idx));
  };

  return (
    <div className="rolewb-card rolewb-section rolewb-director-q" id="rolewb-section-directorQuestions">
      <div className="rolewb-section-head">
        <span className="rolewb-section-num">{sectionNum}</span>
        <div className="rolewb-card-title">Что мне неясно</div>
      </div>
      <div className="rolewb-hint">
        {isDirectorView ? (
          <>Здесь актёр фиксирует, что ему неясно по роли или сценам — чтобы обсудить на репетиции.</>
        ) : (
          <>Запиши, что непонятно по роли, тексту или сцене. После сохранения режиссёр увидит список в твоей тетрадке.</>
        )}
      </div>

      {questions.length === 0 ? (
        <div className="rolewb-hint">Пока нет вопросов.</div>
      ) : (
        <div className="rolewb-director-q-list">
          {questions.map((q, idx) => (
            <div key={`dir-q-${idx}`} className="rolewb-director-q-row">
              {sceneOptions.length > 0 ? (
                <select
                  className="settings-invite-input"
                  value={q.stepId != null ? String(q.stepId) : ""}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) {
                      updateQuestion(idx, { stepId: undefined, stepTitle: undefined });
                      return;
                    }
                    const id = Number(v);
                    const scene = sceneOptions.find((s) => s.stepId === id);
                    updateQuestion(idx, {
                      stepId: id,
                      stepTitle: scene?.stepTitle,
                    });
                  }}
                  style={{ maxWidth: "unset", width: "100%" }}
                >
                  <option value="">Вся роль / без привязки к сцене</option>
                  {sceneOptions.map((s) => (
                    <option key={`q-scene-${s.stepId}`} value={String(s.stepId ?? "")}>
                      {s.stepTitle ?? `Сцена #${s.stepId}`}
                    </option>
                  ))}
                </select>
              ) : null}
              <textarea
                className="settings-invite-input"
                rows={2}
                value={q.text}
                disabled={!canEdit}
                onChange={(e) => updateQuestion(idx, { text: e.target.value })}
                style={{ maxWidth: "unset", width: "100%" }}
                placeholder="Что неясно? Например: зачем герой молчит в этой сцене?"
              />
              {canEdit ? (
                <Button className="danger" type="button" onClick={() => removeQuestion(idx)}>
                  Удалить
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {canEdit ? (
        <Button className="secondary" type="button" onClick={addQuestion}>
          + Добавить вопрос
        </Button>
      ) : null}
    </div>
  );
}
