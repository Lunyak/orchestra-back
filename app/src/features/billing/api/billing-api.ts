import { orchestraApi } from "../../../shared/api/rtk/orchestra-api";

export type BillingPlan = {
  id: string;
  name: string;
  title: string;
  maxProjects: number | null;
  maxCollaboratorsPerProject: number | null;
  priceRub: number | null;
};

export type BillingMe = {
  email: string;
  projectsUsed: number;
  checkoutEnabled: boolean;
  plan: BillingPlan | null;
};

export type UpgradeRequestResult = {
  ok: boolean;
  queued: boolean;
  message: string;
};

export type CheckoutResult = {
  confirmationUrl: string;
  paymentId: string;
};

export const billingApi = orchestraApi.injectEndpoints({
  endpoints: (build) => ({
    listBillingPlans: build.query<BillingPlan[], void>({
      query: () => ({ url: "/billing/plans" }),
      providesTags: ["Billing"],
    }),
    getMyBilling: build.query<BillingMe, void>({
      query: () => ({ url: "/billing/me" }),
      providesTags: ["Billing"],
    }),
    createBillingCheckout: build.mutation<CheckoutResult, { planName: string }>({
      query: (body) => ({
        url: "/billing/checkout",
        method: "POST",
        data: body,
      }),
    }),
    requestBillingUpgrade: build.mutation<
      UpgradeRequestResult,
      { planName: string; message?: string }
    >({
      query: (body) => ({
        url: "/billing/upgrade-request",
        method: "POST",
        data: body,
      }),
    }),
  }),
});

export const {
  useListBillingPlansQuery,
  useGetMyBillingQuery,
  useCreateBillingCheckoutMutation,
  useRequestBillingUpgradeMutation,
} = billingApi;
