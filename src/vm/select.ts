import { BOT_ID } from "../state/handles";
import { State } from "../state/state";
import { LetterMeta, SelectOperands } from "../letters/types";

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

export function selectOperands(state: State, meta: LetterMeta): { S: State; ops: SelectOperands } {
  const args: string[] = [];
  args.push(...takeFromStack(state.vm.K, meta.arity_req));

  if (args.length < meta.arity_req && state.vm.W.length > 0) {
    const remaining = meta.arity_req - args.length;
    args.push(...state.vm.W.slice(-remaining));
  }

  if (args.length < meta.arity_req) {
    args.push(state.vm.F);
  }

  if (args.length < meta.arity_req) {
    args.push(state.vm.R);
  }

  if (args.length < meta.arity_req) {
    args.push(state.vm.Omega);
  }

  while (args.length < meta.arity_req) {
    if (meta.reflexive_ok && args.length > 0) {
      args.push(args[args.length - 1]);
    } else {
      args.push(BOT_ID);
    }
  }

  return { S: state, ops: { args, prefs: {} } };
}
