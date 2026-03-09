import "react-router-dom";

export const ROUTES = {
  HOME: "/",
  CAST: "cast",
  EVENTS: "events",
  EVENT: "events/:eventSlug",
  CONTACTS: "/contacts",
  ABOUTUS: "/aboutus",
} as const;

export type PathParan = {
  [ROUTES.EVENT]: {
    eventSlug: string;
  };
};

declare module "react-router-dom" {
  interface Register {
    params: PathParan;
  }
}
