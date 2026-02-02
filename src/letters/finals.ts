import { finalMemOp } from "./finalMem";
import { finalNunOp } from "./finalNun";
import { kafOp, peOp, tsadiOp } from "./basic";
import { LetterOp } from "./types";

export const finalsMap: Record<string, LetterOp> = {
  "ך": kafOp,
  "ם": finalMemOp,
  "ן": finalNunOp,
  "ף": peOp,
  "ץ": tsadiOp
};
