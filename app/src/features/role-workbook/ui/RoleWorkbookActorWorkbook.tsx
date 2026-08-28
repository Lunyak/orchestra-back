import type { ProjectRoleInfo } from "../../../sync/api/projects";
import type { TeamProfile } from "../../../sync/api/profile";
import type { WorkbookSectionId } from "../model/role-workbook-sections";
import { WORKBOOK_SECTIONS } from "../model/role-workbook-sections";
import type {
  RoleDirectorQuestion,
  RoleRelationshipEntry,
  RoleSceneArc,
  RoleWorkbookDataV1,
  InboundRoleMention,
} from "../model/roleWorkbookNote";
import { WorkbookDirectorQuestionsSection } from "./WorkbookDirectorQuestionsSection";
import { WorkbookInboundMentionsSection } from "./WorkbookInboundMentionsSection";
import { WorkbookRehearsalChecklistSection } from "./WorkbookRehearsalChecklistSection";
import { WorkbookRelationshipsSection } from "./WorkbookRelationshipsSection";
import { WorkbookReferenceImagesSection, type WorkbookReferenceImagesSectionProps } from "./WorkbookReferenceImagesSection";
import { WorkbookSceneArcsSection } from "./WorkbookSceneArcsSection";
import { WorkbookTextSection, type WorkbookTextFieldKey } from "./WorkbookTextSection";
import { WorkbookTransformationSection } from "./WorkbookTransformationSection";

export type RoleWorkbookActorWorkbookProps = {
  accessToken: string;
  effectiveRoleId: string;
  roleLabel: string;
  roleDisplayTitle: string;
  activeWorkbookSection: WorkbookSectionId | null;
  setActiveWorkbookSection: (id: WorkbookSectionId) => void;
  canEdit: boolean;
  draft: RoleWorkbookDataV1;
  projectRoles: ProjectRoleInfo[];
  inboundMentions: InboundRoleMention[];
  profilesByEmail: Record<string, TeamProfile | null | undefined>;
  sceneArcsForView: RoleSceneArc[];
  sceneOptionsForQuestions: Array<{ sceneId?: number; sceneTitle?: string }>;
  desiredSceneArcsCount: number;
  isDirectorView: boolean;
  saving: boolean;
  snapshotUpdatedAt: string | null;
  lastSavedAtIso: string | null;
  error: string | null;
  onDraftFieldChange: (key: WorkbookTextFieldKey, value: string) => void;
  onChangeRelationshipEntries: (next: RoleRelationshipEntry[]) => void;
  onChangeDirectorQuestions: (next: RoleDirectorQuestion[]) => void;
  onChangeSceneArcText: (idx: number, text: string) => void;
  referenceImagesProps: Omit<WorkbookReferenceImagesSectionProps, "hidden">;
};

