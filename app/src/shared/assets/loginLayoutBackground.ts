import type { CSSProperties } from "react";
import loginPageBackgroundUrl from "./login-page.png";

/** URL обрабатывает Vite (в т.ч. base); так надёжнее, чем url() в CSS с /@fs/ и кириллицей в пути. */
export const loginLayoutBackgroundStyle: CSSProperties = {
  backgroundImage: `url(${loginPageBackgroundUrl})`,
};
