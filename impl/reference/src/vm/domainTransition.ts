import { SpaceBoundaryMode, Trope } from "../compile/types";
import { State } from "../state/state";
import { RuntimeError } from "./errors";

export type BoundaryExitKind = SpaceBoundaryMode;

export type BoundaryTransitionArgs = {
  exitKind: BoundaryExitKind;
  rank?: number | null;
  tropeInfo?: Trope | null;
};

const SHOULD_ENFORCE_OPERATOR_DOMAIN_INVARIANT = process.env.NODE_ENV !== "production";

function resolveTropeDrivenDomain(
  currentDomain: string,
  args: BoundaryTransitionArgs
): string | null {
  const trope = args.tropeInfo;
  if (!trope || trope.kind !== "disj") {
    return null;
  }
  if (args.exitKind !== "cut") {
    return null;
  }
  const rank = Math.max(1, Math.trunc(Number(args.rank ?? trope.rank ?? 1)));
  if (rank >= 3) {
    return currentDomain;
  }
  return null;
}

function computeNextDomain(state: State, args: BoundaryTransitionArgs): string {
  const tropeDomain = resolveTropeDrivenDomain(state.vm.D, args);
  if (tropeDomain) {
    return tropeDomain;
  }
  return state.vm.D;
}

export function applyBoundaryTransition(state: State, args: BoundaryTransitionArgs): void {
  state.vm.D = computeNextDomain(state, args);
}

export function assertOperatorDomainStable(
  state: State,
  args: {
    before: string;
    operator: string;
  }
): void {
  if (!SHOULD_ENFORCE_OPERATOR_DOMAIN_INVARIANT) {
    return;
  }
  if (state.vm.D === args.before) {
    return;
  }
  throw new RuntimeError(
    `Operator '${args.operator}' mutated vm.D from '${args.before}' to '${state.vm.D}'. ` +
      "Only boundary/cantillation transitions may update vm.D."
  );
}
