import { groupBy } from "../stats";
import { parseRefKey, type Summary } from "../model";

type CarryField = "omega" | "focus" | "domain";
type CarryDirection = "carryIn" | "carryOut";

export type ContinuityMismatch = {
  field: CarryField;
  prevSequence: number;
  sequence: number;
  prevRefKey: string;
  refKey: string;
  expected: string | null;
  observed: string | null;
  message: string;
};

export type MismatchBurst = {
  field: CarryField;
  startSequence: number;
  endSequence: number;
  startRefKey: string;
  endRefKey: string;
  length: number;
};

export type ModeComplianceViolation = {
  sequence: number;
  refKey: string;
  direction: CarryDirection;
  field: Exclude<CarryField, "omega">;
  expected: null;
  observed: string;
};

export type ContinuityReport = {
  mode: string;
  source: Summary["continuity"];
  transitionCount: number;
  rates: Record<CarryField, { matches: number; mismatches: number; rate: number | null }>;
  mismatches: {
    omega: ContinuityMismatch[];
    focus: ContinuityMismatch[];
    domain: ContinuityMismatch[];
    all: ContinuityMismatch[];
    counts: Record<CarryField | "total", number>;
  };
  bursts: {
    omega: MismatchBurst[];
    focus: MismatchBurst[];
    domain: MismatchBurst[];
    all: MismatchBurst[];
    longestByField: Record<CarryField, number>;
  };
  nullCarry: {
    carryIn: { omega: number; focus: number; domain: number; pinnedEmpty: number };
    carryOut: { omega: number; focus: number; domain: number; pinnedEmpty: number };
  };
  modeCompliance: {
    mode: string;
    unknownMode: boolean;
    expectedNull: { focus: boolean; domain: boolean };
    violations: ModeComplianceViolation[];
    counts: {
      total: number;
      focus: number;
      domain: number;
      byDirection: { carryIn: number; carryOut: number };
    };
    compliant: boolean;
  };
  clustering: {
    byBookChapter: Array<{
      key: string;
      book: string;
      chapter: number;
      omega: number;
      focus: number;
      domain: number;
      total: number;
    }>;
  };
  consistency: {
    matchesSummary: boolean;
    differences: string[];
  };
};

type ModeExpectation = {
  focusShouldBeNull: boolean;
  domainShouldBeNull: boolean;
};

const MODE_EXPECTATIONS: Record<string, ModeExpectation> = {
  reset: {
    focusShouldBeNull: true,
    domainShouldBeNull: true
  },
  carry_omega: {
    focusShouldBeNull: true,
    domainShouldBeNull: true
  },
  carry_omega_focus: {
    focusShouldBeNull: false,
    domainShouldBeNull: true
  },
  carry_omega_focus_domain: {
    focusShouldBeNull: false,
    domainShouldBeNull: false
  }
};

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function compareMismatch(left: ContinuityMismatch, right: ContinuityMismatch): number {
  if (left.sequence !== right.sequence) {
    return left.sequence - right.sequence;
  }
  if (left.prevSequence !== right.prevSequence) {
    return left.prevSequence - right.prevSequence;
  }
  if (left.field !== right.field) {
    return compareText(left.field, right.field);
  }
  return compareText(left.refKey, right.refKey);
}

function buildMismatchBursts(
  field: CarryField,
  mismatches: readonly ContinuityMismatch[]
): MismatchBurst[] {
  if (mismatches.length === 0) {
    return [];
  }
  const sorted = [...mismatches].sort(compareMismatch);
  const out: MismatchBurst[] = [];
  let start = sorted[0];
  let previous = sorted[0];

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    if (current.sequence === previous.sequence + 1) {
      previous = current;
      continue;
    }

    out.push({
      field,
      startSequence: start.sequence,
      endSequence: previous.sequence,
      startRefKey: start.refKey,
      endRefKey: previous.refKey,
      length: previous.sequence - start.sequence + 1
    });

    start = current;
    previous = current;
  }

  out.push({
    field,
    startSequence: start.sequence,
    endSequence: previous.sequence,
    startRefKey: start.refKey,
    endRefKey: previous.refKey,
    length: previous.sequence - start.sequence + 1
  });

  return out;
}

function mismatchMessage(entry: {
  prevRefKey: string;
  refKey: string;
  expected: string | null;
  observed: string | null;
}): string {
  return `${entry.prevRefKey} -> ${entry.refKey}: expected ${String(entry.expected)}, got ${String(
    entry.observed
  )}`;
}

function parseBookChapter(refKey: string): { key: string; book: string; chapter: number } {
  try {
    const ref = parseRefKey(refKey);
    return {
      key: `${ref.book}/${ref.chapter}`,
      book: ref.book,
      chapter: ref.chapter
    };
  } catch {
    return {
      key: "unknown/0",
      book: "unknown",
      chapter: 0
    };
  }
}

function compareBookChapter(
  left: { book: string; chapter: number; key: string },
  right: { book: string; chapter: number; key: string }
): number {
  if (left.book !== right.book) {
    return compareText(left.book, right.book);
  }
  if (left.chapter !== right.chapter) {
    return left.chapter - right.chapter;
  }
  return compareText(left.key, right.key);
}

