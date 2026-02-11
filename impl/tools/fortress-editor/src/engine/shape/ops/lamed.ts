import type { Construction } from "../shapeTypes";
import type { OpContext } from "./helpers";
import { applyBias, emitLine, focusPoint, setFocus, setSpine } from "./helpers";

export function applyLamed(construction: Construction, ctx: OpContext): void {
  const focus = focusPoint(construction);
  const top = applyBias(
    { x: focus.x, y: focus.y - ctx.unit * 1.6 * ctx.modifiers.stepScale },
    ctx.modifiers.bias
  );
  const start = applyBias(focus, ctx.modifiers.bias);

  emitLine(
    construction,
    ctx.nextId("stroke"),
    start,
    top,
    2 * ctx.modifiers.weightMul,
    [...ctx.tags, "LAMED"]
  );

  const nextFocus = { x: top.x, y: top.y };
  setFocus(construction, nextFocus, ["REACH"]);
  setSpine(construction, { x: nextFocus.x, y: nextFocus.y - ctx.unit * 0.5 });
}
