import type { Token } from "@ref/compile/types";
import { tokenize } from "../tokenize";
import { createConstruction, DEFAULT_UNIT, type Construction } from "./shapeTypes";
import { deriveModifiers } from "./niqqudModifiers";
import { applyLetter } from "./ops";
import { emitCurve, emitLine, focusPoint, setAnchor, setSpine } from "./ops/helpers";
import { seedCourtyard } from "./seedCourtyard";

function baseTags(token: Token): string[] {
  const tags = [`LETTER:${token.letter}`];
  token.diacritics.forEach((diacritic) => tags.push(`NIQQUD:${diacritic.kind}`));
  if (token.inside_dot_kind !== "none") {
    tags.push(`DOT:${token.inside_dot_kind}`);
  }
  return tags;
}

function applyFork(construction: Construction, step: number, unit: number, tags: string[]): void {
  const focus = focusPoint(construction);
  const left = { x: focus.x - unit * 0.4, y: focus.y - unit * 0.35 };
  const right = { x: focus.x - unit * 0.4, y: focus.y + unit * 0.35 };
  emitLine(construction, `fork_${step}_0`, focus, left, 1.4, [...tags, "FORK"]);
  emitLine(construction, `fork_${step}_1`, focus, right, 1.4, [...tags, "FORK"]);
}

function applyHolam(construction: Construction, step: number, unit: number, tags: string[]): void {
  const focus = focusPoint(construction);
  const center = { x: focus.x + unit * 0.2, y: focus.y - unit * 0.7 };
  const radius = unit * 0.12;
  emitCurve(
    construction,
    `holam_${step}_0`,
    [
      { x: center.x - radius, y: center.y },
      { x: center.x, y: center.y - radius },
      { x: center.x + radius, y: center.y }
    ],
    1.6,
    [...tags, "HOLAM"]
  );
  setAnchor(construction, `holam_${step}_anchor`, center, "diacritic", [...tags, "HOLAM"]);
}

export function applyWord(input: string): Construction {
  const tokens = tokenize(input);
  const letters = tokens.filter((token) => token.letter !== "□").map((token) => token.letter);
  const construction = createConstruction(input, letters);
  seedCourtyard(construction);
  let step = 0;

  tokens.forEach((token) => {
    if (token.letter === "□") {
      return;
    }

    const modifiers = deriveModifiers(token, DEFAULT_UNIT);
    const tags = [...baseTags(token), ...modifiers.tags];
    let counter = 0;
    const nextId = (prefix: string) => `${prefix}_${step}_${counter++}`;

    if (modifiers.fork) {
      applyFork(construction, step, DEFAULT_UNIT, tags);
    }
    if (modifiers.addDiacritic) {
      applyHolam(construction, step, DEFAULT_UNIT, tags);
    }

    const ctx = {
      step,
      letter: token.letter,
      unit: DEFAULT_UNIT,
      modifiers,
      nextId,
      tags
    };

    applyLetter(construction, ctx);

    if (modifiers.spineLift !== 0) {
      const focus = focusPoint(construction);
      setSpine(construction, { x: focus.x, y: focus.y + modifiers.spineLift });
    }

    step += 1;
  });

  return construction;
}
