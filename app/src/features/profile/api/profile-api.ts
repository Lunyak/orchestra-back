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
  }),
});

export const { useMyProfileQuery, useProfilesBatchQuery } = profileApi;
