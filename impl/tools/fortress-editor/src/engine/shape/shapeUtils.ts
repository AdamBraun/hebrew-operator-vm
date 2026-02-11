import type { Anchor, Construction, Region, Stroke, Vec2 } from "./shapeTypes";

export function extendBounds(construction: Construction, point: Vec2): void {
  const { min, max } = construction.bounds;
  construction.bounds = {
    min: { x: Math.min(min.x, point.x), y: Math.min(min.y, point.y) },
    max: { x: Math.max(max.x, point.x), y: Math.max(max.y, point.y) }
  };
}

export function addStroke(construction: Construction, stroke: Stroke): void {
  construction.strokes[stroke.id] = stroke;
  construction.order.strokes.push(stroke.id);
  stroke.points.forEach((point) => extendBounds(construction, point));
}

export function addRegion(construction: Construction, region: Region): void {
  construction.regions[region.id] = region;
  construction.order.regions.push(region.id);
}

export function addAnchor(construction: Construction, anchor: Anchor): void {
  construction.anchors[anchor.id] = anchor;
  if (!construction.order.anchors.includes(anchor.id)) {
    construction.order.anchors.push(anchor.id);
  }
  extendBounds(construction, anchor.p);
}

export function getAnchor(construction: Construction, id: string): Anchor {
  const anchor = construction.anchors[id];
  if (!anchor) {
    throw new Error(`Missing anchor ${id}`);
  }
  return anchor;
}

export function setAnchor(
  construction: Construction,
  id: string,
  point: Vec2,
  role: Anchor["role"],
  tags: string[] = []
): void {
  const anchor: Anchor = { id, p: point, role, tags };
  addAnchor(construction, anchor);
}

export function translate(point: Vec2, delta: Vec2): Vec2 {
  return { x: point.x + delta.x, y: point.y + delta.y };
}

export function midpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
