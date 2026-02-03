import { BOT_ID, OMEGA_ID } from "./handles";
import { State } from "./state";

export function assertStateInvariants(state: State): void {
  const ids = new Set(state.handles.keys());
  ids.add(BOT_ID);
  ids.add(OMEGA_ID);

  const ensure = (id: string): void => {
    if (!ids.has(id)) {
      throw new Error(`Missing handle ${id}`);
    }
  };

  ensure(state.vm.F);
  ensure(state.vm.R);
  state.vm.K.forEach(ensure);
  state.vm.W.forEach(ensure);

  for (const obligation of state.vm.OStack_word) {
    ensure(obligation.parent);
    ensure(obligation.child);
    if (obligation.tau_created > state.vm.tau) {
      throw new Error(`Obligation tau_created ${obligation.tau_created} exceeds vm.tau`);
    }
  }

  for (const event of state.vm.H) {
    if (event.tau < 1 || event.tau > state.vm.tau) {
      throw new Error(`Event tau ${event.tau} out of bounds`);
    }
    if (event.data?.child) {
      ensure(event.data.child);
    }
    if (event.data?.parent) {
      ensure(event.data.parent);
    }
  }

  for (let i = 1; i < state.vm.H.length; i += 1) {
    if (state.vm.H[i].tau < state.vm.H[i - 1].tau) {
      throw new Error("Event tau values must be nondecreasing");
    }
  }

  for (const edge of state.cont) {
    const [from, to] = edge.split("->");
    ensure(from);
    ensure(to);
  }
}
