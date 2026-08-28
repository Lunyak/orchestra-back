import { useMemo, useState } from "react";
import type {
  PremiseBookingActor,
  PremiseSlotItem,
  PremiseSummary,
} from "../../../sync/api/premises";
import {
  bookingActorValue,
  emptySlotForm,
  slotToForm,
} from "./premise-detail-forms";
import type {
  FreePremiseInterval,
  RentalScheduleFormDay,
  SlotFormState,
} from "./premise-detail-types";
import {
  applyFreeIntervalToSlotForm,
  buildCreateRentalPayload,
  buildSlotUpdatePayload,
  canEditPremiseSlot,
  extractError,
  validateSlotForm,
} from "./premise-detail-helpers";
import { premiseBookedAsKindLabel } from "./premise-utils";
import type { PremiseDetailData } from "./usePremiseDetailData";

export function usePremiseDetailSlotModal(input: {
  premiseId: string;
  premise: PremiseSummary | undefined;
  userEmail: string;
  myProfile: PremiseDetailData["myProfile"];
  selectedDate: string;
  bookingActors: PremiseBookingActor[];
  canManagePremise: boolean;
  createRental: PremiseDetailData["createRental"];
  creatingRental: boolean;
  updateSlot: PremiseDetailData["updateSlot"];
  updatingSlot: boolean;
  deleteSlot: PremiseDetailData["deleteSlot"];
}) {
  const {
    premiseId,
    premise,
    userEmail,
    myProfile,
    selectedDate,
    bookingActors,
    canManagePremise,
    createRental,
    creatingRental,
    updateSlot,
    updatingSlot,
    deleteSlot,
  } = input;

  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<PremiseSlotItem | null>(null);
  const [slotForm, setSlotForm] = useState<SlotFormState>(() =>
    emptySlotForm(selectedDate),
  );
  const [slotError, setSlotError] = useState<string | null>(null);

  const bookingActorOptions = useMemo(
    () =>
      bookingActors.map((actor) => ({
        value: bookingActorValue(actor),
        label: `${premiseBookedAsKindLabel(actor.kind)} · ${actor.title}`,
      })),
    [bookingActors],
  );
  const selectedBookingActorValue = bookingActorValue({
    kind: slotForm.bookedAsKind,
    id: slotForm.bookedAsId || null,
    title: slotForm.bookedAsTitle,
  });

  function openCreateSlot() {
    setEditingSlot(null);
    setSlotForm(emptySlotForm(selectedDate, bookingActors, myProfile));
    setSlotError(null);
    setSlotModalOpen(true);
  }

  function openCreateSlotForInterval(interval: FreePremiseInterval) {
    setEditingSlot(null);
    const form = emptySlotForm(selectedDate, bookingActors, myProfile);
    setSlotForm(applyFreeIntervalToSlotForm(form, interval));
    setSlotError(null);
    setSlotModalOpen(true);
  }

  function updateRentalScheduleDay(
    weekday: number,
    patch: Partial<
      Pick<RentalScheduleFormDay, "enabled" | "startsAt" | "endsAt">
    >,
  ) {
    setSlotForm((state) => ({
      ...state,
      schedules: state.schedules.map((day) =>
        day.weekday === weekday ? { ...day, ...patch } : day,
      ),
    }));
  }

  function openEditSlot(slot: PremiseSlotItem) {
    setEditingSlot(slot);
    setSlotForm(slotToForm(slot));
    setSlotError(null);
    setSlotModalOpen(true);
  }

  async function saveSlot() {
    const validationError = validateSlotForm(slotForm, editingSlot);
    if (validationError) {
      setSlotError(validationError);
      return;
    }
    setSlotError(null);
    try {
      if (editingSlot) {
        await updateSlot({
          premiseId,
          slotId: editingSlot.id,
          body: buildSlotUpdatePayload(slotForm, canManagePremise),
        }).unwrap();
      } else {
        await createRental({
          premiseId,
          body: buildCreateRentalPayload(slotForm),
        }).unwrap();
      }
      setSlotModalOpen(false);
    } catch (e: unknown) {
      setSlotError(extractError(e, "Не удалось сохранить слот"));
    }
  }

  async function handleDeleteSlot(slot: PremiseSlotItem) {
    if (!confirm(`Удалить слот «${slot.title}»?`)) return;
    try {
      await deleteSlot({ premiseId, slotId: slot.id }).unwrap();
    } catch {
      // ignore
    }
  }

  function canEditSlot(slot: PremiseSlotItem): boolean {
    return canEditPremiseSlot(premise, slot, userEmail);
  }

  return {
    slotModalOpen,
    setSlotModalOpen,
    editingSlot,
    setEditingSlot,
    slotForm,
    setSlotForm,
    slotError,
    setSlotError,
    creatingRental,
    updatingSlot,
    bookingActorOptions,
    selectedBookingActorValue,
    openCreateSlot,
    openCreateSlotForInterval,
    updateRentalScheduleDay,
    openEditSlot,
    saveSlot,
    handleDeleteSlot,
    canEditSlot,
  };
}
