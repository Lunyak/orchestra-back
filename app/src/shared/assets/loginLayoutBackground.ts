import type { CSSProperties } from "react";
import loginPageBackgroundUrl from "./login-page.png";

/** URL через Vite; в CSS — фон страницы `--login-photo`. */
export const loginLayoutBackgroundStyle: CSSProperties = {
  ["--login-photo" as string]: `url(${loginPageBackgroundUrl})`,
};
