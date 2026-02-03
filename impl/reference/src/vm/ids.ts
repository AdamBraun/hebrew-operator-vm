import { State } from "../state/state";

export function nextId(state: State, letter: string): string {
  if (!state.vm.metaCounter) {
    state.vm.metaCounter = {};
  }
  const current = state.vm.metaCounter[letter] ?? 0;
  const next = current + 1;
  state.vm.metaCounter[letter] = next;
  return `${letter}:${state.vm.tau}:${next}`;
}
