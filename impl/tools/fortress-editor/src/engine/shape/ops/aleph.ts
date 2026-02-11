import type { Construction } from "../shapeTypes";
import type { OpContext } from "./helpers";
import { emitLine, focusPoint, setFocus, setSpine, applyBias } from "./helpers";

export function applyAleph(construction: Construction, ctx: OpContext): void {
  const focus = focusPoint(construction);
  const span = ctx.unit * 0.6 * ctx.modifiers.stepScale;
  const center = applyBias(focus, ctx.modifiers.bias);

  const hStart = { x: center.x - span, y: center.y };
  const hEnd = { x: center.x + span, y: center.y };
  const vStart = { x: center.x, y: center.y - span };
  const vEnd = { x: center.x, y: center.y + span };

  emitLine(
    construction,
    ctx.nextId("stroke"),
    hStart,
    hEnd,
    2 * ctx.modifiers.weightMul,
    [...ctx.tags, "ALEPH"]
  );
  emitLine(
    construction,
    ctx.nextId("stroke"),
    vStart,
    vEnd,
    2 * ctx.modifiers.weightMul,
    [...ctx.tags, "ALEPH"]
  );

  const nextFocus = {
    x: center.x,
    y: center.y - ctx.unit * 0.1
  };
  setFocus(construction, nextFocus, ["PIVOT"]);
  setSpine(construction, { x: nextFocus.x, y: nextFocus.y - ctx.unit * 0.6 });
}
