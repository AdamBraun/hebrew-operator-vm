import type { Token } from "@ref/compile/types";
import type { Vec2 } from "./shapeTypes";
import { DEFAULT_UNIT } from "./shapeTypes";

export type OpModifiers = {
  weightMul: number;
  bias: Vec2;
  fork: boolean;
  seal: boolean;
  stepScale: number;
  addDiacritic: boolean;
  spineLift: number;
  tags: string[];
};

export function deriveModifiers(token: Token, unit: number = DEFAULT_UNIT): OpModifiers {
  let weightMul = 1;
  let bias: Vec2 = { x: 0, y: 0 };
  let fork = false;
  let seal = false;
  let stepScale = 1;
  let addDiacritic = false;
  let spineLift = 0;
  const tags: string[] = [];

  if (token.inside_dot_kind === "dagesh") {
    weightMul *= 1.4;
    tags.push("DAGESH");
  }

  if (token.inside_dot_kind === "shin_dot_left") {
    bias = { x: bias.x - unit * 0.2, y: bias.y };
    tags.push("SHIN_LEFT");
  }

  if (token.inside_dot_kind === "shin_dot_right") {
    bias = { x: bias.x + unit * 0.2, y: bias.y };
    tags.push("SHIN_RIGHT");
  }

  token.diacritics.forEach((diacritic) => {
    tags.push(`NIQQUD:${diacritic.kind}`);
    switch (diacritic.kind) {
      case "patach":
        bias = { x: bias.x, y: bias.y + unit * 0.3 };
        break;
      case "kamatz":
        bias = { x: bias.x, y: bias.y - unit * 0.3 };
        seal = true;
        break;
      case "tzere":
      case "segol":
        fork = true;
        break;
      case "shva":
        stepScale *= 0.4;
        weightMul *= 0.8;
        break;
      case "holam":
        addDiacritic = true;
        spineLift -= unit * 0.35;
        break;
      case "kubutz":
        bias = { x: bias.x - unit * 0.15, y: bias.y + unit * 0.1 };
        break;
      case "hiriq":
        bias = { x: bias.x, y: bias.y + unit * 0.15 };
        break;
      default:
        break;
    }
  });

  return { weightMul, bias, fork, seal, stepScale, addDiacritic, spineLift, tags };
}
