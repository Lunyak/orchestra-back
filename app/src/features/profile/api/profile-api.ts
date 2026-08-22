import { orchestraApi } from "../../../shared/api/rtk/orchestra-api";
import type { MyProfile, TeamProfile } from "../../../sync/api/profile";

export const profileApi = orchestraApi.injectEndpoints({
  endpoints: (build) => ({
    myProfile: build.query<MyProfile, void>({
      query: () => ({ url: "/profile" }),
      providesTags: [{ type: "Profile", id: "ME" }],
    }),
    profilesBatch: build.query<TeamProfile[], string[]>({
      query: (emails) => ({
        url: "/profile/batch",
        method: "POST",
        data: { emails },
      }),
      providesTags: (_result, _err, emails) => [
        { type: "ProfileBatch", id: emails.slice().sort().join(",") },
      ],
    }),
    updateMyProfile: build.mutation<MyProfile, Partial<MyProfile>>({
      query: (patch) => ({ url: "/profile", method: "PATCH", data: patch }),
      invalidatesTags: [{ type: "Profile", id: "ME" }],
    }),
    uploadMyAvatar: build.mutation<MyProfile, { file: File; variant?: "full" | "small" }>({
      query: ({ file, variant = "full" }) => {
        const form = new FormData();
        form.append("file", file, file.name);
        const query = variant === "small" ? "?variant=small" : "";
        return { url: `/profile/avatar${query}`, method: "POST", data: form };
      },
      invalidatesTags: [{ type: "Profile", id: "ME" }],
    }),
    deleteMyProfile: build.mutation<{ ok: boolean; deleted?: number }, void>({
      query: () => ({ url: "/profile", method: "DELETE" }),
      invalidatesTags: [{ type: "Profile", id: "ME" }],
    }),
  }),
});

export const {
  useMyProfileQuery,
  useProfilesBatchQuery,
  useUpdateMyProfileMutation,
  useUploadMyAvatarMutation,
  useDeleteMyProfileMutation,
} = profileApi;
