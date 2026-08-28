import { Button } from "@shared/core/button/Button";
import { CustomSelect } from "@shared/core/custom-select/CustomSelect";
import cn from "classnames";
import type { TeamProfile } from "../../../sync/api/profile";
import type {
  PremiseRentalItem,
  PremiseSlotPaymentStatus,
} from "../../../sync/api/premises";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import {
  formatRentalDate,
  formatRubles,
  rentalContactLabel,
} from "../model/premise-detail-helpers";
import {
  agreementStatusLabel,
  paymentStatusLabel,
  paymentStatusOptions,
  rentalStatusLabel,
  usageTypeLabel,
} from "../model/premise-detail-options";
import {
  agreementDocumentKindLabel,
  decodeUploadedFileName,
} from "../model/premise-utils";
import { PremiseRentalPeople } from "./PremiseRentalPeople";

export type PremiseDetailRentalsTabProps = {
  canBook: boolean;
  canManage: boolean;
  userEmail: string;
  rentals: PremiseRentalItem[];
  memberProfileByEmail: Map<string, TeamProfile>;
  rentalActionId: string | null;
  rentalActionError: string | null;
  onOpenCreateSlot: () => void;
  onRentalPayment: (
    rentalId: string,
    paymentId: string,
    status: PremiseSlotPaymentStatus,
  ) => void;
  onRentalStatus: (
    rental: PremiseRentalItem,
    status: "active" | "cancelled",
  ) => void;
  onDownloadAgreement: (
    rentalId: string,
    documentId: string,
    fileName: string,
  ) => void;
  onGenerateAgreement: (rentalId: string) => void;
  onUploadAgreement: (
    rentalId: string,
    kind: "uploaded" | "signed",
    file: File,
  ) => void;
  onCreateAgreement: (rental: PremiseRentalItem) => void;
};

