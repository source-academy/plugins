import type {
  EStepperFrame,
  EStepperHeapObject,
  EStepperStep,
} from "@sourceacademy/common-e-stepper";

export interface Store {
  frames: EStepperFrame[];
  heap: EStepperHeapObject[];
}

/**
 * What the steps up to one have made, kept while the user moves over a run: a slider moving on by
 * one step adds the frames of that step only.
 */
interface Seen {
  next: number;
  frames: Map<string, EStepperFrame>;
  heap: Map<string, EStepperHeapObject>;
}
const seen = new WeakMap<EStepperStep[], Seen>();

const order = (id: string): number => (id === "Global" ? -1 : Number(id.replace(/\D/g, "")));

/**
 * The whole store at `steps[index]`. What is unreachable stays so, so the evaluator puts a frame or
 * an object that has become unreachable in the step where it does, and in none of the steps after
 * it (all of them in every step would make the steps of a long run grow with the square of their
 * number: py-slang#611). The store at a step is the latest version of every frame and object in
 * that step and the ones before it; those the step itself does not have are unreachable. (An
 * evaluator that repeats them in every step gives the same store.) Frames are in creation order,
 * the global frame first, and objects in the order of their labels.
 */
export function storeAt(steps: EStepperStep[], index: number): Store {
  let state = seen.get(steps);
  if (!state || state.next > index + 1) {
    state = { next: 0, frames: new Map(), heap: new Map() };
    seen.set(steps, state);
  }
  for (; state.next <= index; state.next++) {
    for (const f of steps[state.next].frames) state.frames.set(f.id, f);
    for (const o of steps[state.next].heap) state.heap.set(o.id, o);
  }
  const step = steps[index];
  const here = {
    frames: new Set(step.frames.map(f => f.id)),
    heap: new Set(step.heap.map(o => o.id)),
  };
  const unreachable = <T extends { id: string; isGarbage: boolean }>(
    item: T,
    ids: Set<string>,
  ): T => (ids.has(item.id) || item.isGarbage ? item : { ...item, isGarbage: true });
  return {
    frames: [...state.frames.values()]
      .map(f => unreachable(f, here.frames))
      .sort((a, b) => order(a.id) - order(b.id)),
    heap: [...state.heap.values()]
      .map(o => unreachable(o, here.heap))
      .sort((a, b) => order(a.id) - order(b.id)),
  };
}
