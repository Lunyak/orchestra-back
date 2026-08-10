import { orchestraApi } from "../../../shared/api/rtk/orchestra-api";
import type {
  AddPremiseMemberPayload,
  CreatePremisePayload,
  CreatePremiseRentalPayload,
  CreatePremiseSlotPayload,
  PremiseMembersResponse,
  PremiseRentalItem,
  PremiseRentalsResponse,
  PremiseSlotsResponse,
  PremiseSummary,
  PremisesListResponse,
  PremiseMemberItem,
  PremiseSlotItem,
  UpdatePremiseMemberPayload,
  UpdatePremisePayload,
  UpdatePremiseSlotPayload,
} from "../../../sync/api/premises";

export const premisesApi = orchestraApi.injectEndpoints({
  endpoints: (build) => ({
    listPremises: build.query<
      PremisesListResponse,
      { theaterId?: string; studioId?: string } | void
    >({
      query: (organization) => ({
        url: "/premises",
        params: organization ?? undefined,
      }),
      providesTags: ["Premises"],
    }),

    getPremise: build.query<PremiseSummary, string>({
      query: (id) => ({ url: `/premises/${encodeURIComponent(id)}` }),
      providesTags: (_r, _e, id) => [{ type: "Premises", id }],
    }),

    createPremise: build.mutation<PremiseSummary, CreatePremisePayload>({
      query: (body) => ({
        url: "/premises",
        method: "POST",
        data: body,
      }),
      invalidatesTags: ["Premises"],
    }),

    updatePremise: build.mutation<
      PremiseSummary,
      { id: string; body: UpdatePremisePayload }
    >({
      query: ({ id, body }) => ({
        url: `/premises/${encodeURIComponent(id)}`,
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        "Premises",
        { type: "Premises", id },
      ],
    }),

    deletePremise: build.mutation<{ ok: true }, string>({
      query: (id) => ({
        url: `/premises/${encodeURIComponent(id)}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Premises"],
    }),

    listPremiseRentals: build.query<PremiseRentalsResponse, string>({
      query: (premiseId) => ({
        url: `/premises/${encodeURIComponent(premiseId)}/rentals`,
      }),
      providesTags: (_r, _e, premiseId) => [
        { type: "PremiseSlots", id: premiseId },
      ],
    }),

    getPremiseRental: build.query<
      PremiseRentalItem,
      { premiseId: string; rentalId: string }
    >({
      query: ({ premiseId, rentalId }) => ({
        url: `/premises/${encodeURIComponent(premiseId)}/rentals/${encodeURIComponent(rentalId)}`,
      }),
      providesTags: (_r, _e, { premiseId }) => [
        { type: "PremiseSlots", id: premiseId },
      ],
    }),

    createPremiseRental: build.mutation<
      PremiseRentalItem,
      { premiseId: string; body: CreatePremiseRentalPayload }
    >({
      query: ({ premiseId, body }) => ({
        url: `/premises/${encodeURIComponent(premiseId)}/rentals`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_r, _e, { premiseId }) => [
        { type: "PremiseSlots", id: premiseId },
      ],
    }),

    generatePremiseRentalAgreement: build.mutation<
      PremiseRentalItem,
      { premiseId: string; rentalId: string }
    >({
      query: ({ premiseId, rentalId }) => ({
        url: `/premises/${encodeURIComponent(premiseId)}/rentals/${encodeURIComponent(rentalId)}/agreement/generate`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, { premiseId }) => [
        { type: "PremiseSlots", id: premiseId },
      ],
    }),

    updatePremiseRentalStatus: build.mutation<
      PremiseRentalItem,
      {
        premiseId: string;
        rentalId: string;
        status: "active" | "cancelled";
      }
    >({
      query: ({ premiseId, rentalId, status }) => ({
        url: `/premises/${encodeURIComponent(premiseId)}/rentals/${encodeURIComponent(rentalId)}/status`,
        method: "PATCH",
        data: { status },
      }),
      invalidatesTags: (_r, _e, { premiseId }) => [
        { type: "PremiseSlots", id: premiseId },
      ],
    }),

    updatePremiseRentalPayment: build.mutation<
      PremiseRentalItem,
      {
        premiseId: string;
        rentalId: string;
        paymentId: string;
        status: "unpaid" | "paid" | "waived";
      }
    >({
      query: ({ premiseId, rentalId, paymentId, status }) => ({
        url: `/premises/${encodeURIComponent(premiseId)}/rentals/${encodeURIComponent(rentalId)}/payments/${encodeURIComponent(paymentId)}`,
        method: "PATCH",
        data: { status },
      }),
      invalidatesTags: (_r, _e, { premiseId }) => [
        { type: "PremiseSlots", id: premiseId },
      ],
    }),

    uploadPremiseRentalAgreement: build.mutation<
      PremiseRentalItem,
      {
        premiseId: string;
        rentalId: string;
        kind: "uploaded" | "signed";
        file: File;
      }
    >({
      query: ({ premiseId, rentalId, kind, file }) => {
        const data = new FormData();
        data.append("file", file);
        return {
          url: `/premises/${encodeURIComponent(premiseId)}/rentals/${encodeURIComponent(rentalId)}/agreement/upload`,
          method: "POST",
          params: { kind },
          data,
        };
      },
      invalidatesTags: (_r, _e, { premiseId }) => [
        { type: "PremiseSlots", id: premiseId },
      ],
    }),

    listPremiseSlots: build.query<
      PremiseSlotsResponse,
      { premiseId: string; from?: string; to?: string }
    >({
      query: ({ premiseId, from, to }) => ({
        url: `/premises/${encodeURIComponent(premiseId)}/slots`,
        params: {
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
      }),
      providesTags: (_r, _e, { premiseId }) => [
        { type: "PremiseSlots", id: premiseId },
      ],
    }),

    createPremiseSlot: build.mutation<
      PremiseSlotItem,
      { premiseId: string; body: CreatePremiseSlotPayload }
    >({
      query: ({ premiseId, body }) => ({
        url: `/premises/${encodeURIComponent(premiseId)}/slots`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_r, _e, { premiseId }) => [
        { type: "PremiseSlots", id: premiseId },
      ],
    }),

    updatePremiseSlot: build.mutation<
      PremiseSlotItem,
      {
        premiseId: string;
        slotId: string;
        body: UpdatePremiseSlotPayload;
      }
    >({
      query: ({ premiseId, slotId, body }) => ({
        url: `/premises/${encodeURIComponent(premiseId)}/slots/${encodeURIComponent(slotId)}`,
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: (_r, _e, { premiseId }) => [
        { type: "PremiseSlots", id: premiseId },
      ],
    }),

    deletePremiseSlot: build.mutation<
      { ok: true },
      { premiseId: string; slotId: string }
    >({
      query: ({ premiseId, slotId }) => ({
        url: `/premises/${encodeURIComponent(premiseId)}/slots/${encodeURIComponent(slotId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { premiseId }) => [
        { type: "PremiseSlots", id: premiseId },
      ],
    }),

    listPremiseMembers: build.query<PremiseMembersResponse, string>({
      query: (premiseId) => ({
        url: `/premises/${encodeURIComponent(premiseId)}/members`,
      }),
      providesTags: (_r, _e, premiseId) => [
        { type: "PremiseMembers", id: premiseId },
      ],
    }),

    addPremiseMember: build.mutation<
      PremiseMemberItem,
      { premiseId: string; body: AddPremiseMemberPayload }
    >({
      query: ({ premiseId, body }) => ({
        url: `/premises/${encodeURIComponent(premiseId)}/members`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_r, _e, { premiseId }) => [
        { type: "PremiseMembers", id: premiseId },
        { type: "Premises", id: premiseId },
        "Premises",
      ],
    }),

    updatePremiseMember: build.mutation<
      PremiseMemberItem,
      {
        premiseId: string;
        memberId: string;
        body: UpdatePremiseMemberPayload;
      }
    >({
      query: ({ premiseId, memberId, body }) => ({
        url: `/premises/${encodeURIComponent(premiseId)}/members/${encodeURIComponent(memberId)}`,
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: (_r, _e, { premiseId }) => [
        { type: "PremiseMembers", id: premiseId },
        { type: "Premises", id: premiseId },
        "Premises",
      ],
    }),

    removePremiseMember: build.mutation<
      { ok: true },
      { premiseId: string; memberId: string }
    >({
      query: ({ premiseId, memberId }) => ({
        url: `/premises/${encodeURIComponent(premiseId)}/members/${encodeURIComponent(memberId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { premiseId }) => [
        { type: "PremiseMembers", id: premiseId },
        { type: "Premises", id: premiseId },
        "Premises",
      ],
    }),
  }),
});

export const {
  useListPremisesQuery,
  useGetPremiseQuery,
  useCreatePremiseMutation,
  useUpdatePremiseMutation,
  useDeletePremiseMutation,
  useListPremiseRentalsQuery,
  useGetPremiseRentalQuery,
  useCreatePremiseRentalMutation,
  useGeneratePremiseRentalAgreementMutation,
  useUpdatePremiseRentalPaymentMutation,
  useUpdatePremiseRentalStatusMutation,
  useUploadPremiseRentalAgreementMutation,
  useListPremiseSlotsQuery,
  useCreatePremiseSlotMutation,
  useUpdatePremiseSlotMutation,
  useDeletePremiseSlotMutation,
  useListPremiseMembersQuery,
  useAddPremiseMemberMutation,
  useUpdatePremiseMemberMutation,
  useRemovePremiseMemberMutation,
} = premisesApi;
