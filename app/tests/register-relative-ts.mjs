import { register } from "node:module";

register(new URL("./relative-ts-hooks.mjs", import.meta.url));