export function RoleWorkbookActorWorkbook(props: RoleWorkbookActorWorkbookProps) {
  const {
    accessToken,
    effectiveRoleId,
    roleLabel,
    roleDisplayTitle,
    activeWorkbookSection,
    setActiveWorkbookSection,
    canEdit,
    draft,
    projectRoles,
    inboundMentions,
    profilesByEmail,
    sceneArcsForView,
    sceneOptionsForQuestions,
    desiredSceneArcsCount,
    isDirectorView,
    saving,
    snapshotUpdatedAt,
    lastSavedAtIso,
    error,
    onDraftFieldChange,
    onChangeRelationshipEntries,
    onChangeDirectorQuestions,
    onChangeSceneArcText,
    referenceImagesProps,
  } = props;

  const showSectionsNav = !activeWorkbookSection;
  const snapshotLabel = snapshotUpdatedAt
    ? new Date(snapshotUpdatedAt).toLocaleString("ru-RU")
    : null;
  const savedLabel = lastSavedAtIso
    ? new Date(lastSavedAtIso).toLocaleString("ru-RU")
    : null;

  return (
    <>
      {showSectionsNav ? (
        <div className="rolewb-card rolewb-intro">
          <div className="rolewb-row rolewb-row--between">
            <div className="rolewb-card-title">Актёрская тетрадь · рисунок роли</div>
          </div>
          <div className="rolewb-hint">
            Выберите раздел тетрадки. Всё открывается здесь же, без перехода на отдельные страницы.
          </div>
          <div className="rolewb-section-grid" aria-label="Разделы рисунка роли">
            {WORKBOOK_SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="rolewb-section-tile"
                onClick={() => setActiveWorkbookSection(item.id)}
              >
                <span className="rolewb-section-tile__title">{item.title}</span>
                <span className="rolewb-section-tile__hint">{item.hint}</span>
              </button>
            ))}
          </div>
          <div className="rolewb-row rolewb-view-actions">
            <div className="rolewb-hint">
              {saving ? (
                <>Автосохранение…</>
              ) : snapshotLabel ? (
                <>
                  Последняя версия: <b>{snapshotLabel}</b>
                </>
              ) : (
                <>Пока нет сохранённой версии для выбранного актёра.</>
              )}
            </div>
            {savedLabel ? (
              <div className="rolewb-saved-status">Сохранено: {savedLabel}</div>
            ) : null}
          </div>
          {error ? <div className="settings-invite-error">{error}</div> : null}
        </div>
      ) : null}

      <div hidden={activeWorkbookSection !== "givenCircumstances"}>
        <WorkbookTextSection
          sectionNum={1}
          title="Данные обстоятельства"
          hint="Время, место, эпоха, социальная среда пьесы. Что задано автором и что важно для героя в этих условиях."
          fieldKey="givenCircumstances"
          rows={4}
          placeholder="Где и когда происходит действие? Какая атмосфера, правила мира, что влияет на поведение персонажа?"
          value={String(draft?.givenCircumstances ?? "")}
          canEdit={canEdit}
          onFieldChange={onDraftFieldChange}
        />
      </div>

      <div hidden={activeWorkbookSection !== "biography"}>
        <WorkbookTextSection
          sectionNum={2}
          title="Биография и внерамочная жизнь"
          hint="Прошлое героя до начала пьесы и то, что происходит «за кадром»: травмы, опыт, привычки, что сформировало характер."
          fieldKey="biography"
          rows={6}
          placeholder="Детство, ключевые события, семья, образование, тайны, что персонаж помнит и чего избегает…"
          value={String(draft?.biography ?? "")}
          canEdit={canEdit}
          onFieldChange={onDraftFieldChange}
        />
      </div>

      <div hidden={activeWorkbookSection !== "socialPortrait"}>
        <WorkbookTextSection
          sectionNum={3}
          title="Социальный портрет"
          hint="Возраст, профессия, класс, статус, манера речи, привычки, что выдаёт социальное положение."
          fieldKey="socialPortrait"
          rows={4}
          placeholder="Кто он в обществе? Как говорит, одет, двигается? Что отличает его от других?"
          value={String(draft?.socialPortrait ?? "")}
          canEdit={canEdit}
          onFieldChange={onDraftFieldChange}
        />
      </div>

      <div hidden={activeWorkbookSection !== "relationships"}>
        <WorkbookRelationshipsSection
          sectionNum={4}
          currentRoleId={effectiveRoleId}
          projectRoles={projectRoles}
          entries={draft?.relationshipEntries ?? []}
          legacyNotes={String(draft?.relationships ?? "")}
          accessToken={accessToken}
          canEdit={canEdit}
          onChangeEntries={onChangeRelationshipEntries}
          onChangeLegacyNotes={(value) => onDraftFieldChange("relationships", value)}
        />
      </div>

      <div hidden={activeWorkbookSection !== "inbound"}>
        <WorkbookInboundMentionsSection
          mentions={inboundMentions}
          profilesByEmail={profilesByEmail}
          accessToken={accessToken}
          targetRoleTitle={roleLabel}
        />
      </div>

      <div hidden={activeWorkbookSection !== "superObjective"}>
        <WorkbookTextSection
          sectionNum={5}
          title="Сверхзадача и сквозное действие"
          hint={
            <>
              Главная цель героя на всю пьесу. Формулируй через действие: добиться, удержать, защитить,
              сломать — не через абстрактное чувство.
            </>
          }
          fieldKey="superObjective"
          rows={3}
          placeholder="Чего персонаж хочет больше всего на протяжении всей истории?"
          value={String(draft?.superObjective ?? "")}
          canEdit={canEdit}
          onFieldChange={onDraftFieldChange}
        />
      </div>

      <div hidden={activeWorkbookSection !== "obstacles"}>
        <WorkbookTextSection
          sectionNum={6}
          title="Препятствия"
          hint="Что мешает достичь сверхзадачи: внешние силы, другие персонажи, внутренние барьеры, обстоятельства."
          fieldKey="obstacles"
          rows={4}
          placeholder="Кто или что стоит на пути? В чём главное противодействие?"
          value={String(draft?.obstacles ?? "")}
          canEdit={canEdit}
          onFieldChange={onDraftFieldChange}
        />
      </div>

      <div hidden={activeWorkbookSection !== "eventSeries"}>
        <WorkbookTextSection
          sectionNum={7}
          title="Событийный ряд"
          hint="Ключевые события жизни героя в пьесе по порядку — линия развития от начала к финалу (до разбора по сценам)."
          fieldKey="eventSeries"
          rows={5}
          placeholder="1) … 2) … 3) … — как меняется положение и самоощущение героя?"
          value={String(draft?.eventSeries ?? "")}
          canEdit={canEdit}
          onFieldChange={onDraftFieldChange}
        />
      </div>

      <div hidden={activeWorkbookSection !== "transformation"}>
        <WorkbookTransformationSection
          sectionNum={8}
          start={String(draft?.transformationStart ?? "")}
          end={String(draft?.transformationEnd ?? "")}
          turningPoint={String(draft?.transformationTurningPoint ?? "")}
          canEdit={canEdit}
          onChangeStart={(v) => onDraftFieldChange("transformationStart", v)}
          onChangeEnd={(v) => onDraftFieldChange("transformationEnd", v)}
          onChangeTurningPoint={(v) => onDraftFieldChange("transformationTurningPoint", v)}
        />
      </div>

      <div hidden={activeWorkbookSection !== "appearance"}>
        <WorkbookTextSection
          sectionNum={9}
          title="Внешность и пластика"
          hint="Внутренний и внешний облик: осанка, жесты, походка, темп, голос, что заметно при первом взгляде."
          fieldKey="appearance"
          rows={4}
          placeholder="Осанка, жесты, походка, темп/ритм, голос, что заметно при первом взгляде…"
          value={String(draft?.appearance ?? "")}
          canEdit={canEdit}
          onFieldChange={onDraftFieldChange}
        />
      </div>

      <WorkbookReferenceImagesSection
        {...referenceImagesProps}
        hidden={activeWorkbookSection !== "referenceImages"}
      />

      <WorkbookSceneArcsSection
        hidden={activeWorkbookSection !== "sceneArcs"}
        roleDisplayTitle={roleDisplayTitle}
        desiredSceneArcsCount={desiredSceneArcsCount}
        sceneArcsForView={sceneArcsForView}
        canEdit={canEdit}
        onChangeText={onChangeSceneArcText}
      />

      <div hidden={activeWorkbookSection !== "directorQuestions"}>
        <WorkbookDirectorQuestionsSection
          sectionNum={12}
          questions={draft?.directorQuestions ?? []}
          sceneOptions={sceneOptionsForQuestions}
          canEdit={canEdit}
          isDirectorView={isDirectorView}
          onChangeQuestions={onChangeDirectorQuestions}
        />
      </div>

      <div hidden={activeWorkbookSection !== "rehearsalChecklist"}>
        <WorkbookRehearsalChecklistSection
          sectionNum={13}
          done={String(draft?.rehearsalDone ?? "")}
          todo={String(draft?.rehearsalTodo ?? "")}
          rehearsalFocus={String(draft?.rehearsalNextStep ?? "")}
          canEdit={canEdit}
          onChangeDone={(v) => onDraftFieldChange("rehearsalDone", v)}
          onChangeTodo={(v) => onDraftFieldChange("rehearsalTodo", v)}
          onChangeRehearsalFocus={(v) => onDraftFieldChange("rehearsalNextStep", v)}
        />
      </div>

      <div hidden={activeWorkbookSection !== "preparation"}>
        <WorkbookTextSection
          sectionNum={14}
          title="Подготовка к роли"
          hint="План работы: дневник персонажа, наблюдения, физические привычки, голос, репетиционные задания."
          fieldKey="preparation"
          rows={5}
          placeholder="Что изучить, что попробовать, какие упражнения и задания себе дать до выхода на сцену?"
          value={String(draft?.preparation ?? "")}
          canEdit={canEdit}
          onFieldChange={onDraftFieldChange}
        />
      </div>
    </>
  );
}
