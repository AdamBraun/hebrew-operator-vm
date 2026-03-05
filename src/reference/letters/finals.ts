import { finalKafOp } from "./finalKaf";
import { finalMemOp } from "./finalMem";
import { finalNunOp } from "./finalNun";
import { finalPeOp } from "./finalPe";
import { finalTsadiOp } from "./finalTsadi";
import { LetterOp } from "./types";

export const finalsMap: Record<string, LetterOp> = {
  ך: finalKafOp,
  ם: finalMemOp,
  ן: finalNunOp,
  ף: finalPeOp,
  ץ: finalTsadiOp
};
