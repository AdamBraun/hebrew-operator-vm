import type { RefKey } from "./refkey";

export const GID_PATTERN = "^.+#g:[0-9]+$";
export const GAPID_PATTERN = "^.+#gap:[0-9]+$";

export type { RefKey } from "./refkey";
export type Gid = `${RefKey}#g:${number}`;
export type Gapid = `${RefKey}#gap:${number}`;
