import { Button } from "@shared/core/button/Button";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  collectionProgressPercent,
  collectionStatusLabel,
  formatRub,
  parseRubInput,
  useCreateCollectionMutation,
  useListCollectionsQuery,
} from "../../features/accounting";
import { useAuth } from "../../features/auth";
import { useProject } from "../../features/project";
import { RehearsalsCard } from "../../features/rehearsals-card/RehearsalsCard";
import { memberLabel } from "../../features/troupe";
import { useMyTroupeQuery } from "../../features/troupe/api/troupe-api";
import { accountingListErrorMessage } from "../../features/accounting/model/accounting-list-error";
import { AdminSectionChrome } from "../../shared/components/admin/AdminSectionChrome";
import "../../features/rehearsals/ui/rehearsals.css";
import "./style.css";

dayjs.locale("ru");

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

function newTariffDraft(): TariffDraft {
  return {
    key: `tariff-${Date.now()}-${Math.random()}`,
    title: "",
    amountRub: "",
  };
}

export function AccountingPage() {
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const location = useLocation();
  const {
    data: collectionsData,
    isLoading,
    isError,
    error,
  } = useListCollectionsQuery(undefined, { skip: !accessToken });
  const { data: troupeData } = useMyTroupeQuery(
    { project: projectName ?? "" },
    { skip: !accessToken || !projectName },
  );
  const [createCollection, { isLoading: creating }] = useCreateCollectionMutation();

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [tariffs, setTariffs] = useState<TariffDraft[]>([
    { key: "t1", title: "Полный", amountRub: "5000" },
    { key: "t2", title: "Льготный", amountRub: "2300" },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  const troupeMembersFromApi = collectionsData?.createMemberOptions ?? [];
  const troupeMembersFromTroupe = useMemo(() => {
    const rows = troupeData?.members ?? troupeData?.troupeMembers ?? [];
    return rows.map((member) => ({
      email: member.email,
      displayName: memberLabel(member),
    }));
  }, [troupeData]);
  const troupeMembers =
    troupeMembersFromApi.length > 0
      ? troupeMembersFromApi
      : troupeMembersFromTroupe;

  const [participants, setParticipants] = useState<ParticipantDraft[]>([]);

  const participantDrafts = useMemo(() => {
    if (participants.length === troupeMembers.length) return participants;
    return troupeMembers.map((member) => {
      const existing = participants.find((p) => p.email === member.email);
      return (
        existing ?? {
          email: member.email,
          selected: false,
          tariffIndex: 0,
        }
      );
    });
  }, [participants, troupeMembers]);

  const collections = collectionsData?.collections ?? [];
  const canCreateFromApi = collectionsData?.canCreateCollections;
  const canManageAnyCollection = collections.some((collection) => collection.canManage);
  const canCreate =
    Boolean(accessToken) &&
    (canCreateFromApi !== false || canManageAnyCollection || isError);
  const createBlocked =
    !isLoading &&
    !isError &&
    canCreateFromApi === false &&
    !canManageAnyCollection;

  useEffect(() => {
    const state = location.state as { openCreate?: boolean } | null;
    if (state?.openCreate && canCreate) {
      setShowCreate(true);
    }
  }, [location.state, canCreate]);

  const handleToggleCreate = () => {
    setShowCreate((v) => !v);
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
    setParticipants((rows) => {
      const base = participantDrafts.map((row) =>
        row.email === email ? { ...row, ...patch } : row,
      );
      return base;
    });
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

    try {
      await createCollection({
        title: trimmedTitle,
        tariffs: validTariffs,
        participants: selectedParticipants,
      }).unwrap();
      setTitle("");
      setShowCreate(false);
      setParticipants([]);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Не удалось создать сбор");
    }
  };

  const errorMessage = isError ? accountingListErrorMessage(error) : null;

  return (
    <div className="app-layout accounting-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="accounting-page">
            <AdminSectionChrome activeSection="accounting">
      <div className="accounting-page__header">
        <div>
          <h1 className="accounting-page__title">Бухгалтерия</h1>
          <p className="accounting-page__subtitle">
            Сборы и взносы труппы. Тарифы, участники, учёт платежей.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleToggleCreate}
          disabled={!accessToken}
          title={createBlocked ? "Доступно владельцу труппы и бухгалтеру" : undefined}
        >
          {showCreate ? "Отмена" : "Новый сбор"}
        </Button>
      </div>

      {createBlocked ? (
        <p className="accounting-page__hint">
          Создавать сборы могут владелец труппы и бухгалтер. Назначьте роль в разделе{" "}
          <Link to="/troupe">Команда → должности</Link>.
        </p>
      ) : null}

      {errorMessage ? <p className="accounting-page__error">{errorMessage}</p> : null}

      <RehearsalsCard fluid>
        {isLoading ? (
          <p>Загрузка…</p>
        ) : collections.length === 0 ? (
          <div className="accounting-empty">
            <p>Сборов пока нет.</p>
            {canCreate ? (
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
                collection.status === "active" && "accounting-status--active",
                collection.status === "closed" && "accounting-status--closed",
              );
              return (
                <li key={collection.id}>
                  <Link
                    to={`/accounting/${collection.id}`}
                    className="accounting-list-item"
                  >
                    <div className="accounting-list-item__row">
                      <div>
                        <div className="accounting-list-item__title">
                          {collection.title}
                        </div>
                        <div className="accounting-list-item__meta">
                          <span className={statusClass}>
                            {collectionStatusLabel(collection.status)}
                          </span>
                          {" · "}
                          {collection.paidParticipantCount} / {collection.participantCount} внесли
                          {collection.dueAt
                            ? ` · до ${dayjs(collection.dueAt).format("D MMM")}`
                            : ""}
                        </div>
                      </div>
                      <div className="accounting-list-item__amount">
                        {formatRub(collection.paidRub)} / {formatRub(collection.expectedRub)}
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
          {formError ? <p className="accounting-page__error">{formError}</p> : null}

          <FormInlineRow className="accounting-form-row">
            <InlineTextField
              label="Название"
              value={title}
              onChange={setTitle}
              placeholder="Аренда зала, март"
            />
          </FormInlineRow>

          <h3 className="accounting-form-section__title">Тарифы</h3>
          <ul className="accounting-tariff-list">
            {tariffs.map((row) => (
              <li key={row.key} className="accounting-tariff-item">
                <InlineTextField
                  label="Тариф"
                  value={row.title}
                  onChange={(v) =>
                    setTariffs((rows) =>
                      rows.map((item) =>
                        item.key === row.key ? { ...item, title: v } : item,
                      ),
                    )
                  }
                />
                <InlineTextField
                  label="₽"
                  value={row.amountRub}
                  onChange={(v) =>
                    setTariffs((rows) =>
                      rows.map((item) =>
                        item.key === row.key ? { ...item, amountRub: v } : item,
                      ),
                    )
                  }
                />
                {tariffs.length > 1 ? (
                  <Button type="button" onClick={() => handleRemoveTariff(row.key)}>
                    Удалить
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <Button type="button" onClick={handleAddTariff}>
            + Тариф
          </Button>

          <h3 className="accounting-form-section__title">Кто скидывается</h3>
          {troupeMembers.length === 0 ? (
            <p>Сначала добавьте участников в труппу.</p>
          ) : (
            <ul className="accounting-participant-list">
              {participantDrafts.map((row) => {
                const member = troupeMembers.find((m) => m.email === row.email);
                const label = member?.displayName ?? row.email;
                return (
                  <li key={row.email} className="accounting-participant-item">
                    <label className="accounting-participant-item__label">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) =>
                          handleParticipantChange(row.email, {
                            selected: e.target.checked,
                          })
                        }
                      />{" "}
                      {label}
                    </label>
                    {row.selected ? (
                      <select
                        value={row.tariffIndex}
                        onChange={(e) =>
                          handleParticipantChange(row.email, {
                            tariffIndex: Number(e.target.value),
                          })
                        }
                      >
                        {tariffs.map((tariff, index) => (
                          <option key={tariff.key} value={index}>
                            {tariff.title || `Тариф ${index + 1}`}
                            {tariff.amountRub ? ` — ${tariff.amountRub} ₽` : ""}
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
            <Button type="button" onClick={handleCreate} disabled={creating}>
              {creating ? "Создание…" : "Создать сбор"}
            </Button>
          </div>
        </div>
      ) : null}
            </AdminSectionChrome>
          </div>
        </main>
      </div>
    </div>
  );
}
