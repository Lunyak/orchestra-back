import { orchestraApi } from "../../../shared/api/rtk/orchestra-api";
import type {
  AddPremiseMemberPayload,
  CreatePremisePayload,
  CreatePremiseSlotPayload,
  PremiseMembersResponse,
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
    listPremises: build.query<PremisesListResponse, void>({
      query: () => ({ url: "/premises" }),
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
  useListPremiseSlotsQuery,
  useCreatePremiseSlotMutation,
  useUpdatePremiseSlotMutation,
  useDeletePremiseSlotMutation,
  useListPremiseMembersQuery,
  useAddPremiseMemberMutation,
  useUpdatePremiseMemberMutation,
  useRemovePremiseMemberMutation,
} = premisesApi;
