/** Разделы готовы для production beta. */
export const ENABLE_3D_THEATER = true;
export const ENABLE_ACTOR_PAGE = true;
export const ENABLE_ROLE_WORKBOOK_PAGE = true;
export const ENABLE_PROFILE_TABS = true;

/** Бухгалтерия только вне production-сборки (dev / локально). */
export const ENABLE_ACCOUNTING = !import.meta.env.PROD;