export function PremiseDetailRentalsTab({
  canBook,
  canManage,
  userEmail,
  rentals,
  memberProfileByEmail,
  rentalActionId,
  rentalActionError,
  onOpenCreateSlot,
  onRentalPayment,
  onRentalStatus,
  onDownloadAgreement,
  onGenerateAgreement,
  onUploadAgreement,
  onCreateAgreement,
}: PremiseDetailRentalsTabProps) {
  return (
    <div className="premises-rentals">
      <div className="premises-rentals__header">
        <div>
          <div className="rehearsals-card-title">Аренды</div>
          <p className="rehearsals-muted">
            Разовые и регулярные серии, платежи и документы.
          </p>
        </div>
        {canBook ? (
          <Button type="button" onClick={onOpenCreateSlot}>
            Новая аренда
          </Button>
        ) : null}
      </div>
      {rentalActionError ? (
        <div className="rehearsals-error">{rentalActionError}</div>
      ) : null}
      {rentals.length ? (
        <div className="premises-rentals__list">
          {rentals.map((rental) => {
            const normalizedUserEmail = userEmail.trim().toLowerCase();
            const canManageRental =
              canManage ||
              rental.createdByEmail.trim().toLowerCase() ===
                normalizedUserEmail ||
              rental.contactEmail?.trim().toLowerCase() === normalizedUserEmail;
            const rentalPeriod =
              rental.recurrenceType === "weekly"
                ? rental.endsOn
                  ? `${formatRentalDate(rental.startsOn)} — ${formatRentalDate(rental.endsOn)}`
                  : `с ${formatRentalDate(rental.startsOn)} · бессрочно`
                : formatRentalDate(rental.startsOn);
            const rentalPrice =
              rental.monthlyAmountRub != null
                ? `${formatRubles(rental.monthlyAmountRub)} в месяц`
                : null;
            return (
              <RehearsalsCard
                key={rental.id}
                fluid
                className="premises-rental-card"
              >
                <div className="premises-rental-card__header">
                  <div>
                    <strong>{rental.title}</strong>
                    <div className="rehearsals-muted">
                      {usageTypeLabel(rental.usageType)}
                      {" · "}
                      {rental.recurrenceType === "weekly"
                        ? "Регулярная"
                        : "Разовая"}
                      {" · "}
                      {rentalPeriod}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "premises-rental-card__status",
                      rental.status === "active" &&
                        "premises-rental-card__status--active",
                    )}
                  >
                    {rentalStatusLabel(rental.status)}
                  </span>
                </div>
                <PremiseRentalPeople
                  rental={rental}
                  profileByEmail={memberProfileByEmail}
                />
                {rentalPrice ? (
                  <div className="premises-rental-card__price">
                    {rentalPrice}
                    {rental.paymentDueDay
                      ? ` · до ${rental.paymentDueDay}-го числа`
                      : ""}
                  </div>
                ) : null}
                {rental.payments.length ? (
                  <div className="premises-rental-payments">
                    {rental.payments.map((payment) => (
                      <div key={payment.id} className="premises-rental-payment">
                        <span>
                          {formatRentalDate(payment.periodStart)}
                          {" · "}
                          {formatRubles(payment.amountRub)}
                          {" · до "}
                          {formatRentalDate(payment.dueAt)}
                        </span>
                        {canManage ? (
                          <CustomSelect
                            value={payment.status}
                            options={paymentStatusOptions}
                            onChange={(value) =>
                              void onRentalPayment(
                                rental.id,
                                payment.id,
                                value as PremiseSlotPaymentStatus,
                              )
                            }
                            aria-label={`Статус платежа за ${formatRentalDate(payment.periodStart)}`}
                          />
                        ) : (
                          <span>{paymentStatusLabel(payment.status)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
                {rental.contactName ||
                rental.contactPhone ||
                rental.contactEmail ? (
                  <div className="rehearsals-muted">
                    Контакт: {rentalContactLabel(rental)}
                  </div>
                ) : null}
                {canManage && rental.status !== "cancelled" ? (
                  <div className="premises-rental-card__actions">
                    {rental.status === "pending" ? (
                      <Button
                        type="button"
                        disabled={rentalActionId === rental.id}
                        onClick={() => void onRentalStatus(rental, "active")}
                      >
                        Подтвердить аренду
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      className="danger"
                      disabled={rentalActionId === rental.id}
                      onClick={() => void onRentalStatus(rental, "cancelled")}
                    >
                      Отменить аренду
                    </Button>
                  </div>
                ) : null}
                {rental.agreement ? (
                  <div className="premises-rental-contract">
                    <div className="premises-rental-contract__header">
                      <div className="premises-rental-contract__title">
                        <span className="premises-rental-contract__eyebrow">
                          Договор
                        </span>
                        <strong className="premises-rental-contract__number">
                          {rental.agreement.number}
                        </strong>
                      </div>
                      <span
                        className={cn(
                          "premises-rental-contract__status",
                          rental.agreement.status === "active" &&
                            "premises-rental-contract__status--active",
                          rental.agreement.status === "awaiting_signature" &&
                            "premises-rental-contract__status--awaiting",
                        )}
                      >
                        {agreementStatusLabel(rental.agreement.status)}
                      </span>
                    </div>
                    {rental.agreement.documents.length ? (
                      <ul className="premises-rental-contract__documents">
                        {rental.agreement.documents.map((documentItem) => {
                          const documentLabel = agreementDocumentKindLabel(
                            documentItem.kind,
                          );
                          const documentName = decodeUploadedFileName(
                            documentItem.fileName,
                          );
                          return (
                            <li key={documentItem.id}>
                              <button
                                type="button"
                                className={cn(
                                  "premises-rental-contract__doc",
                                  documentItem.kind === "signed" &&
                                    "premises-rental-contract__doc--signed",
                                )}
                                onClick={() =>
                                  void onDownloadAgreement(
                                    rental.id,
                                    documentItem.id,
                                    documentItem.fileName,
                                  )
                                }
                              >
                                <span className="premises-rental-contract__doc-kind">
                                  {documentLabel}
                                </span>
                                <span
                                  className="premises-rental-contract__doc-name"
                                  title={documentName}
                                >
                                  {documentName}
                                </span>
                                <span className="premises-rental-contract__doc-action">
                                  Скачать
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="premises-rental-contract__empty rehearsals-muted">
                        Документов пока нет — сформируйте или загрузите PDF
                      </p>
                    )}
                    {canManageRental ? (
                      <div className="premises-rental-contract__actions">
                        <Button
                          type="button"
                          disabled={rentalActionId === rental.id}
                          onClick={() => void onGenerateAgreement(rental.id)}
                        >
                          Сформировать PDF
                        </Button>
                        <label className="premises-rental-contract__upload">
                          Загрузить свой PDF
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (!file) return;
                              void onUploadAgreement(
                                rental.id,
                                "uploaded",
                                file,
                              );
                              event.target.value = "";
                            }}
                          />
                        </label>
                        <label className="premises-rental-contract__upload premises-rental-contract__upload--signed">
                          Загрузить подписанный
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (!file) return;
                              void onUploadAgreement(rental.id, "signed", file);
                              event.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                ) : canManageRental ? (
                  <div className="premises-rental-card__actions">
                    <Button
                      type="button"
                      disabled={rentalActionId === rental.id}
                      onClick={() => void onCreateAgreement(rental)}
                    >
                      Оформить договор
                    </Button>
                  </div>
                ) : (
                  <div className="rehearsals-muted">Без договора</div>
                )}
              </RehearsalsCard>
            );
          })}
        </div>
      ) : (
        <div className="premises-overview__empty rehearsals-muted">
          Аренд пока нет.
        </div>
      )}
    </div>
  );
}
