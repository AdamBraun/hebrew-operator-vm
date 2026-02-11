import type { Construction } from "../shapeTypes";
import type { OpContext } from "./helpers";
import { applyBias, emitLine, emitPolyline, emitRegion, focusPoint, setFocus, setSpine } from "./helpers";

export function applyDalet(construction: Construction, ctx: OpContext): void {
  const focus = focusPoint(construction);
  const width = ctx.unit * 1.05;
  const height = ctx.unit * 0.7;
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
    2.4 * ctx.modifiers.weightMul,
    [...ctx.tags, "DALET", "LAYER", "HARD"]
  );

  const hingeMid = {
    x: topRight.x,
    y: (topRight.y + bottomRight.y) / 2
  };
  const hingeOut = {
    x: topRight.x + ctx.unit * 0.2,
    y: hingeMid.y
  };

  emitLine(
    construction,
    ctx.nextId("stroke"),
    hingeMid,
    hingeOut,
    3.2 * ctx.modifiers.weightMul,
    [...ctx.tags, "DALET", "HINGE"]
  );

  const regionId = ctx.nextId("region");
  emitRegion(construction, regionId, [strokeId], [...ctx.tags, "LAYER", "HARD"]);

  const inside = { x: focus.x, y: focus.y };
  setFocus(construction, inside, ["LAYER", "HARD"]);
  setSpine(construction, { x: inside.x, y: inside.y - ctx.unit * 0.5 });
}
