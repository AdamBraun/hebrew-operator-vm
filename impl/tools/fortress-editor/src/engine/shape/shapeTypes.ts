export type Vec2 = { x: number; y: number };

export type Stroke = {
  id: string;
  kind: "line" | "curve" | "polyline";
  points: Vec2[];
  weight: number;
  tags: string[];
};

export type Region = {
  id: string;
  kind: "container" | "void";
  boundaryStrokeIds: string[];
  tags: string[];
};

export type Anchor = {
  id: string;
  p: Vec2;
  role: "origin" | "entry" | "exit" | "spine" | "cap" | "pivot" | "diacritic";
  tags: string[];
};

export type Construction = {
  bounds: { min: Vec2; max: Vec2 };
  anchors: Record<string, Anchor>;
  strokes: Record<string, Stroke>;
  regions: Record<string, Region>;
  order: { strokes: string[]; regions: string[]; anchors: string[] };
  meta: { word: string; letters: string[] };
};

export const DEFAULT_UNIT = 36;

export function createConstruction(word: string, letters: string[]): Construction {
  const origin = { x: 0, y: 0 };
  const spine = { x: 0, y: -DEFAULT_UNIT };

  const anchors: Record<string, Anchor> = {
    A0: { id: "A0", p: origin, role: "origin", tags: ["ANCHOR"] },
    F: { id: "F", p: origin, role: "entry", tags: ["FOCUS"] },
    S: { id: "S", p: spine, role: "spine", tags: ["SPINE"] }
  };

  return {
    bounds: { min: { ...spine }, max: { ...origin } },
    anchors,
    strokes: {},
    regions: {},
    order: { strokes: [], regions: [], anchors: ["A0", "F", "S"] },
    meta: { word, letters }
  };
}
