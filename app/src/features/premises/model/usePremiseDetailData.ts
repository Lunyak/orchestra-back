import type { CalendarSectionState } from "@shared/components/calendar/CalendarSection";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  globalPaths,
  studioPremisesPath,
  theaterPremisesPath,
} from "../../../app/router/paths";
import { useAuth } from "../../auth";
import {
  useMyProfileQuery,
  useProfilesBatchQuery,
} from "../../profile/api/profile-api";
import {
  useAddPremiseMemberMutation,
  useCreatePremiseRentalMutation,
  useCreatePremiseRentalAgreementMutation,
  useDeletePremiseMutation,
  useDeletePremiseSlotMutation,
  useGetPremiseQuery,
  useGeneratePremiseRentalAgreementMutation,
  useListPremiseRentalsQuery,
  useListPremiseMembersQuery,
  useListPremiseSlotsQuery,
  useRemovePremiseMemberMutation,
  useUpdatePremiseMutation,
  useUpdatePremiseMemberMutation,
  useUpdatePremiseRentalPaymentMutation,
  useUpdatePremiseRentalStatusMutation,
  useUpdatePremiseSlotMutation,
  useUploadPremiseRentalAgreementMutation,
} from "../api/premises-api";
import type { PremiseTab } from "./premise-detail-types";
import {
  buildMemberProfileByEmail,
  buildPremiseSlotsQueryRange,
  collectMemberEmails,
  collectSlotPeopleEmails,
  mergeUniqueEmails,
} from "./premise-detail-helpers";
import { isoDate } from "./premise-utils";

export function usePremiseDetailData() {
  const {
    premiseId = "",
    theaterId = "",
    studioId = "",
  } = useParams<{
    premiseId: string;
    theaterId?: string;
    studioId?: string;
  }>();
  const premisesPath = theaterId
    ? theaterPremisesPath(theaterId)
    : studioId
      ? studioPremisesPath(studioId)
      : globalPaths.premises;
  const { accessToken } = useAuth();
  const { data: myProfile } = useMyProfileQuery(undefined, {
    skip: !accessToken,
  });
  const userEmail = myProfile?.email ?? "";

  const [activeTab, setActiveTab] = useState<PremiseTab>("overview");
  const [calendarState, setCalendarState] =
    useState<CalendarSectionState | null>(null);

  const range = useMemo(
    () => buildPremiseSlotsQueryRange(calendarState),
    [calendarState],
  );
  const selectedDate = calendarState?.selectedDate ?? isoDate(new Date());

  const {
    data: premise,
    isLoading: premiseLoading,
    error: premiseError,
  } = useGetPremiseQuery(premiseId, { skip: !accessToken || !premiseId });

  const { data: slotsData, isFetching: slotsFetching } =
    useListPremiseSlotsQuery(
      { premiseId, from: range.from, to: range.to },
      { skip: !accessToken || !premiseId },
    );

  const { data: membersData } = useListPremiseMembersQuery(premiseId, {
    skip: !accessToken || !premiseId || !premise?.canManage,
  });
  const { data: rentalsData } = useListPremiseRentalsQuery(premiseId, {
    skip: !accessToken || !premiseId,
  });

  const memberEmails = useMemo(
    () => collectMemberEmails(membersData?.members),
    [membersData?.members],
  );
  const slotPeopleEmails = useMemo(
    () => collectSlotPeopleEmails(slotsData?.slots, rentalsData?.rentals),
    [rentalsData?.rentals, slotsData?.slots],
  );
  const profileEmails = useMemo(
    () => mergeUniqueEmails(memberEmails, slotPeopleEmails),
    [memberEmails, slotPeopleEmails],
  );
  const { data: memberProfiles = [] } = useProfilesBatchQuery(profileEmails, {
    skip: !accessToken || profileEmails.length === 0,
  });
  const memberProfileByEmail = useMemo(
    () => buildMemberProfileByEmail(memberProfiles),
    [memberProfiles],
  );

  const [createRental, { isLoading: creatingRental }] =
    useCreatePremiseRentalMutation();
  const [createAgreement] = useCreatePremiseRentalAgreementMutation();
  const [generateAgreement] = useGeneratePremiseRentalAgreementMutation();
  const [updateRentalPayment] = useUpdatePremiseRentalPaymentMutation();
  const [updateRentalStatus] = useUpdatePremiseRentalStatusMutation();
  const [uploadAgreement] = useUploadPremiseRentalAgreementMutation();
  const [updateSlot, { isLoading: updatingSlot }] =
    useUpdatePremiseSlotMutation();
  const [deleteSlot] = useDeletePremiseSlotMutation();
  const [updatePremise, { isLoading: updatingPremise }] =
    useUpdatePremiseMutation();
  const [deletePremise, { isLoading: deletingPremise }] =
    useDeletePremiseMutation();
  const [addMember, { isLoading: addingMember }] =
    useAddPremiseMemberMutation();
  const [updateMember] = useUpdatePremiseMemberMutation();
  const [removeMember] = useRemovePremiseMemberMutation();

  const slots = slotsData?.slots ?? [];
  const canManagePremise = premise?.canManage ?? false;
  const bookingActors = premise?.bookingActors ?? [];

  return {
    premiseId,
    theaterId,
    studioId,
    premisesPath,
    accessToken,
    myProfile,
    userEmail,
    activeTab,
    setActiveTab,
    calendarState,
    setCalendarState,
    selectedDate,
    premise,
    premiseLoading,
    premiseError,
    slots,
    slotsFetching,
    membersData,
    rentalsData,
    memberProfileByEmail,
    createRental,
    creatingRental,
    createAgreement,
    generateAgreement,
    updateRentalPayment,
    updateRentalStatus,
    uploadAgreement,
    updateSlot,
    updatingSlot,
    deleteSlot,
    updatePremise,
    updatingPremise,
    deletePremise,
    deletingPremise,
    addMember,
    addingMember,
    updateMember,
    removeMember,
    canManagePremise,
    bookingActors,
  };
}

export type PremiseDetailData = ReturnType<typeof usePremiseDetailData>;
