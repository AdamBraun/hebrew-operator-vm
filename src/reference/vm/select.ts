import { BOT_ID } from "../state/handles";
import { State } from "../state/state";
import { LetterMeta, SelectOperands } from "../letters/types";
import { RuntimeError } from "./errors";

function takeFromStack(stack: string[], count: number): string[] {
  const selected: string[] = [];
  while (selected.length < count && stack.length > 0) {
    const value = stack.pop();
    if (value !== undefined) {
      selected.push(value);
    }
  }
  return selected;
}

function takeFromWatchlist(list: string[], count: number, usedFromEnd: number): string[] {
  const availableEnd = Math.max(0, list.length - usedFromEnd);
  const takeCount = Math.min(count, availableEnd);
  if (takeCount <= 0) {
    return [];
  }
  const start = Math.max(0, availableEnd - takeCount);
  return list.slice(start, availableEnd);
}

function enforceDistinct(values: string[], message: string, enabled: boolean): void {
  if (!enabled) {
    return;
  }
  if (new Set(values).size !== values.length) {
    throw new RuntimeError(message);
  }
}

function parseEdge(edge: string): [string, string] | null {
  const pivot = edge.indexOf("->");
  if (pivot <= 0 || pivot + 2 >= edge.length) {
    return null;
  }
  const source = edge.slice(0, pivot);
  const target = edge.slice(pivot + 2);
  if (!source || !target) {
    return null;
  }
  return [source, target];
}

function subChildren(state: State, parent: string): string[] {
  const children: string[] = [];
  for (const edge of state.sub) {
    const parsed = parseEdge(edge);
    if (!parsed) {
      continue;
    }
    const [source, child] = parsed;
    if (source !== parent || !state.handles.has(child) || children.includes(child)) {
      continue;
    }
    children.push(child);
  }
  return children;
}

function selectionTargetsFromFocus(state: State): string[] {
  return subChildren(state, state.vm.F);
}

function selectionPrefs(state: State, usedFocus: boolean): Record<string, any> {
  if (!usedFocus) {
    return {};
  }
  const targets = selectionTargetsFromFocus(state);
  if (targets.length === 0) {
    return {};
  }
  return { selection_targets: targets };
}

export function resolveSelectableFocus(state: State): string {
  return state.vm.F;
}

function resolveFocusCandidate(state: State, candidate: string): string {
  if (candidate !== state.vm.F) {
    return candidate;
  }
  return resolveSelectableFocus(state);
}

export function selectCurrentFocus(state: State): { S: State; ops: SelectOperands } {
  const focus = resolveSelectableFocus(state);
  return {
    S: state,
    ops: {
      args: [focus],
      prefs: selectionPrefs(state, true)
    }
  };
}

export function selectOperands(state: State, meta: LetterMeta): { S: State; ops: SelectOperands } {
  const args: string[] = [];
  let selectedFocus = false;
  const requiredFromK = takeFromStack(state.vm.K, meta.arity_req).map((value) =>
    resolveFocusCandidate(state, value)
  );
  enforceDistinct(requiredFromK, "Distinctness requirement not met (K)", meta.distinct_required);
  args.push(...requiredFromK);

  let usedFromW = 0;
  if (args.length < meta.arity_req && state.vm.W.length > 0) {
    const remaining = meta.arity_req - args.length;
    const requiredFromW = takeFromWatchlist(state.vm.W, remaining, 0).map((value) =>
      resolveFocusCandidate(state, value)
    );
    usedFromW = requiredFromW.length;
    enforceDistinct(requiredFromW, "Distinctness requirement not met (W)", meta.distinct_required);
    args.push(...requiredFromW);
  }

  let requiredUsedF = false;
  if (args.length < meta.arity_req) {
    args.push(resolveSelectableFocus(state));
    requiredUsedF = true;
    selectedFocus = true;
  }

  let requiredUsedR = false;
  if (args.length < meta.arity_req) {
    args.push(state.vm.R);
    requiredUsedR = true;
  }

  let requiredUsedD = false;
  if (args.length < meta.arity_req) {
    args.push(state.vm.D);
    requiredUsedD = true;
  }

  while (args.length < meta.arity_req) {
    if (meta.reflexive_ok && args.length > 0) {
      args.push(args[args.length - 1]);
    } else {
      args.push(BOT_ID);
    }
  }

  if (meta.arity_opt > 0) {
    const optional: string[] = [];

    if (state.vm.K.length > 0) {
      const optFromK = takeFromStack(state.vm.K, meta.arity_opt - optional.length).map((value) =>
        resolveFocusCandidate(state, value)
      );
      enforceDistinct(
        optFromK,
        "Distinctness requirement not met (K optional)",
        meta.distinct_optional
      );
      optional.push(...optFromK);
    }

    if (optional.length < meta.arity_opt && state.vm.W.length > 0) {
      const remaining = meta.arity_opt - optional.length;
      const optFromW = takeFromWatchlist(state.vm.W, remaining, usedFromW).map((value) =>
        resolveFocusCandidate(state, value)
      );
      enforceDistinct(
        optFromW,
        "Distinctness requirement not met (W optional)",
        meta.distinct_optional
      );
      optional.push(...optFromW);
    }

    if (optional.length < meta.arity_opt && !requiredUsedF) {
      optional.push(resolveSelectableFocus(state));
      selectedFocus = true;
    }

    if (optional.length < meta.arity_opt && !requiredUsedR) {
      optional.push(state.vm.R);
    }

    if (optional.length < meta.arity_opt && !requiredUsedD) {
      optional.push(state.vm.D);
    }

    // optional operands are only supplied if available; no fallback duplication or BOT fill
    args.push(...optional);
  }

  if (args.includes(state.vm.F)) {
    selectedFocus = true;
  }

  return { S: state, ops: { args, prefs: selectionPrefs(state, selectedFocus) } };
}
