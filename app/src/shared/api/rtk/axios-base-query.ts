import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import type { AxiosError, AxiosRequestConfig } from "axios";
import { api } from "../../../sync/api/client";
import { getAccessToken } from "../authenticated";

export type OrchestraQueryArgs = {
  url: string;
  method?: AxiosRequestConfig["method"];
  data?: unknown;
  params?: unknown;
};

export type OrchestraQueryError = {
  status?: number;
  data?: unknown;
  message?: string;
};

/** Общий baseQuery: токен из Redux/localStorage, без проброса accessToken в каждый вызов. */
export const axiosBaseQuery: BaseQueryFn<
  OrchestraQueryArgs,
  unknown,
  OrchestraQueryError
> = async ({ url, method = "GET", data, params }) => {
  try {
    const token = getAccessToken();
    const result = await api({
      url,
      method,
      data,
      params,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return { data: result.data };
  } catch (error) {
    const err = error as AxiosError;
    return {
      error: {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      },
    };
  }
};
