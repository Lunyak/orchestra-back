import { Button } from "@shared/core/button/Button";
import { CustomSelect } from "@shared/core/custom-select/CustomSelect";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { PageBootLoader } from "@shared/components/page-loader/page-boot";
import cn from "classnames";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useParams } from "react-router-dom";
import { TheaterSectionNav } from "../../features/organizations/ui/TheaterSectionNav";
import {
  getTroupeNarrowLayoutSnapshot,
  memberLabel,
  readTroupePeopleView,
  subscribeTroupeNarrowLayout,
  useTroupePage,
  writeTroupePeopleView,
  type TroupePeopleView,
} from "../../features/troupe";
import type { TroupeMemberItem, TroupeMemberKind } from "../../features/troupe/api/troupe-api";
import { sortMineFirst } from "../../features/profile/model/availability-calendar";
import { useScheduleAvailability } from "../../features/profile/model/useScheduleAvailability";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import {
  profileListAvatarSrc,
  profilePosterAvatarSrc,
} from "../../sync/api/profile";
import { AdminSectionChrome } from "../../shared/components/admin/AdminSectionChrome";
import "../../features/organizations/ui/organizations.css";
import "./style.css";

const TROUPE_MEMBER_KIND_OPTIONS = [
  { value: "regular", label: "Основной" },
  { value: "guest", label: "Приглашённый" },
];

const PEOPLE_VIEW_OPTIONS: { id: TroupePeopleView; label: string }[] = [
  { id: "list", label: "Список" },
  { id: "tiles", label: "Плитка" },
];

function memberInitial(label: string): string {
  const ch = label.trim()[0];
  return ch ? ch.toUpperCase() : "?";
}

function TroupePeoplePoster({
  src,
  label,
  meta,
  isSelected,
  mine,
  onClick,
}: {
  src: string | null;
  label: string;
  meta: string;
  isSelected: boolean;
  mine: boolean;
  onClick: () => void;
}) {
  const url = String(src ?? "").trim();
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [url]);

  const showImage = Boolean(url) && !broken;
  const initial = memberInitial(label);
  const metaText = mine ? "Вы" : meta;

  return (
    <button
      type="button"
      className={cn(
        "troupe-people-tile",
        isSelected && "troupe-people-tile--selected",
        mine && "troupe-people-tile--mine",
      )}
      aria-pressed={isSelected}
      title={`${label} • ${meta}`}
      onClick={onClick}
    >
      <span
        className={cn(
          "troupe-people-tile__frame",
          !showImage && "troupe-people-tile__frame--placeholder",
        )}
      >
        {showImage ? (
          <img
            className="troupe-people-tile__image"
            src={url}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="troupe-people-tile__initial">{initial}</span>
        )}
      </span>
      <span className="troupe-people-tile__name">{label}</span>
      <span className="troupe-people-tile__meta">{metaText}</span>
    </button>
  );
}

