import type { MetadataPlanIR } from "../../ir/metadata_ir";
import type { RefKey } from "../../ir/refkey";

type LookupRange = {
  start: RefKey;
  end: RefKey;
};

type LookupAliyah = {
  aliyah_index: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  range: LookupRange;
};

type LookupParasha = {
  parasha_id: string;
  range: LookupRange;
  aliyot: LookupAliyah[];
};

type NormalizedLookupInput = {
  parashot: LookupParasha[];
};

type AddLookupIndexArgs = {
  plan: MetadataPlanIR;
  refOrder: readonly RefKey[];
};

function fail(pathLabel: string, message: string): never {
  throw new Error(`metadata lookup index invalid at ${pathLabel}: ${message}`);
}

function normalizeFromPlanParashot(plan: MetadataPlanIR): NormalizedLookupInput {
  if (!Array.isArray(plan.parashot) || plan.parashot.length === 0) {
    fail(
      "$.parashot",
      "lookup index requires plan.parashot with aliyot (build metadata plan with includeParashot=true)"
    );
  }

  const parashot: LookupParasha[] = [];
  for (let i = 0; i < plan.parashot.length; i += 1) {
    const parasha = plan.parashot[i]!;
    if (!Array.isArray(parasha.aliyot) || parasha.aliyot.length === 0) {
      fail(
        `$.parashot[${String(i)}].aliyot`,
        "lookup index requires aliyot for each parasha summary"
      );
    }
    parashot.push({
      parasha_id: parasha.parasha_id,
      range: {
        start: parasha.range.start,
        end: parasha.range.end
      },
      aliyot: parasha.aliyot.map((aliyah) => ({
        aliyah_index: aliyah.aliyah_index,
        range: {
          start: aliyah.range.start,
          end: aliyah.range.end
        }
      }))
    });
  }

  return { parashot };
}

function buildRefIndex(refOrder: readonly RefKey[]): Map<RefKey, number> {
  if (refOrder.length === 0) {
    fail("$.refOrder", "expected non-empty ref order");
  }

  const indexByRef = new Map<RefKey, number>();
  for (let i = 0; i < refOrder.length; i += 1) {
    const ref = refOrder[i]!;
    if (indexByRef.has(ref)) {
      fail("$.refOrder", `duplicate ref '${ref}' at index ${String(i)}`);
    }
    indexByRef.set(ref, i);
  }
  return indexByRef;
}

function getOrdinal(
  indexByRef: ReadonlyMap<RefKey, number>,
  ref: RefKey,
  pathLabel: string
): number {
  const ordinal = indexByRef.get(ref);
  if (ordinal === undefined) {
    fail(pathLabel, `ref '${ref}' not found in ref order`);
  }
  return ordinal;
}

function sortAliyotByIndex(aliyot: readonly LookupAliyah[]): LookupAliyah[] {
  return [...aliyot].sort((left, right) => left.aliyah_index - right.aliyah_index);
}

export function addLookupIndex(args: AddLookupIndexArgs): MetadataPlanIR {
  const normalized = normalizeFromPlanParashot(args.plan);
  const refOrder = [...args.refOrder];
  const indexByRef = buildRefIndex(refOrder);

  const refToParashaByOrdinal = new Array<string | null>(refOrder.length).fill(null);
  const refToAliyahByOrdinal = new Array<1 | 2 | 3 | 4 | 5 | 6 | 7 | null>(refOrder.length).fill(
    null
  );

  for (let parashaIndex = 0; parashaIndex < normalized.parashot.length; parashaIndex += 1) {
    const parasha = normalized.parashot[parashaIndex]!;
    const parashaPath = `$.parashot[${String(parashaIndex)}]`;
    const parashaStart = getOrdinal(indexByRef, parasha.range.start, `${parashaPath}.range.start`);
    const parashaEnd = getOrdinal(indexByRef, parasha.range.end, `${parashaPath}.range.end`);
    if (parashaStart > parashaEnd) {
      fail(parashaPath, "parasha range goes backwards");
    }

    for (let ordinal = parashaStart; ordinal <= parashaEnd; ordinal += 1) {
      if (refToParashaByOrdinal[ordinal] !== null) {
        fail(
          `${parashaPath}.range`,
          `overlapping parasha range at ref '${refOrder[ordinal] ?? "?"}'`
        );
      }
      refToParashaByOrdinal[ordinal] = parasha.parasha_id;
    }

    const sortedAliyot = sortAliyotByIndex(parasha.aliyot);
    for (let aliyahIndex = 0; aliyahIndex < sortedAliyot.length; aliyahIndex += 1) {
      const aliyah = sortedAliyot[aliyahIndex]!;
      const aliyahPath = `${parashaPath}.aliyot[${String(aliyahIndex)}]`;
      const aliyahStart = getOrdinal(indexByRef, aliyah.range.start, `${aliyahPath}.range.start`);
      const aliyahEnd = getOrdinal(indexByRef, aliyah.range.end, `${aliyahPath}.range.end`);
      if (aliyahStart > aliyahEnd) {
        fail(`${aliyahPath}.range`, "aliyah range goes backwards");
      }
      if (aliyahStart < parashaStart || aliyahEnd > parashaEnd) {
        fail(`${aliyahPath}.range`, "aliyah range must be inside parasha range");
      }

      for (let ordinal = aliyahStart; ordinal <= aliyahEnd; ordinal += 1) {
        if (refToAliyahByOrdinal[ordinal] !== null) {
          fail(
            `${aliyahPath}.range`,
            `overlapping aliyah ranges at ref '${refOrder[ordinal] ?? "?"}'`
          );
        }
        refToAliyahByOrdinal[ordinal] = aliyah.aliyah_index;
      }
    }

    for (let ordinal = parashaStart; ordinal <= parashaEnd; ordinal += 1) {
      if (refToAliyahByOrdinal[ordinal] === null) {
        fail(
          `${parashaPath}.aliyot`,
          `aliyot do not fully cover parasha range at ref '${refOrder[ordinal] ?? "?"}'`
        );
      }
    }
  }

  for (let ordinal = 0; ordinal < refOrder.length; ordinal += 1) {
    if (refToParashaByOrdinal[ordinal] === null) {
      fail("$.parashot", `missing parasha coverage at ref '${refOrder[ordinal] ?? "?"}'`);
    }
    if (refToAliyahByOrdinal[ordinal] === null) {
      fail("$.parashot", `missing aliyah coverage at ref '${refOrder[ordinal] ?? "?"}'`);
    }
  }

  const ref_to_parasha: Record<string, string> = {};
  const ref_to_aliyah: Record<string, 1 | 2 | 3 | 4 | 5 | 6 | 7> = {};

  for (let ordinal = 0; ordinal < refOrder.length; ordinal += 1) {
    const ref = refOrder[ordinal]!;
    const parashaId = refToParashaByOrdinal[ordinal];
    const aliyahIndex = refToAliyahByOrdinal[ordinal];
    if (parashaId === null || aliyahIndex === null) {
      fail("$.refOrder", `lookup assignment missing at ordinal ${String(ordinal)}`);
    }
    ref_to_parasha[ref] = parashaId;
    ref_to_aliyah[ref] = aliyahIndex;
  }

  return {
    ...args.plan,
    ref_to_parasha,
    ref_to_aliyah
  };
}
