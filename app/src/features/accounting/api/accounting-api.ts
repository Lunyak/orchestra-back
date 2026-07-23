import { orchestraApi } from "../../../shared/api/rtk/orchestra-api";
import type {
  CollectionContributionItem,
  CollectionDetail,
  CollectionsListResponse,
  CreateCollectionPayload,
  CreateContributionPayload,
  RemindDebtorsResponse,
  SetCollectionParticipantsPayload,
  SetCollectionTariffPayload,
  UpdateCollectionPayload,
} from "../../../sync/api/accounting";

export const accountingApi = orchestraApi.injectEndpoints({
  endpoints: (build) => ({
    listCollections: build.query<CollectionsListResponse, void>({
      query: () => ({ url: "/accounting/collections" }),
      providesTags: ["AccountingCollections"],
    }),

    getCollection: build.query<CollectionDetail, string>({
      query: (id) => ({
        url: `/accounting/collections/${encodeURIComponent(id)}`,
      }),
      providesTags: (_r, _e, id) => [
        { type: "AccountingCollections", id },
        { type: "AccountingContributions", id },
      ],
    }),

    createCollection: build.mutation<CollectionDetail, CreateCollectionPayload>({
      query: (body) => ({
        url: "/accounting/collections",
        method: "POST",
        data: body,
      }),
      invalidatesTags: ["AccountingCollections"],
    }),

    updateCollection: build.mutation<
      CollectionDetail,
      { id: string; body: UpdateCollectionPayload }
    >({
      query: ({ id, body }) => ({
        url: `/accounting/collections/${encodeURIComponent(id)}`,
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        "AccountingCollections",
        { type: "AccountingCollections", id },
      ],
    }),

    deleteCollection: build.mutation<{ ok: true }, string>({
      query: (id) => ({
        url: `/accounting/collections/${encodeURIComponent(id)}`,
        method: "DELETE",
      }),
      invalidatesTags: ["AccountingCollections"],
    }),

    setCollectionTariffs: build.mutation<
      CollectionDetail,
      { id: string; tariffs: SetCollectionTariffPayload[] }
    >({
      query: ({ id, tariffs }) => ({
        url: `/accounting/collections/${encodeURIComponent(id)}/tariffs`,
        method: "PUT",
        data: { tariffs },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        "AccountingCollections",
        { type: "AccountingCollections", id },
      ],
    }),

    setCollectionParticipants: build.mutation<
      CollectionDetail,
      { id: string; participants: SetCollectionParticipantsPayload[] }
    >({
      query: ({ id, participants }) => ({
        url: `/accounting/collections/${encodeURIComponent(id)}/participants`,
        method: "PUT",
        data: { participants },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        "AccountingCollections",
        { type: "AccountingCollections", id },
      ],
    }),

    addContribution: build.mutation<
      CollectionContributionItem,
      { collectionId: string; body: CreateContributionPayload }
    >({
      query: ({ collectionId, body }) => ({
        url: `/accounting/collections/${encodeURIComponent(collectionId)}/contributions`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_r, _e, { collectionId }) => [
        "AccountingCollections",
        { type: "AccountingCollections", id: collectionId },
        { type: "AccountingContributions", id: collectionId },
      ],
    }),

    removeContribution: build.mutation<
      { ok: true },
      { collectionId: string; contributionId: string }
    >({
      query: ({ collectionId, contributionId }) => ({
        url: `/accounting/collections/${encodeURIComponent(collectionId)}/contributions/${encodeURIComponent(contributionId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { collectionId }) => [
        "AccountingCollections",
        { type: "AccountingCollections", id: collectionId },
        { type: "AccountingContributions", id: collectionId },
      ],
    }),

    remindDebtors: build.mutation<RemindDebtorsResponse, string>({
      query: (collectionId) => ({
        url: `/accounting/collections/${encodeURIComponent(collectionId)}/remind`,
        method: "POST",
      }),
    }),
  }),
});

export const {
  useListCollectionsQuery,
  useGetCollectionQuery,
  useCreateCollectionMutation,
  useUpdateCollectionMutation,
  useDeleteCollectionMutation,
  useSetCollectionTariffsMutation,
  useSetCollectionParticipantsMutation,
  useAddContributionMutation,
  useRemoveContributionMutation,
  useRemindDebtorsMutation,
} = accountingApi;
