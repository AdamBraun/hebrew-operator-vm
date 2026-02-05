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

export function selectOperands(state: State, meta: LetterMeta): { S: State; ops: SelectOperands } {
  const args: string[] = [];
  const requiredFromK = takeFromStack(state.vm.K, meta.arity_req);
  enforceDistinct(requiredFromK, "Distinctness requirement not met (K)", meta.distinct_required);
  args.push(...requiredFromK);

  let usedFromW = 0;
  if (args.length < meta.arity_req && state.vm.W.length > 0) {
    const remaining = meta.arity_req - args.length;
    const requiredFromW = takeFromWatchlist(state.vm.W, remaining, 0);
    usedFromW = requiredFromW.length;
    enforceDistinct(requiredFromW, "Distinctness requirement not met (W)", meta.distinct_required);
    args.push(...requiredFromW);
  }

  let requiredUsedF = false;
  if (args.length < meta.arity_req) {
    args.push(state.vm.F);
    requiredUsedF = true;
  }

  let requiredUsedR = false;
  if (args.length < meta.arity_req) {
    args.push(state.vm.R);
    requiredUsedR = true;
  }

  let requiredUsedOmega = false;
  if (args.length < meta.arity_req) {
    args.push(state.vm.Omega);
    requiredUsedOmega = true;
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
      const optFromK = takeFromStack(state.vm.K, meta.arity_opt - optional.length);
      enforceDistinct(
        optFromK,
        "Distinctness requirement not met (K optional)",
        meta.distinct_optional
      );
      optional.push(...optFromK);
    }

    if (optional.length < meta.arity_opt && state.vm.W.length > 0) {
      const remaining = meta.arity_opt - optional.length;
      const optFromW = takeFromWatchlist(state.vm.W, remaining, usedFromW);
      enforceDistinct(
        optFromW,
        "Distinctness requirement not met (W optional)",
        meta.distinct_optional
      );
      optional.push(...optFromW);
    }

    if (optional.length < meta.arity_opt && !requiredUsedF) {
      optional.push(state.vm.F);
    }

    if (optional.length < meta.arity_opt && !requiredUsedR) {
      optional.push(state.vm.R);
    }

    if (optional.length < meta.arity_opt && !requiredUsedOmega) {
      optional.push(state.vm.Omega);
    }

    // optional operands are only supplied if available; no fallback duplication or BOT fill
    args.push(...optional);
  }

  return { S: state, ops: { args, prefs: {} } };
}
