import type { Construction } from "../shapeTypes";
import type { OpContext } from "./helpers";
import { applyAleph } from "./aleph";
import { applyBet } from "./bet";
import { applyDalet } from "./dalet";
import { applyLamed } from "./lamed";
import { applyMem } from "./mem";
import { applyFinalMem } from "./finalMem";
import { applyResh } from "./resh";
import { applyTav } from "./tav";
import { applyFallback } from "./fallback";

const ops: Record<string, (construction: Construction, ctx: OpContext) => void> = {
  "א": applyAleph,
  "ב": applyBet,
  "ד": applyDalet,
  "ל": applyLamed,
  "מ": applyMem,
  "ם": applyFinalMem,
  "ר": applyResh,
  "ת": applyTav
};

export function applyLetter(construction: Construction, ctx: OpContext): void {
  const op = ops[ctx.letter] ?? applyFallback;
  op(construction, ctx);
}
