import "react-router-dom";

export const ROUTES = {
  HOME: "/",
  CAST: "cast",
  // Canonical (Russian) URLs
  EVENTS: "события",
  EVENT: "события/:eventSlug",
  ABOUTUS: "/команда",
  CONTACTS: "/контакты",
  THEATER_WALK: "/театр",

  // Legacy (English) URLs — keep working for old bookmarks/links
  LEGACY_EVENTS: "events",
  LEGACY_EVENT: "events/:eventSlug",
  LEGACY_ABOUTUS: "/aboutus",
  LEGACY_CONTACTS: "/contacts",
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
