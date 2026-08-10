import { Button } from "@shared/core/button/Button";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { Modal } from "@shared/core/modal/Modal";
import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { type CSSProperties, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  collectionProgressPercent,
  collectionStatusLabel,
  formatRub,
  parseRubInput,
  useAddContributionMutation,
  useGetCollectionQuery,
  useRemindDebtorsMutation,
  useRemoveContributionMutation,
} from "../../features/accounting";
import { useAuth } from "../../features/auth";
import { RehearsalsCard } from "../../features/rehearsals-card/RehearsalsCard";
import { accountingPath } from "../../app/router/paths";
import "../../features/rehearsals/ui/rehearsals.css";
import "./style.css";

dayjs.locale("ru");

type ContributionModalState = {
  email: string;
  label: string;
  defaultAmountRub: number;
};

export function CollectionDetailPage() {
  const { collectionId = "" } = useParams();
  const { accessToken } = useAuth();
  const { data: collection, isLoading, error } = useGetCollectionQuery(collectionId, {
    skip: !accessToken || !collectionId,
  });
  const [addContribution, { isLoading: adding }] = useAddContributionMutation();
  const [removeContribution] = useRemoveContributionMutation();
  const [remindDebtors, { isLoading: reminding }] = useRemindDebtorsMutation();

  const [modal, setModal] = useState<ContributionModalState | null>(null);
  const [amountRub, setAmountRub] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [remindStatus, setRemindStatus] = useState<string | null>(null);

  const openContributionModal = (
    email: string,
    label: string,
    defaultAmountRub: number,
  ) => {
    setModal({ email, label, defaultAmountRub });
    setAmountRub(String(defaultAmountRub));
    setNote("");
    setFormError(null);
  };

  const closeModal = () => {
    setModal(null);
    setFormError(null);
  };

  const handleSubmitContribution = async () => {
    if (!modal || !collection) return;
    setFormError(null);
    const parsedAmount = parseRubInput(amountRub);
    if (parsedAmount == null) {
      setFormError("Укажите сумму в рублях");
      return;
    }
    try {
      await addContribution({
        collectionId: collection.id,
        body: {
          email: modal.email,
          amountRub: parsedAmount,
          note: note.trim() || undefined,
        },
      }).unwrap();
      closeModal();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Не удалось зафиксировать взнос");
    }
  };

  const handleRemoveContribution = async (contributionId: string) => {
    if (!collection) return;
    await removeContribution({
      collectionId: collection.id,
      contributionId,
    });
  };

  const handleRemindDebtors = async () => {
    if (!collection) return;
    setRemindStatus(null);
    try {
      const result = await remindDebtors(collection.id).unwrap();
      if (result.sent === 0) {
        setRemindStatus("Все участники уже внесли взносы");
        return;
      }
      const failedPart =
        result.failed > 0 ? `, не доставлено: ${result.failed}` : "";
      setRemindStatus(`Отправлено писем: ${result.sent}${failedPart}`);
    } catch (e) {
      setRemindStatus(
        e instanceof Error ? e.message : "Не удалось отправить напоминания",
      );
    }
  };

  const memberNameByEmail = (email: string) => {
    const participant = collection?.participants.find((p) => p.email === email);
    return participant?.displayName ?? email;
  };

  const unpaidCount =
    collection != null
      ? collection.participantCount - collection.paidParticipantCount
      : 0;

  if (isLoading) {
    return (
      <div className="app-layout accounting-layout">
        <div className="app-content">
          <main className="main-content">
            <div className="accounting-page">
                <p>Загрузка…</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="app-layout accounting-layout">
        <div className="app-content">
          <main className="main-content">
            <div className="accounting-page">
                <Link
                  className="accounting-page__back"
                  to={accountingPath()}
                >
                  ← Бухгалтерия
                </Link>
                <p className="accounting-page__error">Сбор не найден</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

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

  const myParticipant = collection.myParticipant;
  const myStatusClass = cn(
    "accounting-my-status",
    myParticipant?.isPaid && "accounting-my-status--paid",
  );

  const canRecordFor = (email: string) =>
    collection.canRecordForOthers || email === collection.myParticipant?.email;

  return (
    <div className="app-layout accounting-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="accounting-page">
      <Link
        className="accounting-page__back"
        to={accountingPath()}
      >
        ← Бухгалтерия
      </Link>
      <h1 className="accounting-page__title">{collection.title}</h1>
      <p className="accounting-page__subtitle">
        <span className={statusClass}>{collectionStatusLabel(collection.status)}</span>
        {collection.dueAt
          ? ` · срок до ${dayjs(collection.dueAt).format("D MMMM YYYY")}`
          : ""}
      </p>

      <div className="accounting-detail-summary">
        <div>
          <div className="accounting-detail-summary__value">
            {formatRub(collection.paidRub)}
          </div>
          <div className="accounting-detail-summary__label">Собрано</div>
        </div>
        <div>
          <div className="accounting-detail-summary__value">
            {formatRub(collection.expectedRub)}
          </div>
          <div className="accounting-detail-summary__label">План</div>
        </div>
        <div>
          <div className="accounting-detail-summary__value">
            {collection.paidParticipantCount} / {collection.participantCount}
          </div>
          <div className="accounting-detail-summary__label">Внесли</div>
        </div>
      </div>

      <div className="accounting-progress">
        <div className="accounting-progress__fill" style={progressStyle} />
      </div>

      {collection.canSendReminders ? (
        <div className="accounting-actions">
          <Button
            type="button"
            onClick={handleRemindDebtors}
            disabled={reminding || unpaidCount === 0}
          >
            {reminding
              ? "Отправка…"
              : `Напомнить по почте (${unpaidCount})`}
          </Button>
          {remindStatus ? (
            <span className="accounting-list-item__meta">{remindStatus}</span>
          ) : null}
        </div>
      ) : null}

      {collection.canManage && !collection.smtpConfigured ? (
        <p className="accounting-list-item__meta">
          Почтовые напоминания недоступны: на сервере не настроен SMTP.
        </p>
      ) : null}

      {myParticipant ? (
        <div className={myStatusClass}>
          <strong>Ваш взнос:</strong> {formatRub(myParticipant.paidRub)} /{" "}
          {formatRub(myParticipant.expectedRub)}
          {myParticipant.isPaid ? " — внесено" : ` — осталось ${formatRub(myParticipant.remainingRub)}`}
          {!myParticipant.isPaid && collection.canRecordSelf ? (
            <div className="accounting-actions">
              <Button
                type="button"
                onClick={() =>
                  openContributionModal(
                    myParticipant.email,
                    memberNameByEmail(myParticipant.email),
                    myParticipant.remainingRub,
                  )
                }
              >
                Я внёс
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <RehearsalsCard fluid>
        <div className="accounting-table-wrap">
          <table className="accounting-table">
            <thead>
              <tr>
                <th>Участник</th>
                <th>Тариф</th>
                <th>План</th>
                <th>Внесено</th>
                <th>Остаток</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {collection.participants.map((participant) => {
                const paidClass = participant.isPaid
                  ? "accounting-table__paid"
                  : "accounting-table__debt";
                const canRecord = canRecordFor(participant.email);
                return (
                  <tr key={participant.id}>
                    <td>{memberNameByEmail(participant.email)}</td>
                    <td>{participant.tariffTitle}</td>
                    <td>{formatRub(participant.expectedRub)}</td>
                    <td className={paidClass}>{formatRub(participant.paidRub)}</td>
                    <td className={paidClass}>
                      {participant.isPaid
                        ? "—"
                        : formatRub(participant.remainingRub)}
                    </td>
                    <td>
                      {canRecord && !participant.isPaid ? (
                        <Button
                          type="button"
                          onClick={() =>
                            openContributionModal(
                              participant.email,
                              memberNameByEmail(participant.email),
                              participant.remainingRub,
                            )
                          }
                        >
                          Взнос
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </RehearsalsCard>

      {collection.contributions.length > 0 ? (
        <div className="accounting-contributions">
          <h2 className="accounting-contributions__title">Журнал взносов</h2>
          {collection.contributions.map((contribution) => (
            <div key={contribution.id} className="accounting-contribution-row">
              <div>
                <strong>{memberNameByEmail(contribution.email)}</strong>
                {" — "}
                {formatRub(contribution.amountRub)}
                {" · "}
                {dayjs(contribution.paidAt).format("D MMM YYYY")}
                {contribution.note ? ` · ${contribution.note}` : ""}
                <div className="accounting-list-item__meta">
                  зафиксировал {contribution.recordedByEmail}
                </div>
              </div>
              {collection.canManage ? (
                <Button
                  type="button"
                  onClick={() => handleRemoveContribution(contribution.id)}
                >
                  Удалить
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <Modal isOpen={modal != null} onClose={closeModal}>
        {modal ? (
          <>
            <h2 className="accounting-form-section__title">Зафиксировать взнос</h2>
            <p>{modal.label}</p>
            {formError ? <p className="accounting-page__error">{formError}</p> : null}
            <FormInlineRow className="accounting-form-row">
              <label className="accounting-scope-row__field">
                <span>Сумма, ₽</span>
                <InlineTextField
                  value={amountRub}
                  onChange={(event) => setAmountRub(event.target.value)}
                />
              </label>
            </FormInlineRow>
            <FormInlineRow className="accounting-form-row">
              <label className="accounting-scope-row__field">
                <span>Комментарий</span>
                <InlineTextField
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Сбер, наличные…"
                />
              </label>
            </FormInlineRow>
            <div className="accounting-actions">
              <Button type="button" onClick={handleSubmitContribution} disabled={adding}>
                {adding ? "Сохранение…" : "Сохранить"}
              </Button>
              <Button type="button" onClick={closeModal}>
                Отмена
              </Button>
            </div>
          </>
        ) : null}
      </Modal>
          </div>
        </main>
      </div>
    </div>
  );
}
