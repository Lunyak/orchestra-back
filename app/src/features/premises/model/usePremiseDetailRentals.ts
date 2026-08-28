import { useState } from "react";
import { api } from "../../../sync/api/client";
import type {
  PremiseRentalItem,
  PremiseSlotPaymentStatus,
  PremiseSummary,
} from "../../../sync/api/premises";
import {
  buildCancelRentalWarning,
  extractError,
} from "./premise-detail-helpers";
import { decodeUploadedFileName } from "./premise-utils";
import type { PremiseDetailData } from "./usePremiseDetailData";

export function usePremiseDetailRentals(input: {
  premiseId: string;
  premise: PremiseSummary | undefined;
  createAgreement: PremiseDetailData["createAgreement"];
  generateAgreement: PremiseDetailData["generateAgreement"];
  updateRentalStatus: PremiseDetailData["updateRentalStatus"];
  updateRentalPayment: PremiseDetailData["updateRentalPayment"];
  uploadAgreement: PremiseDetailData["uploadAgreement"];
}) {
  const {
    premiseId,
    premise,
    createAgreement,
    generateAgreement,
    updateRentalStatus,
    updateRentalPayment,
    uploadAgreement,
  } = input;

  const [rentalActionId, setRentalActionId] = useState<string | null>(null);
  const [rentalActionError, setRentalActionError] = useState<string | null>(
    null,
  );

  async function handleCreateAgreement(rental: PremiseRentalItem) {
    setRentalActionId(rental.id);
    setRentalActionError(null);
    try {
      await createAgreement({
        premiseId,
        rentalId: rental.id,
        body: {
          landlordName: premise?.ownerTitle || premise?.name,
          tenantName:
            rental.bookedAsTitle ||
            rental.contactName ||
            rental.contactEmail ||
            undefined,
        },
      }).unwrap();
    } catch (error: unknown) {
      setRentalActionError(
        extractError(error, "Не удалось оформить договор"),
      );
    } finally {
      setRentalActionId(null);
    }
  }

  async function handleGenerateAgreement(rentalId: string) {
    setRentalActionId(rentalId);
    setRentalActionError(null);
    try {
      await generateAgreement({ premiseId, rentalId }).unwrap();
    } catch (error: unknown) {
      setRentalActionError(
        extractError(error, "Не удалось сформировать договор"),
      );
    } finally {
      setRentalActionId(null);
    }
  }

  async function handleRentalStatus(
    rental: PremiseRentalItem,
    status: "active" | "cancelled",
  ) {
    if (
      status === "cancelled" &&
      !confirm(buildCancelRentalWarning(rental))
    ) {
      return;
    }
    setRentalActionId(rental.id);
    setRentalActionError(null);
    try {
      await updateRentalStatus({
        premiseId,
        rentalId: rental.id,
        status,
      }).unwrap();
    } catch (error: unknown) {
      setRentalActionError(
        extractError(error, "Не удалось изменить статус аренды"),
      );
    } finally {
      setRentalActionId(null);
    }
  }

  async function handleBookingRequestReview(
    rentalId: string,
    status: "active" | "cancelled",
    title: string,
  ) {
    if (
      status === "cancelled" &&
      !confirm(`Отклонить заявку «${title}»?`)
    ) {
      return;
    }
    setRentalActionId(rentalId);
    setRentalActionError(null);
    try {
      await updateRentalStatus({
        premiseId,
        rentalId,
        status,
      }).unwrap();
    } catch (error: unknown) {
      setRentalActionError(
        extractError(
          error,
          status === "active"
            ? "Не удалось подтвердить заявку"
            : "Не удалось отклонить заявку",
        ),
      );
    } finally {
      setRentalActionId(null);
    }
  }

  async function handleRentalPayment(
    rentalId: string,
    paymentId: string,
    status: PremiseSlotPaymentStatus,
  ) {
    setRentalActionId(rentalId);
    setRentalActionError(null);
    try {
      await updateRentalPayment({
        premiseId,
        rentalId,
        paymentId,
        status,
      }).unwrap();
    } catch (error: unknown) {
      setRentalActionError(
        extractError(error, "Не удалось изменить статус платежа"),
      );
    } finally {
      setRentalActionId(null);
    }
  }

  async function handleUploadAgreement(
    rentalId: string,
    kind: "uploaded" | "signed",
    file: File,
  ) {
    setRentalActionId(rentalId);
    setRentalActionError(null);
    try {
      await uploadAgreement({ premiseId, rentalId, kind, file }).unwrap();
    } catch (error: unknown) {
      setRentalActionError(extractError(error, "Не удалось загрузить договор"));
    } finally {
      setRentalActionId(null);
    }
  }

  async function handleDownloadAgreement(
    rentalId: string,
    documentId: string,
    fileName: string,
  ) {
    setRentalActionError(null);
    try {
      const response = await api.get(
        `/premises/${encodeURIComponent(premiseId)}/rentals/${encodeURIComponent(rentalId)}/agreement/documents/${encodeURIComponent(documentId)}`,
        { responseType: "blob" },
      );
      const objectUrl = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = decodeUploadedFileName(fileName);
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error: unknown) {
      setRentalActionError(extractError(error, "Не удалось скачать документ"));
    }
  }

  return {
    rentalActionId,
    setRentalActionId,
    rentalActionError,
    setRentalActionError,
    handleCreateAgreement,
    handleGenerateAgreement,
    handleRentalStatus,
    handleBookingRequestReview,
    handleRentalPayment,
    handleUploadAgreement,
    handleDownloadAgreement,
  };
}