export function TroupePage() {
  const { theaterId = "" } = useParams();
  const narrowLayout = useSyncExternalStore(
    subscribeTroupeNarrowLayout,
    getTroupeNarrowLayoutSnapshot,
    () => false,
  );

  const {
    accessToken,
    adding,
    addError,
    addMemberByEmail,
    canManageTroupe,
    canManageProjectTroupe,
    email,
    error,
    guestTroupeMembers,
    inviteErrorByMemberId,
    inviteSelectedToProject,
    invitingIds,
    loading,
    onProjectChange,
    patchTitleError,
    patchingTitle,
    projectName,
    projects,
    projectsLoading,
    projectMembersLoading,
    regularTroupeMembers,
    removeSelectedFromTroupe,
    removingIds,
    saveTitle,
    selectedMember,
    selectedMemberId,
    selectedMemberInProject,
    setEmail,
    setSelectedMemberId,
    setTitleDraft,
    titleDraft,
    troupe,
    updateSelectedTroupeMemberKind,
    projectItems,
  } = useTroupePage();
  const availability = useScheduleAvailability(accessToken);
  const [peopleView, setPeopleView] = useState<TroupePeopleView>(
    readTroupePeopleView,
  );

  const handlePeopleViewChange = (view: TroupePeopleView) => {
    setPeopleView(view);
    writeTroupePeopleView(view);
  };

  const regularSorted = useMemo(
    () => sortMineFirst(regularTroupeMembers, availability.myEmail),
    [availability.myEmail, regularTroupeMembers],
  );
  const guestSorted = useMemo(
    () => sortMineFirst(guestTroupeMembers, availability.myEmail),
    [availability.myEmail, guestTroupeMembers],
  );
  const projectSelectOptions = useMemo(
    () =>
      projectItems.map((project) => ({
        value: project.slug,
        label: project.name || project.slug,
      })),
    [projectItems],
  );

  const renderPeopleViewSwitch = () => (
    <div
      className="troupe-people-view"
      role="group"
      aria-label="Вид списка участников"
    >
      {PEOPLE_VIEW_OPTIONS.map((option) => {
        const isActive = peopleView === option.id;
        return (
          <button
            key={option.id}
            type="button"
            className={cn(
              "troupe-people-view__btn",
              isActive && "troupe-people-view__btn--active",
            )}
            aria-pressed={isActive}
            onClick={() => handlePeopleViewChange(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );

  const renderPeopleList = (
    people: TroupeMemberItem[],
    emptyText: string,
    ariaLabel: string,
  ) => {
    const isTiles = peopleView === "tiles";
    const peopleListClassName = isTiles
      ? "troupe-people-tiles"
      : "troupe-people-list";
    return (
      <ul className={peopleListClassName} aria-label={ariaLabel}>
        {people.length === 0 ? (
          <li className="troupe-people-empty">{emptyText}</li>
        ) : (
          people.map((member) => {
            const label = memberLabel(member);
            const isSelected = member.id === selectedMemberId;
            const mine = availability.isMine(member.email);
            const toggleSelected = () =>
              setSelectedMemberId((prev) =>
                prev === member.id ? null : member.id,
              );

            if (isTiles) {
              return (
                <li key={member.id}>
                  <TroupePeoplePoster
                    src={profilePosterAvatarSrc(member.profile)}
                    label={label || member.email}
                    meta={member.email}
                    isSelected={isSelected}
                    mine={mine}
                    onClick={toggleSelected}
                  />
                </li>
              );
            }

            return (
              <li key={member.id}>
                <button
                  type="button"
                  className={cn(
                    "troupe-people-item",
                    isSelected && "selected",
                    mine && "troupe-people-item--mine",
                  )}
                  aria-pressed={isSelected}
                  title={`${label} • ${member.email}`}
                  onClick={toggleSelected}
                >
                  <MiniAvatar
                    src={profileListAvatarSrc(member.profile)}
                    label={label || member.email}
                    size={28}
                  />
                  <span className="troupe-people-item__meta">
                    <span className="troupe-people-item__name">{label}</span>
                    <span className="troupe-people-item__email">
                      {mine ? "Вы" : member.email}
                    </span>
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    );
  };

  if (!accessToken) {
    return <div>Нужно войти, чтобы открыть страницу коллектива.</div>;
  }
  if (loading) return <PageBootLoader label="Загрузка коллектива…" />;

  return (
    <div className="app-layout troupe-layout">
      <div className="app-content">
        {theaterId ? (
          <TheaterSectionNav theaterId={theaterId} active="troupe" />
        ) : null}
        <main className="main-content">
          <div className="troupe-view">
            <AdminSectionChrome activeSection="team">
              <div className="troupe-card troupe-card--page-head">
                {canManageTroupe ? (
                  <>
                    {!troupe ? (
                      <p className="troupe-hint">
                      Труппа театра пока пуста — добавьте первого участника по
                      email.
                      </p>
                    ) : null}
                    <FormInlineRow className="troupe-form-row">
                      <InlineTextField
                        className="troupe-title-field"
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        placeholder="Название труппы"
                        maxLength={120}
                        disabled={!troupe}
                        aria-label="Название труппы"
                      />
                      <Button
                        type="button"
                        variant="primary"
                        disabled={
                          patchingTitle ||
                          !troupe ||
                          !titleDraft.trim() ||
                          titleDraft.trim() === (troupe?.title ?? "").trim()
                        }
                        onClick={() => void saveTitle()}
                      >
                        {patchingTitle ? "Сохранение…" : "Сохранить"}
                      </Button>
                    </FormInlineRow>
                    {patchTitleError ? (
                      <div className="troupe-error">{patchTitleError}</div>
                    ) : null}
                  </>
                ) : null}

                <div className="troupe-actions">
                  <div className="troupe-actions-left">
                    <span className="troupe-actions-label">Выбран:</span>{" "}
                    {selectedMember ? (
                      <span
                        className="troupe-actions-selected"
                        title={selectedMember.email}
                      >
                        {memberLabel(selectedMember)}
                      </span>
                    ) : (
                      <span className="troupe-actions-selected muted">—</span>
                    )}
                  </div>
                  <div className="troupe-actions-right">
                    {canManageProjectTroupe ? (
                      <>
                        <label className="troupe-project-field">
                          <span className="troupe-project-field__label">
                            Проект
                          </span>
                          <CustomSelect
                            value={projects.length > 0 ? projectName : ""}
                            options={projectSelectOptions}
                            onChange={onProjectChange}
                            placeholder="Выберите проект"
                            noOptionsLabel="Проектов нет"
                            disabled={projects.length === 0 || projectsLoading}
                            triggerClassName="troupe-project-select"
                            aria-label="Проект для добавления участника"
                          />
                        </label>
                        <label className="troupe-project-field troupe-member-kind-field">
                          <span className="troupe-project-field__label">
                            Тип
                          </span>
                          <CustomSelect
                            value={selectedMember?.kind ?? "regular"}
                            options={TROUPE_MEMBER_KIND_OPTIONS}
                            onChange={(kind) => {
                              void updateSelectedTroupeMemberKind(
                                kind as TroupeMemberKind,
                              );
                            }}
                            disabled={!selectedMember?.troupeMemberId}
                            triggerClassName="troupe-member-kind-select"
                            aria-label="Тип участника в составе коллектива"
                          />
                        </label>
                        <Button
                          className="primary"
                          type="button"
                          disabled={
                            !projectName ||
                            !selectedMember ||
                            projectMembersLoading ||
                            selectedMemberInProject ||
                            !!invitingIds[selectedMember.id]
                          }
                          onClick={() => {
                            void inviteSelectedToProject();
                          }}
                        >
                          {selectedMember && invitingIds[selectedMember.id]
                            ? "…"
                            : projectMembersLoading
                              ? "Проверка…"
                              : selectedMemberInProject
                                ? "Уже в проекте"
                                : narrowLayout
                                  ? "В проект"
                                  : "Добавить в проект"}
                        </Button>
                        <Button
                          type="button"
                          className="danger"
                          disabled={
                            !selectedMember?.troupeMemberId ||
                            !!removingIds[String(selectedMember.troupeMemberId)]
                          }
                          onClick={() => {
                            if (!confirm("Удалить участника из труппы?"))
                              return;
                            void removeSelectedFromTroupe();
                          }}
                        >
                          {selectedMember?.troupeMemberId &&
                          removingIds[String(selectedMember.troupeMemberId)]
                            ? "…"
                            : narrowLayout
                              ? "Удалить"
                              : "Удалить из труппы"}
                        </Button>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      className="primary"
                      disabled={!selectedMemberId}
                      onClick={() => setSelectedMemberId(null)}
                    >
                      {narrowLayout ? "Сбросить" : "Снять выделение"}
                    </Button>
                  </div>
                </div>
                {selectedMember && inviteErrorByMemberId[selectedMember.id] ? (
                  <div className="troupe-error">
                    {inviteErrorByMemberId[selectedMember.id]}
                  </div>
                ) : null}

                {canManageTroupe ? (
                  <div className="troupe-invite-card">
                    <div className="troupe-invite-card__title">
                      <span className="troupe-invite-card__title-desktop">
                        Добавить в труппу по email
                      </span>
                      <span className="troupe-invite-card__title-mobile">
                        Пригласить по email
                      </span>
                    </div>
                    <FormInlineRow className="troupe-form-row troupe-form-row--invite-email">
                      <InlineTextField
                        className="troupe-invite-email-field"
                        placeholder="actor@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                      <button
                        type="button"
                        className="troupe-form-row__btn troupe-invite-card__submit"
                        disabled={adding || !email.trim()}
                        onClick={() => {
                          void addMemberByEmail();
                        }}
                      >
                        {adding ? "Отправка…" : "Пригласить"}
                      </button>
                    </FormInlineRow>
                    {addError ? (
                      <div className="troupe-error">{addError}</div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="troupe-card">
                <div className="troupe-scale-head">
                  <div className="troupe-scale-head__titleblock">
                    <div className="troupe-scale-head__title">
                      Основной состав
                    </div>
                  </div>
                  {renderPeopleViewSwitch()}
                </div>
                {renderPeopleList(
                  regularSorted,
                  "В основном составе пока никого нет — добавьте участника по email.",
                  "Основной состав коллектива",
                )}
              </div>

              <div className="troupe-card troupe-schedule-card--guest">
                <div className="troupe-scale-head">
                  <div className="troupe-scale-head__titleblock">
                    <div className="troupe-scale-head__title">
                      Приглашённые
                    </div>
                  </div>
                  {renderPeopleViewSwitch()}
                </div>
                {renderPeopleList(
                  guestSorted,
                  "Приглашённых пока нет — выберите участника и смените тип.",
                  "Приглашённые участники",
                )}
              </div>

              {error ? <div className="troupe-error">{error}</div> : null}
            </AdminSectionChrome>
          </div>
        </main>
      </div>
    </div>
  );
}
