export const GID_PATTERN = "^.+#g:[0-9]+$";
export const GAPID_PATTERN = "^.+#gap:[0-9]+$";

export type RefKey = string;
export type Gid = `${string}#g:${number}`;
export type Gapid = `${string}#gap:${number}`;
