import type { Construction } from "../shapeTypes";
import type { OpContext } from "./helpers";
import { applyBias, emitPolyline, emitRegion, focusPoint, setFocus, setSpine } from "./helpers";

export function applyBet(construction: Construction, ctx: OpContext): void {
  const focus = focusPoint(construction);
  const width = ctx.unit * 1.1;
  const height = ctx.unit * 0.9;
  const halfW = width / 2;
  const halfH = height / 2;
  const topLeft = applyBias({ x: focus.x - halfW, y: focus.y - halfH }, ctx.modifiers.bias);
  const topRight = applyBias({ x: focus.x + halfW, y: focus.y - halfH }, ctx.modifiers.bias);
  const bottomRight = applyBias({ x: focus.x + halfW, y: focus.y + halfH }, ctx.modifiers.bias);
  const bottomLeft = applyBias({ x: focus.x - halfW, y: focus.y + halfH }, ctx.modifiers.bias);

  const strokeId = ctx.nextId("stroke");
  emitPolyline(
    construction,
    strokeId,
    [topLeft, topRight, bottomRight, bottomLeft, topLeft],
    2 * ctx.modifiers.weightMul,
    [...ctx.tags, "BET", ...(ctx.modifiers.seal ? ["SEALED"] : [])]
  );

  const regionId = ctx.nextId("region");
  emitRegion(construction, regionId, [strokeId], [...ctx.tags, "INTERIOR"]);

  const inside = { x: focus.x, y: focus.y };
  setFocus(construction, inside, ["INSIDE"]);
  setSpine(construction, { x: inside.x, y: inside.y - ctx.unit * 0.6 });
}
