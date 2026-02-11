import type { Construction, Vec2 } from "../shapeTypes";
import type { OpModifiers } from "../niqqudModifiers";
import { addRegion, addStroke, getAnchor, setAnchor, translate } from "../shapeUtils";

export type OpContext = {
  step: number;
  letter: string;
  unit: number;
  modifiers: OpModifiers;
  nextId: (prefix: string) => string;
  tags: string[];
};

export function focusPoint(construction: Construction): Vec2 {
  return getAnchor(construction, "F").p;
}

export function spinePoint(construction: Construction): Vec2 {
  return getAnchor(construction, "S").p;
}

export function setFocus(construction: Construction, point: Vec2, tags: string[] = []): void {
  setAnchor(construction, "F", point, "entry", ["FOCUS", ...tags]);
}

export function setSpine(construction: Construction, point: Vec2, tags: string[] = []): void {
  setAnchor(construction, "S", point, "spine", ["SPINE", ...tags]);
}

export function emitLine(
  construction: Construction,
  id: string,
  from: Vec2,
  to: Vec2,
  weight: number,
  tags: string[]
): void {
  addStroke(construction, {
    id,
    kind: "line",
    points: [from, to],
    weight,
    tags
  });
}

export function emitPolyline(
  construction: Construction,
  id: string,
  points: Vec2[],
  weight: number,
  tags: string[]
): void {
  addStroke(construction, {
    id,
    kind: "polyline",
    points,
    weight,
    tags
  });
}

export function emitCurve(
  construction: Construction,
  id: string,
  points: Vec2[],
  weight: number,
  tags: string[]
): void {
  addStroke(construction, {
    id,
    kind: "curve",
    points,
    weight,
    tags
  });
}

export function emitRegion(
  construction: Construction,
  id: string,
  boundaryStrokeIds: string[],
  tags: string[]
): void {
  addRegion(construction, {
    id,
    kind: "container",
    boundaryStrokeIds,
    tags
  });
}

export function applyBias(point: Vec2, bias: Vec2): Vec2 {
  return translate(point, bias);
}

export { setAnchor };
