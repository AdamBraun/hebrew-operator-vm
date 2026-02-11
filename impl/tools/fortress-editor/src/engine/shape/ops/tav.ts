import type { Construction } from "../shapeTypes";
import type { OpContext } from "./helpers";
import { applyBias, emitLine, focusPoint, setFocus, setSpine } from "./helpers";

export function applyTav(construction: Construction, ctx: OpContext): void {
  const focus = focusPoint(construction);
  const capY = focus.y - ctx.unit * 0.6;
  const left = applyBias({ x: focus.x - ctx.unit * 0.5, y: capY }, ctx.modifiers.bias);
  const right = applyBias({ x: focus.x + ctx.unit * 0.5, y: capY }, ctx.modifiers.bias);
  const down = applyBias({ x: focus.x, y: focus.y }, ctx.modifiers.bias);

  emitLine(
    construction,
    ctx.nextId("stroke"),
    left,
    right,
    2.4 * ctx.modifiers.weightMul,
    [...ctx.tags, "TAV", "CAP", ...(ctx.modifiers.seal ? ["SEALED"] : [])]
  );

  emitLine(
    construction,
    ctx.nextId("stroke"),
    { x: (left.x + right.x) / 2, y: capY },
    down,
    2.2 * ctx.modifiers.weightMul,
    [...ctx.tags, "TAV", "CAP"]
  );

  const nextFocus = { x: focus.x, y: down.y + ctx.unit * 0.2 };
  setFocus(construction, nextFocus, ["CAP"]);
  setSpine(construction, { x: nextFocus.x, y: nextFocus.y - ctx.unit * 0.5 });
}
