import "react-router-dom";

export const ROUTES = {
  HOME: "/",
  CAST: "cast",
  EVENTS: "events",
  EVENT: "events/:eventId",
  CONTACTS: "/contacts",
  ABOUTUS: "/aboutus",
} as const;

export type PathParan = {
  [ROUTES.EVENT]: {
    eventId: string;
  };
};

declare module "react-router-dom" {
  interface Register {
    params: PathParan;
  }
}
