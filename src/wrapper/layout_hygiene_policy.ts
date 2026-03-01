import { type LayoutEvent, type LayoutStrength } from "../layers/layout/schema";

export type LayoutHygienePolicy = {
  flush_word_workspace: boolean;
  flush_phrase_workspace: boolean;
  flush_larger_workspace: boolean;
  strongest_flush: boolean;
};

export const LAYOUT_HYGIENE_POLICY_BY_STRENGTH: Readonly<
  Record<LayoutStrength, LayoutHygienePolicy>
> = {
  weak: {
    flush_word_workspace: true,
    flush_phrase_workspace: false,
    flush_larger_workspace: false,
    strongest_flush: false
  },
  mid: {
    flush_word_workspace: true,
    flush_phrase_workspace: true,
    flush_larger_workspace: false,
    strongest_flush: false
  },
  strong: {
    flush_word_workspace: true,
    flush_phrase_workspace: true,
    flush_larger_workspace: true,
    strongest_flush: false
  },
  max: {
    flush_word_workspace: true,
    flush_phrase_workspace: true,
    flush_larger_workspace: true,
    strongest_flush: true
  }
};

export type LayoutHygienePlan = {
  strongest_layout_strength: LayoutStrength | null;
  policy: LayoutHygienePolicy | null;
};

const STRENGTH_ORDER: Readonly<Record<LayoutStrength, number>> = {
  weak: 0,
  mid: 1,
  strong: 2,
  max: 3
};

export function strongestLayoutStrength(events: readonly LayoutEvent[]): LayoutStrength | null {
  if (events.length === 0) {
    return null;
  }

  let strongest: LayoutStrength = events[0].strength;
  for (let i = 1; i < events.length; i += 1) {
    const strength = events[i].strength;
    if (STRENGTH_ORDER[strength] > STRENGTH_ORDER[strongest]) {
      strongest = strength;
    }
  }
  return strongest;
}

export function deriveLayoutHygienePlan(events: readonly LayoutEvent[]): LayoutHygienePlan {
  const strongest = strongestLayoutStrength(events);
  if (!strongest) {
    return {
      strongest_layout_strength: null,
      policy: null
    };
  }

  return {
    strongest_layout_strength: strongest,
    policy: LAYOUT_HYGIENE_POLICY_BY_STRENGTH[strongest]
  };
}
