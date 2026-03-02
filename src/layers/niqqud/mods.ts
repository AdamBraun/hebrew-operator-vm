import { type NiqqudClass } from "./classes";
import { type NiqqudFlags, type NiqqudMods } from "./schema";

export type BuildNiqqudModsArgs = {
  classes: string[];
};

export type BuildNiqqudModsResult = {
  mods: NiqqudMods;
  flags: Pick<NiqqudFlags, "empty" | "ambiguous">;
};

const VOWEL_LIKE_CLASS_SET = new Set<NiqqudClass>([
  "SHVA",
  "HATAF_SEGOL",
  "HATAF_PATAH",
  "HATAF_QAMATS",
  "HIRIQ",
  "TSERE",
  "SEGOL",
  "PATAH",
  "QAMATS",
  "HOLAM",
  "QUBUTS"
]);

const INCOMPATIBLE_CLASS_GROUPS: readonly (readonly NiqqudClass[])[] = [
  ["SHIN_DOT_RIGHT", "SHIN_DOT_LEFT"],
  ["DAGESH_SHURUK_DOT", "RAFE"]
] as const;

function isNiqqudClass(value: string): value is NiqqudClass {
  return (
    value === "SHVA" ||
    value === "HATAF_SEGOL" ||
    value === "HATAF_PATAH" ||
    value === "HATAF_QAMATS" ||
    value === "HIRIQ" ||
    value === "TSERE" ||
    value === "SEGOL" ||
    value === "PATAH" ||
    value === "QAMATS" ||
    value === "HOLAM" ||
    value === "QUBUTS" ||
    value === "DAGESH_SHURUK_DOT" ||
    value === "RAFE" ||
    value === "SHIN_DOT_RIGHT" ||
    value === "SHIN_DOT_LEFT"
  );
}

function hasIncompatibleCombo(classSet: Set<NiqqudClass>): boolean {
  for (const group of INCOMPATIBLE_CLASS_GROUPS) {
    let presentCount = 0;
    for (const klass of group) {
      if (classSet.has(klass)) {
        presentCount += 1;
      }
    }
    if (presentCount >= 2) {
      return true;
    }
  }
  return false;
}

export function buildNiqqudMods(args: BuildNiqqudModsArgs): BuildNiqqudModsResult {
  const classes = [...args.classes];
  const classSet = new Set<NiqqudClass>();

  for (const entry of classes) {
    if (isNiqqudClass(entry)) {
      classSet.add(entry);
    }
  }

  let vowelCount = 0;
  for (const klass of classSet) {
    if (VOWEL_LIKE_CLASS_SET.has(klass)) {
      vowelCount += 1;
    }
  }

  const ambiguousByVowelCount = vowelCount > 1;
  const ambiguousByIncompatibleCombo = hasIncompatibleCombo(classSet);

  return {
    mods: {
      classes,
      features: {
        hasDagesh: classSet.has("DAGESH_SHURUK_DOT"),
        hasShva: classSet.has("SHVA"),
        vowelCount
      }
    },
    flags: {
      empty: classes.length === 0,
      ambiguous: ambiguousByVowelCount || ambiguousByIncompatibleCombo
    }
  };
}
