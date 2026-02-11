import type { Construction } from "../shapeTypes";
import type { OpContext } from "./helpers";
import { applyBias, emitCurve, emitLine, emitPolyline, emitRegion, focusPoint, setFocus, setSpine } from "./helpers";

export function applyResh(construction: Construction, ctx: OpContext): void {
  const focus = focusPoint(construction);
  const width = ctx.unit * 1.05;
  const height = ctx.unit * 0.7;
  const halfW = width / 2;
  const halfH = height / 2;

  const topLeft = applyBias({ x: focus.x - halfW, y: focus.y - halfH }, ctx.modifiers.bias);
  const topRight = applyBias({ x: focus.x + halfW, y: focus.y - halfH }, ctx.modifiers.bias);
  const bottomRight = applyBias({ x: focus.x + halfW, y: focus.y + halfH }, ctx.modifiers.bias);
  const bottomLeft = applyBias({ x: focus.x - halfW, y: focus.y + halfH }, ctx.modifiers.bias);

  const regionStrokeId = ctx.nextId("stroke");
  emitPolyline(
    construction,
    regionStrokeId,
    [topLeft, topRight, bottomRight, bottomLeft, topLeft],
    0,
    [...ctx.tags, "RESH", "LAYER", "SOFT", "REGION_ONLY"]
  );

  emitPolyline(
    construction,
    ctx.nextId("stroke"),
    [bottomLeft, topLeft, topRight],
    2 * ctx.modifiers.weightMul,
    [...ctx.tags, "RESH", "LAYER", "SOFT"]
  );

  const control = {
    x: topRight.x + ctx.unit * 0.25,
    y: topRight.y + ctx.unit * 0.2
  };
  emitCurve(
    construction,
    ctx.nextId("stroke"),
    [topRight, control, bottomRight],
    2 * ctx.modifiers.weightMul,
    [...ctx.tags, "RESH", "LAYER", "SOFT"]
  );

  const tickStart = { x: bottomRight.x - ctx.unit * 0.05, y: bottomRight.y };
  const tickEnd = { x: bottomRight.x - ctx.unit * 0.3, y: bottomRight.y + ctx.unit * 0.05 };
  emitLine(
    construction,
    ctx.nextId("stroke"),
    tickStart,
    tickEnd,
    1.6 * ctx.modifiers.weightMul,
    [...ctx.tags, "RESH", "SOFT"]
  );

  const regionId = ctx.nextId("region");
  emitRegion(construction, regionId, [regionStrokeId], [...ctx.tags, "LAYER", "SOFT"]);

  const inside = { x: focus.x, y: focus.y };
  setFocus(construction, inside, ["LAYER", "SOFT"]);
  setSpine(construction, { x: inside.x, y: inside.y - ctx.unit * 0.45 });
}
