import type { Construction } from "../shapeTypes";
import type { OpContext } from "./helpers";
import { applyBias, emitLine, focusPoint, setFocus, setSpine } from "./helpers";

export function applyFallback(construction: Construction, ctx: OpContext): void {
  const focus = focusPoint(construction);
  const delta = {
    x: 0,
    y: -ctx.unit * 0.25 * ctx.modifiers.stepScale
  };
  const target = applyBias({ x: focus.x + delta.x, y: focus.y + delta.y }, ctx.modifiers.bias);
  const start = applyBias(focus, ctx.modifiers.bias);

  emitLine(
    construction,
    ctx.nextId("stroke"),
    start,
    target,
    2 * ctx.modifiers.weightMul,
    [...ctx.tags, "FALLBACK"]
  );

  setFocus(construction, target, ["FLOW"]);
  setSpine(construction, { x: target.x, y: target.y - ctx.unit * 0.5 });
}
