import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "./axios-base-query";
import { orchestraApiTagTypes } from "./tag-types";

/**
 * Единый API-slice для server-state.
 * Эндпоинты добавляются через injectEndpoints в features (папка api) — без новых React-контекстов.
 */
export const orchestraApi = createApi({
  reducerPath: "orchestraApi",
  baseQuery: axiosBaseQuery,
  tagTypes: [...orchestraApiTagTypes],
  endpoints: () => ({}),
});
