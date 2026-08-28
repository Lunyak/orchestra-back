import dayjs from "dayjs";
import "dayjs/locale/ru";
import { usePremiseDetailData } from "./usePremiseDetailData";
import { usePremiseDetailMembers } from "./usePremiseDetailMembers";
import { usePremiseDetailOverview } from "./usePremiseDetailOverview";
import { usePremiseDetailRentals } from "./usePremiseDetailRentals";
import { usePremiseDetailSchedule } from "./usePremiseDetailSchedule";
import { usePremiseDetailSettings } from "./usePremiseDetailSettings";
import { usePremiseDetailSlotModal } from "./usePremiseDetailSlotModal";

dayjs.locale("ru");

export function usePremiseDetailPage() {
  const data = usePremiseDetailData();
  const overview = usePremiseDetailOverview(data.slots);
  const schedule = usePremiseDetailSchedule({
    premise: data.premise,
    slots: data.slots,
    selectedDate: data.selectedDate,
  });
  const members = usePremiseDetailMembers({
    premiseId: data.premiseId,
    addMember: data.addMember,
    addingMember: data.addingMember,
    updateMember: data.updateMember,
    removeMember: data.removeMember,
  });
  const rentals = usePremiseDetailRentals({
    premiseId: data.premiseId,
    premise: data.premise,
    createAgreement: data.createAgreement,
    generateAgreement: data.generateAgreement,
    updateRentalStatus: data.updateRentalStatus,
    updateRentalPayment: data.updateRentalPayment,
    uploadAgreement: data.uploadAgreement,
  });
  const settings = usePremiseDetailSettings({
    premiseId: data.premiseId,
    premise: data.premise,
    premisesPath: data.premisesPath,
    updatePremise: data.updatePremise,
    updatingPremise: data.updatingPremise,
    deletePremise: data.deletePremise,
    deletingPremise: data.deletingPremise,
  });
  const slotModal = usePremiseDetailSlotModal({
    premiseId: data.premiseId,
    premise: data.premise,
    userEmail: data.userEmail,
    myProfile: data.myProfile,
    selectedDate: data.selectedDate,
    bookingActors: data.bookingActors,
    canManagePremise: data.canManagePremise,
    createRental: data.createRental,
    creatingRental: data.creatingRental,
    updateSlot: data.updateSlot,
    updatingSlot: data.updatingSlot,
    deleteSlot: data.deleteSlot,
  });

  return {
    premiseId: data.premiseId,
    theaterId: data.theaterId,
    studioId: data.studioId,
    premisesPath: data.premisesPath,
    accessToken: data.accessToken,
    myProfile: data.myProfile,
    userEmail: data.userEmail,
    activeTab: data.activeTab,
    setActiveTab: data.setActiveTab,
    calendarState: data.calendarState,
    setCalendarState: data.setCalendarState,
    selectedDate: data.selectedDate,
    premise: data.premise,
    premiseLoading: data.premiseLoading,
    premiseError: data.premiseError,
    slots: data.slots,
    slotsFetching: data.slotsFetching,
    membersData: data.membersData,
    rentalsData: data.rentalsData,
    memberProfileByEmail: data.memberProfileByEmail,
    canManagePremise: data.canManagePremise,
    bookingActors: data.bookingActors,
    ...overview,
    ...schedule,
    ...members,
    ...rentals,
    ...settings,
    ...slotModal,
  };
}