function modeExpectation(mode: string): {
  unknownMode: boolean;
  expectedNull: { focus: boolean; domain: boolean };
} {
  const expectation = MODE_EXPECTATIONS[mode];
  if (!expectation) {
    return {
      unknownMode: true,
      expectedNull: {
        focus: false,
        domain: false
      }
    };
  }
  return {
    unknownMode: false,
    expectedNull: {
      focus: expectation.focusShouldBeNull,
      domain: expectation.domainShouldBeNull
    }
  };
}

export function extractContinuity(summary: Summary): ContinuityReport {
  const mismatchesByField: Record<CarryField, ContinuityMismatch[]> = {
    omega: [],
    focus: [],
    domain: []
  };

  const verses = summary.verses;
  const transitionCount = Math.max(0, verses.length - 1);

  for (let index = 1; index < verses.length; index += 1) {
    const prev = verses[index - 1];
    const current = verses[index];
    const comparisons: Array<{
      field: CarryField;
      expected: string | null;
      observed: string | null;
    }> = [
      {
        field: "omega",
        expected: prev.carryOut.omega,
        observed: current.carryIn.omega
      },
      {
        field: "focus",
        expected: prev.carryOut.focus,
        observed: current.carryIn.focus
      },
      {
        field: "domain",
        expected: prev.carryOut.domain,
        observed: current.carryIn.domain
      }
    ];

    for (const comparison of comparisons) {
      if (comparison.expected === comparison.observed) {
        continue;
      }
      const mismatch: ContinuityMismatch = {
        field: comparison.field,
        prevSequence: prev.sequence,
        sequence: current.sequence,
        prevRefKey: prev.ref_key,
        refKey: current.ref_key,
        expected: comparison.expected,
        observed: comparison.observed,
        message: mismatchMessage({
          prevRefKey: prev.ref_key,
          refKey: current.ref_key,
          expected: comparison.expected,
          observed: comparison.observed
        })
      };
      mismatchesByField[comparison.field].push(mismatch);
    }
  }

  for (const field of ["omega", "focus", "domain"] as const) {
    mismatchesByField[field].sort(compareMismatch);
  }
  const allMismatches = [
    ...mismatchesByField.omega,
    ...mismatchesByField.focus,
    ...mismatchesByField.domain
  ].sort(compareMismatch);

  const mismatchCounts = {
    omega: mismatchesByField.omega.length,
    focus: mismatchesByField.focus.length,
    domain: mismatchesByField.domain.length,
    total: allMismatches.length
  };

  const rates: ContinuityReport["rates"] = {
    omega: {
      matches: Math.max(0, transitionCount - mismatchCounts.omega),
      mismatches: mismatchCounts.omega,
      rate: transitionCount > 0 ? (transitionCount - mismatchCounts.omega) / transitionCount : null
    },
    focus: {
      matches: Math.max(0, transitionCount - mismatchCounts.focus),
      mismatches: mismatchCounts.focus,
      rate: transitionCount > 0 ? (transitionCount - mismatchCounts.focus) / transitionCount : null
    },
    domain: {
      matches: Math.max(0, transitionCount - mismatchCounts.domain),
      mismatches: mismatchCounts.domain,
      rate: transitionCount > 0 ? (transitionCount - mismatchCounts.domain) / transitionCount : null
    }
  };

  const burstsByField = {
    omega: buildMismatchBursts("omega", mismatchesByField.omega),
    focus: buildMismatchBursts("focus", mismatchesByField.focus),
    domain: buildMismatchBursts("domain", mismatchesByField.domain)
  };
  const allBursts = [...burstsByField.omega, ...burstsByField.focus, ...burstsByField.domain].sort(
    (left, right) =>
      left.startSequence - right.startSequence ||
      compareText(left.field, right.field) ||
      compareText(left.startRefKey, right.startRefKey)
  );

  const nullCarry: ContinuityReport["nullCarry"] = {
    carryIn: { omega: 0, focus: 0, domain: 0, pinnedEmpty: 0 },
    carryOut: { omega: 0, focus: 0, domain: 0, pinnedEmpty: 0 }
  };
  for (const row of verses) {
    if (row.carryIn.omega === null) {
      nullCarry.carryIn.omega += 1;
    }
    if (row.carryIn.focus === null) {
      nullCarry.carryIn.focus += 1;
    }
    if (row.carryIn.domain === null) {
      nullCarry.carryIn.domain += 1;
    }
    if (row.carryIn.pinned.length === 0) {
      nullCarry.carryIn.pinnedEmpty += 1;
    }

    if (row.carryOut.omega === null) {
      nullCarry.carryOut.omega += 1;
    }
    if (row.carryOut.focus === null) {
      nullCarry.carryOut.focus += 1;
    }
    if (row.carryOut.domain === null) {
      nullCarry.carryOut.domain += 1;
    }
    if (row.carryOut.pinned.length === 0) {
      nullCarry.carryOut.pinnedEmpty += 1;
    }
  }

  const expectation = modeExpectation(summary.mode);
  const violations: ModeComplianceViolation[] = [];
  for (const row of verses) {
    if (expectation.expectedNull.focus) {
      if (row.carryIn.focus !== null) {
        violations.push({
          sequence: row.sequence,
          refKey: row.ref_key,
          direction: "carryIn",
          field: "focus",
          expected: null,
          observed: row.carryIn.focus
        });
      }
      if (row.carryOut.focus !== null) {
        violations.push({
          sequence: row.sequence,
          refKey: row.ref_key,
          direction: "carryOut",
          field: "focus",
          expected: null,
          observed: row.carryOut.focus
        });
      }
    }
    if (expectation.expectedNull.domain) {
      if (row.carryIn.domain !== null) {
        violations.push({
          sequence: row.sequence,
          refKey: row.ref_key,
          direction: "carryIn",
          field: "domain",
          expected: null,
          observed: row.carryIn.domain
        });
      }
      if (row.carryOut.domain !== null) {
        violations.push({
          sequence: row.sequence,
          refKey: row.ref_key,
          direction: "carryOut",
          field: "domain",
          expected: null,
          observed: row.carryOut.domain
        });
      }
    }
  }
  violations.sort(
    (left, right) =>
      left.sequence - right.sequence ||
      compareText(left.direction, right.direction) ||
      compareText(left.field, right.field) ||
      compareText(left.refKey, right.refKey)
  );

  const grouped = groupBy(allMismatches, (row) => parseBookChapter(row.refKey).key);
  const byBookChapter = Array.from(grouped.entries())
    .map(([key, rows]) => {
      const info = parseBookChapter(rows[0]?.refKey ?? key);
      const omega = rows.filter((row) => row.field === "omega").length;
      const focus = rows.filter((row) => row.field === "focus").length;
      const domain = rows.filter((row) => row.field === "domain").length;
      return {
        key: info.key,
        book: info.book,
        chapter: info.chapter,
        omega,
        focus,
        domain,
        total: rows.length
      };
    })
    .sort(compareBookChapter);

  const differences: string[] = [];
  if (summary.continuity.expectedTransitions !== transitionCount) {
    differences.push(
      `expectedTransitions summary=${summary.continuity.expectedTransitions} derived=${transitionCount}`
    );
  }
  if (summary.continuity.omegaMatches !== rates.omega.matches) {
    differences.push(
      `omegaMatches summary=${summary.continuity.omegaMatches} derived=${rates.omega.matches}`
    );
  }
  if (summary.continuity.focusMatches !== rates.focus.matches) {
    differences.push(
      `focusMatches summary=${summary.continuity.focusMatches} derived=${rates.focus.matches}`
    );
  }
  if (summary.continuity.domainMatches !== rates.domain.matches) {
    differences.push(
      `domainMatches summary=${summary.continuity.domainMatches} derived=${rates.domain.matches}`
    );
  }
  if (summary.continuity.mismatches.omega.length !== mismatchCounts.omega) {
    differences.push(
      `omegaMismatchCount summary=${summary.continuity.mismatches.omega.length} derived=${mismatchCounts.omega}`
    );
  }
  if (summary.continuity.mismatches.focus.length !== mismatchCounts.focus) {
    differences.push(
      `focusMismatchCount summary=${summary.continuity.mismatches.focus.length} derived=${mismatchCounts.focus}`
    );
  }
  if (summary.continuity.mismatches.domain.length !== mismatchCounts.domain) {
    differences.push(
      `domainMismatchCount summary=${summary.continuity.mismatches.domain.length} derived=${mismatchCounts.domain}`
    );
  }

  return {
    mode: summary.mode,
    source: summary.continuity,
    transitionCount,
    rates,
    mismatches: {
      omega: mismatchesByField.omega,
      focus: mismatchesByField.focus,
      domain: mismatchesByField.domain,
      all: allMismatches,
      counts: mismatchCounts
    },
    bursts: {
      omega: burstsByField.omega,
      focus: burstsByField.focus,
      domain: burstsByField.domain,
      all: allBursts,
      longestByField: {
        omega: burstsByField.omega.reduce((max, burst) => Math.max(max, burst.length), 0),
        focus: burstsByField.focus.reduce((max, burst) => Math.max(max, burst.length), 0),
        domain: burstsByField.domain.reduce((max, burst) => Math.max(max, burst.length), 0)
      }
    },
    nullCarry,
    modeCompliance: {
      mode: summary.mode,
      unknownMode: expectation.unknownMode,
      expectedNull: expectation.expectedNull,
      violations,
      counts: {
        total: violations.length,
        focus: violations.filter((violation) => violation.field === "focus").length,
        domain: violations.filter((violation) => violation.field === "domain").length,
        byDirection: {
          carryIn: violations.filter((violation) => violation.direction === "carryIn").length,
          carryOut: violations.filter((violation) => violation.direction === "carryOut").length
        }
      },
      compliant: violations.length === 0
    },
    clustering: {
      byBookChapter
    },
    consistency: {
      matchesSummary: differences.length === 0,
      differences
    }
  };
}
