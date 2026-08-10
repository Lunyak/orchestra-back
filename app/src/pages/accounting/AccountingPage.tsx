import { Button } from "@shared/core/button/Button";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  accountingPath,
  globalPaths,
} from "../../app/router/paths";
import {
  collectionOwnerLabel,
  collectionProgressPercent,
  collectionStatusLabel,
  formatRub,
  parseRubInput,
  useCreateCollectionMutation,
  useListCollectionsQuery,
  type AccountingScopes,
  type CollectionSummary,
} from "../../features/accounting";
import { accountingListErrorMessage } from "../../features/accounting/model/accounting-list-error";
import { useAuth } from "../../features/auth";
import { RehearsalsCard } from "../../features/rehearsals-card/RehearsalsCard";
import { useGetStudioQuery } from "../../features/studio";
import { memberLabel } from "../../features/troupe";
import { useMyTroupeQuery } from "../../features/troupe/api/troupe-api";
import "../../features/rehearsals/ui/rehearsals.css";
import "./style.css";

dayjs.locale("ru");

type AccountingTab = "theaters" | "studios" | "projects";

type TariffDraft = {
  key: string;
  title: string;
  amountRub: string;
};

type ParticipantDraft = {
  email: string;
  selected: boolean;
  tariffIndex: number;
};

type MemberOption = {
  email: string;
  displayName: string;
};

function newTariffDraft(): TariffDraft {
  return {
    key: `tariff-${Date.now()}-${Math.random()}`,
    title: "",
    amountRub: "",
  };
}

function emptyScopes(): AccountingScopes {
  return { theaters: [], studios: [], projects: [] };
}

function resolveDefaultTab(scopes: AccountingScopes): AccountingTab | null {
  if (scopes.theaters.length > 0) return "theaters";
  if (scopes.studios.length > 0) return "studios";
  if (scopes.projects.length > 0) return "projects";
  return null;
}

function filterCollections(
  collections: CollectionSummary[],
  tab: AccountingTab,
  scopes: AccountingScopes,
  entityId: string,
): CollectionSummary[] {
  if (tab === "studios") {
    return collections.filter((collection) => {
      const matchesStudio =
        collection.scope === "studio" && collection.studioId === entityId;
      return entityId ? matchesStudio : collection.scope === "studio";
    });
  }

  if (tab === "theaters") {
    return collections.filter((collection) => {
      if (collection.scope !== "troupe") return false;
      if (!entityId) return true;
      return collection.theaterId === entityId;
    });
  }

  const project = scopes.projects.find((item) => item.id === entityId);
  const projectTroupeIds = new Set(project?.troupeIds ?? []);
  return collections.filter((collection) => {
    if (collection.scope !== "troupe") return false;
    if (!entityId) {
      return scopes.projects.some((item) =>
        item.troupeIds.includes(collection.troupeId),
      );
    }
    return projectTroupeIds.has(collection.troupeId);
  });
}

