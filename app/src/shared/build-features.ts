/** 3D театр: только при `vite` / dev; в production-сборке (`vite build`) выключен. */
export const ENABLE_3D_THEATER = import.meta.env.DEV;

/** Страницы, которые пока не готовы к production. */
export const ENABLE_ACTOR_PAGE = import.meta.env.DEV;
export const ENABLE_ROLE_WORKBOOK_PAGE = import.meta.env.DEV;
export const ENABLE_PROFILE_TABS = import.meta.env.DEV;
