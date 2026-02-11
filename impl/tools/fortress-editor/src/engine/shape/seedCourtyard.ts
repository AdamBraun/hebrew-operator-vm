import type { Construction, Vec2 } from "./shapeTypes";
import { DEFAULT_UNIT } from "./shapeTypes";
import { addAnchor, addRegion, addStroke, setAnchor } from "./shapeUtils";

function rectPoints(center: Vec2, width: number, height: number): Vec2[] {
  const halfW = width / 2;
  const halfH = height / 2;
  return [
    { x: center.x - halfW, y: center.y - halfH },
    { x: center.x + halfW, y: center.y - halfH },
    { x: center.x + halfW, y: center.y + halfH },
    { x: center.x - halfW, y: center.y + halfH },
    { x: center.x - halfW, y: center.y - halfH }
  ];
}

function addRegionBox(
  construction: Construction,
  id: string,
  center: Vec2,
  width: number,
  height: number,
  tags: string[]
): void {
  const strokeId = `${id}_boundary`;
  addStroke(construction, {
    id: strokeId,
    kind: "polyline",
    points: rectPoints(center, width, height),
    weight: 0,
    tags: [...tags, "REGION_ONLY"]
  });
  addRegion(construction, {
    id,
    kind: "container",
    boundaryStrokeIds: [strokeId],
    tags
  });
}

export function seedCourtyard(construction: Construction): void {
  const unit = DEFAULT_UNIT;
  const courtyard = { x: 0, y: 0 };
  const courtyardW = unit * 2.6;
  const courtyardH = unit * 2.0;

  const houseW = unit * 1.6;
  const houseH = unit * 1.2;
  const gap = unit * 0.35;

  const houseLeft = { x: courtyard.x - courtyardW / 2 - houseW / 2 - gap, y: courtyard.y };
  const houseRight = { x: courtyard.x + courtyardW / 2 + houseW / 2 + gap, y: courtyard.y };
  const houseBottom = { x: courtyard.x, y: courtyard.y + courtyardH / 2 + houseH / 2 + gap };

  addRegionBox(construction, "seed_courtyard", courtyard, courtyardW, courtyardH, [
    "SEED",
    "COURTYARD",
    "SOFT"
  ]);

  addRegionBox(construction, "seed_house_1", houseLeft, houseW, houseH, [
    "SEED",
    "HOUSE",
    "HARD"
  ]);
  addRegionBox(construction, "seed_house_2", houseRight, houseW, houseH, [
    "SEED",
    "HOUSE",
    "HARD"
  ]);
  addRegionBox(construction, "seed_house_3", houseBottom, houseW, houseH, [
    "SEED",
    "HOUSE",
    "HARD"
  ]);

  addAnchor(construction, { id: "COURT", p: courtyard, role: "pivot", tags: ["SEED"] });
  addAnchor(construction, { id: "H1", p: houseLeft, role: "entry", tags: ["SEED"] });
  addAnchor(construction, { id: "H2", p: houseRight, role: "entry", tags: ["SEED"] });
  addAnchor(construction, { id: "H3", p: houseBottom, role: "entry", tags: ["SEED"] });

  setAnchor(construction, "F", courtyard, "entry", ["FOCUS", "SEED"]);
}