export function AccountingPage() {
  const { accessToken } = useAuth();
  const location = useLocation();
  const {
    data: collectionsData,
    isLoading,
    isError,
    error,
  } = useListCollectionsQuery(undefined, { skip: !accessToken });
  const { data: troupeData } = useMyTroupeQuery({}, { skip: !accessToken });
  const [createCollection, { isLoading: creating }] =
    useCreateCollectionMutation();

  const scopes = collectionsData?.scopes ?? emptyScopes();
  const [activeTab, setActiveTab] = useState<AccountingTab | null>(null);
  const [entityId, setEntityId] = useState("");
  const [troupeId, setTroupeId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [tariffs, setTariffs] = useState<TariffDraft[]>([
    { key: "t1", title: "Полный", amountRub: "5000" },
    { key: "t2", title: "Льготный", amountRub: "2300" },
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ParticipantDraft[]>([]);

  const resolvedTab = activeTab ?? resolveDefaultTab(scopes);
  const selectedStudioId =
    resolvedTab === "studios" && entityId ? entityId : "";
  const { data: studioDetail } = useGetStudioQuery(selectedStudioId, {
    skip: !accessToken || !selectedStudioId,
  });

  useEffect(() => {
    if (activeTab != null) return;
    const nextTab = resolveDefaultTab(scopes);
    if (nextTab) setActiveTab(nextTab);
  }, [activeTab, scopes]);

  useEffect(() => {
    if (!resolvedTab) {
      setEntityId("");
      setTroupeId("");
      return;
    }
    if (resolvedTab === "theaters") {
      const theater = scopes.theaters.find((item) => item.id === entityId);
      const firstTheater = scopes.theaters[0];
      const nextTheater = theater ?? firstTheater;
      if (!nextTheater) {
        setEntityId("");
        setTroupeId("");
        return;
      }
      if (entityId !== nextTheater.id) setEntityId(nextTheater.id);
      const hasTroupe = nextTheater.troupes.some((item) => item.id === troupeId);
      if (!hasTroupe) setTroupeId(nextTheater.troupes[0]?.id ?? "");
      return;
    }
    if (resolvedTab === "studios") {
      const studio = scopes.studios.find((item) => item.id === entityId);
      const nextStudio = studio ?? scopes.studios[0];
      setEntityId(nextStudio?.id ?? "");
      setTroupeId("");
      return;
    }
    const project = scopes.projects.find((item) => item.id === entityId);
    const nextProject = project ?? scopes.projects[0];
    if (!nextProject) {
      setEntityId("");
      setTroupeId("");
      return;
    }
    if (entityId !== nextProject.id) setEntityId(nextProject.id);
    const hasTroupe = nextProject.troupeIds.includes(troupeId);
    if (!hasTroupe) setTroupeId(nextProject.troupeIds[0] ?? "");
  }, [resolvedTab, scopes, entityId, troupeId]);

  const membersFromApi = collectionsData?.createMemberOptions ?? [];
  const membersFromTroupe = useMemo<MemberOption[]>(() => {
    const rows = troupeData?.members ?? [];
    return rows.map((member) => ({
      email: member.email,
      displayName: memberLabel(member),
    }));
  }, [troupeData]);
  const membersFromStudio = useMemo<MemberOption[]>(() => {
    const rows = studioDetail?.members ?? [];
    return rows.map((member) => ({
      email: member.email,
      displayName: member.displayName?.trim() || member.email,
    }));
  }, [studioDetail]);

  const memberOptions =
    resolvedTab === "studios"
      ? membersFromStudio.length > 0
        ? membersFromStudio
        : membersFromApi
      : membersFromApi.length > 0
        ? membersFromApi
        : membersFromTroupe;

  const participantDrafts = useMemo(() => {
    if (participants.length === memberOptions.length) return participants;
    return memberOptions.map((member) => {
      const existing = participants.find((row) => row.email === member.email);
      return (
        existing ?? {
          email: member.email,
          selected: false,
          tariffIndex: 0,
        }
      );
    });
  }, [participants, memberOptions]);

  const allCollections = collectionsData?.collections ?? [];
  const collections =
    resolvedTab != null
      ? filterCollections(allCollections, resolvedTab, scopes, entityId)
      : [];

  const canCreateFromApi = collectionsData?.canCreateCollections;
  const canManageAnyCollection = allCollections.some(
    (collection) => collection.canManage,
  );
  const canCreate =
    Boolean(accessToken) &&
    (canCreateFromApi !== false || canManageAnyCollection || isError);
  const createBlocked =
    !isLoading &&
    !isError &&
    canCreateFromApi === false &&
    !canManageAnyCollection;

  const visibleTabs = useMemo(() => {
    const tabs: Array<{ id: AccountingTab; label: string }> = [];
    if (scopes.theaters.length > 0) {
      tabs.push({ id: "theaters", label: "Театры" });
    }
    if (scopes.studios.length > 0) {
      tabs.push({ id: "studios", label: "Студии" });
    }
    if (scopes.projects.length > 0) {
      tabs.push({ id: "projects", label: "Проекты" });
    }
    return tabs;
  }, [scopes]);

  useEffect(() => {
    const state = location.state as { openCreate?: boolean } | null;
    if (state?.openCreate && canCreate) {
      setShowCreate(true);
    }
  }, [location.state, canCreate]);

  const handleTabChange = (tab: AccountingTab) => {
    setActiveTab(tab);
    setEntityId("");
    setTroupeId("");
    setShowCreate(false);
    setFormError(null);
  };

  const handleToggleCreate = () => {
    setShowCreate((value) => !value);
    setFormError(null);
  };

  const handleAddTariff = () => {
    setTariffs((rows) => [...rows, newTariffDraft()]);
  };

  const handleRemoveTariff = (key: string) => {
    setTariffs((rows) => rows.filter((row) => row.key !== key));
  };

  const handleParticipantChange = (
    email: string,
    patch: Partial<Pick<ParticipantDraft, "selected" | "tariffIndex">>,
  ) => {
    setParticipants(() =>
      participantDrafts.map((row) =>
        row.email === email ? { ...row, ...patch } : row,
      ),
    );
  };

  const handleCreate = async () => {
    setFormError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("Укажите название сбора");
      return;
    }

    const parsedTariffs = tariffs.map((row) => {
      const amountRub = parseRubInput(row.amountRub);
      const tariffTitle = row.title.trim();
      if (!tariffTitle || amountRub == null) return null;
      return { title: tariffTitle, amountRub };
    });

    if (parsedTariffs.some((row) => row == null)) {
      setFormError("Заполните все тарифы (название и сумма в ₽)");
      return;
    }

    const validTariffs = parsedTariffs.filter(
      (row): row is { title: string; amountRub: number } => row != null,
    );
    if (validTariffs.length === 0) {
      setFormError("Добавьте хотя бы один тариф");
      return;
    }

    const selectedParticipants = participantDrafts
      .filter((row) => row.selected)
      .map((row) => ({
        email: row.email,
        tariffIndex: row.tariffIndex,
      }));

    if (selectedParticipants.length === 0) {
      setFormError("Выберите хотя бы одного участника");
      return;
    }

    if (resolvedTab === "studios" && !entityId) {
      setFormError("Выберите студию");
      return;
    }
    if (resolvedTab !== "studios" && !troupeId) {
      setFormError("Выберите труппу");
      return;
    }

    try {
      await createCollection({
        title: trimmedTitle,
        tariffs: validTariffs,
        participants: selectedParticipants,
        ...(resolvedTab === "studios"
          ? { studioId: entityId }
          : { troupeId }),
      }).unwrap();
      setTitle("");
      setShowCreate(false);
      setParticipants([]);
    } catch (createError) {
      setFormError(
        createError instanceof Error
          ? createError.message
          : "Не удалось создать сбор",
      );
    }
  };

  const errorMessage = isError ? accountingListErrorMessage(error) : null;
  const selectedTheater = scopes.theaters.find((item) => item.id === entityId);
  const selectedProject = scopes.projects.find((item) => item.id === entityId);
  const projectTroupeOptions = useMemo(() => {
    if (!selectedProject) return [];
    const titleById = new Map<string, string>();
    for (const theater of scopes.theaters) {
      for (const troupe of theater.troupes) {
        titleById.set(troupe.id, troupe.title);
      }
    }
    return selectedProject.troupeIds.map((id) => ({
      id,
      title: titleById.get(id) ?? id,
    }));
  }, [selectedProject, scopes.theaters]);

  return (
    <div className="app-layout accounting-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="accounting-page">
            <div className="accounting-page__header">
              <div>
                <h1 className="accounting-page__title">Бухгалтерия</h1>
                <p className="accounting-page__subtitle">
                  Сборы по театрам, студиям и проектам.
                </p>
                <p className="accounting-page__wip" role="status">
                  Раздел ещё в разработке — не для продакшена.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleToggleCreate}
                disabled={!accessToken || !resolvedTab}
                title={
                  createBlocked
                    ? "Доступно владельцу и бухгалтеру / преподавателю"
                    : undefined
                }
              >
                {showCreate ? "Отмена" : "Новый сбор"}
              </Button>
            </div>

            {visibleTabs.length > 0 ? (
              <div
                className="accounting-tabs"
                role="tablist"
                aria-label="Контекст бухгалтерии"
              >
                {visibleTabs.map((tab) => {
                  const isActive = resolvedTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={cn(
                        "accounting-tabs__item",
                        isActive && "accounting-tabs__item--active",
                      )}
                      onClick={() => handleTabChange(tab.id)}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {resolvedTab === "theaters" && scopes.theaters.length > 0 ? (
              <div className="accounting-scope-row">
                <label className="accounting-scope-row__field">
                  <span>Театр</span>
                  <select
                    value={entityId}
                    onChange={(event) => setEntityId(event.target.value)}
                  >
                    {scopes.theaters.map((theater) => (
                      <option key={theater.id} value={theater.id}>
                        {theater.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="accounting-scope-row__field">
                  <span>Труппа</span>
                  <select
                    value={troupeId}
                    onChange={(event) => setTroupeId(event.target.value)}
                  >
                    {(selectedTheater?.troupes ?? []).map((troupe) => (
                      <option key={troupe.id} value={troupe.id}>
                        {troupe.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {resolvedTab === "studios" && scopes.studios.length > 0 ? (
              <div className="accounting-scope-row">
                <label className="accounting-scope-row__field">
                  <span>Студия</span>
                  <select
                    value={entityId}
                    onChange={(event) => setEntityId(event.target.value)}
                  >
                    {scopes.studios.map((studio) => (
                      <option key={studio.id} value={studio.id}>
                        {studio.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {resolvedTab === "projects" && scopes.projects.length > 0 ? (
              <div className="accounting-scope-row">
                <label className="accounting-scope-row__field">
                  <span>Проект</span>
                  <select
                    value={entityId}
                    onChange={(event) => setEntityId(event.target.value)}
                  >
                    {scopes.projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="accounting-scope-row__field">
                  <span>Труппа</span>
                  <select
                    value={troupeId}
                    onChange={(event) => setTroupeId(event.target.value)}
                  >
                    {projectTroupeOptions.map((troupe) => (
                      <option key={troupe.id} value={troupe.id}>
                        {troupe.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {createBlocked ? (
              <p className="accounting-page__hint">
                Создавать сборы могут владелец и бухгалтер (театр/проект) или
                владелец/преподаватель студии. Настройте роли в{" "}
                <Link to={globalPaths.organizations}>Организациях</Link>.
              </p>
            ) : null}

            {errorMessage ? (
              <p className="accounting-page__error">{errorMessage}</p>
            ) : null}

            {!resolvedTab && !isLoading ? (
              <p className="accounting-page__hint">
                Нет доступных театров, студий или проектов со связанными
                труппами. Создайте организацию, чтобы вести сборы.
              </p>
            ) : null}

            <RehearsalsCard fluid>
              {isLoading ? (
                <p>Загрузка…</p>
              ) : collections.length === 0 ? (
                <div className="accounting-empty">
                  <p>Сборов пока нет.</p>
                  {canCreate && resolvedTab ? (
                    <Button type="button" onClick={handleToggleCreate}>
                      Создать первый сбор
                    </Button>
                  ) : null}
                </div>
              ) : (
                <ul className="accounting-list">
                  {collections.map((collection) => {
                    const progress = collectionProgressPercent(
                      collection.paidRub,
                      collection.expectedRub,
                    );
                    const progressStyle = {
                      "--accounting-progress": `${progress}%`,
                    } as CSSProperties;
                    const statusClass = cn(
                      "accounting-status",
                      collection.status === "active" &&
                        "accounting-status--active",
                      collection.status === "closed" &&
                        "accounting-status--closed",
                    );
                    return (
                      <li key={collection.id}>
                        <Link
                          to={accountingPath(collection.id)}
                          className="accounting-list-item"
                        >
                          <div className="accounting-list-item__row">
                            <div>
                              <div className="accounting-list-item__title">
                                {collection.title}
                              </div>
                              <div className="accounting-list-item__meta">
                                <span>{collectionOwnerLabel(collection)}</span>
                                {" · "}
                                <span className={statusClass}>
                                  {collectionStatusLabel(collection.status)}
                                </span>
                                {" · "}
                                {collection.paidParticipantCount} /{" "}
                                {collection.participantCount} внесли
                                {collection.dueAt
                                  ? ` · до ${dayjs(collection.dueAt).format("D MMM")}`
                                  : ""}
                              </div>
                            </div>
                            <div className="accounting-list-item__amount">
                              {formatRub(collection.paidRub)} /{" "}
                              {formatRub(collection.expectedRub)}
                            </div>
                          </div>
                          <div className="accounting-progress">
                            <div
                              className="accounting-progress__fill"
                              style={progressStyle}
                            />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </RehearsalsCard>

            {showCreate ? (
              <div className="accounting-form-section">
                <h2 className="accounting-form-section__title">Новый сбор</h2>
                {formError ? (
                  <p className="accounting-page__error">{formError}</p>
                ) : null}

                <FormInlineRow className="accounting-form-row">
                  <label className="accounting-scope-row__field">
                    <span>Название</span>
                    <InlineTextField
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Аренда зала, март"
                    />
                  </label>
                </FormInlineRow>

                <h3 className="accounting-form-section__title">Тарифы</h3>
                <ul className="accounting-tariff-list">
                  {tariffs.map((row) => (
                    <li key={row.key} className="accounting-tariff-item">
                      <label className="accounting-scope-row__field">
                        <span>Тариф</span>
                        <InlineTextField
                          value={row.title}
                          onChange={(event) =>
                            setTariffs((rows) =>
                              rows.map((item) =>
                                item.key === row.key
                                  ? { ...item, title: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="accounting-scope-row__field">
                        <span>₽</span>
                        <InlineTextField
                          value={row.amountRub}
                          onChange={(event) =>
                            setTariffs((rows) =>
                              rows.map((item) =>
                                item.key === row.key
                                  ? { ...item, amountRub: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                      {tariffs.length > 1 ? (
                        <Button
                          type="button"
                          onClick={() => handleRemoveTariff(row.key)}
                        >
                          Удалить
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <Button type="button" onClick={handleAddTariff}>
                  + Тариф
                </Button>

                <h3 className="accounting-form-section__title">
                  Кто скидывается
                </h3>
                {memberOptions.length === 0 ? (
                  <p>Сначала добавьте участников в выбранную сущность.</p>
                ) : (
                  <ul className="accounting-participant-list">
                    {participantDrafts.map((row) => {
                      const member = memberOptions.find(
                        (item) => item.email === row.email,
                      );
                      const label = member?.displayName ?? row.email;
                      return (
                        <li
                          key={row.email}
                          className="accounting-participant-item"
                        >
                          <label className="accounting-participant-item__label">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={(event) =>
                                handleParticipantChange(row.email, {
                                  selected: event.target.checked,
                                })
                              }
                            />{" "}
                            {label}
                          </label>
                          {row.selected ? (
                            <select
                              value={row.tariffIndex}
                              onChange={(event) =>
                                handleParticipantChange(row.email, {
                                  tariffIndex: Number(event.target.value),
                                })
                              }
                            >
                              {tariffs.map((tariff, index) => (
                                <option key={tariff.key} value={index}>
                                  {tariff.title || `Тариф ${index + 1}`}
                                  {tariff.amountRub
                                    ? ` — ${tariff.amountRub} ₽`
                                    : ""}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="accounting-actions">
                  <Button
                    type="button"
                    onClick={() => {
                      void handleCreate();
                    }}
                    disabled={creating}
                  >
                    {creating ? "Создание…" : "Создать сбор"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
