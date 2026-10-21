import {
  DATA_VISUALIZER_CHANNEL_ID,
  RUNNER_ID,
  type DataVisualizerMessage,
  type RefId,
  type SerializedDataVisualizerNode,
  type SerializedDataVisualizerRow,
} from '@sourceacademy/common-data-visualizer';
import type { IChannel, IConduit, IPlugin } from '@sourceacademy/conductor/conduit';

/**
 * Assigns each distinct compound runtime value (by reference) a stable {@link RefId} the first time
 * it's seen while serializing one `draw_data(...)` argument, so a language adapter's `toNode` can
 * answer "have I already emitted this value in this argument?" without knowing anything about *why*
 * that matters — cycle detection and shared-structure classification are entirely the host's job,
 * not the adapter's.
 *
 * Scoped to a single argument, not a single row: {@link BaseDataVisualizerRunnerPlugin.sendDrawing}
 * creates a fresh allocator for *each argument* of the call, so ids are only comparable within the
 * one argument they were produced for (see `RefId`'s doc comment in
 * `@sourceacademy/common-data-visualizer`) — the host renders each argument as an independent Konva
 * `Stage`, so there is no way to resolve, let alone draw, a ref pointing across arguments.
 */
export interface RefIdAllocator {
  /**
   * Returns a fresh `refId` (`alreadySeen: false`) the first time it's called with a given `value`
   * reference, and the *same* `refId` (`alreadySeen: true`) on every later call with that same
   * reference. When `alreadySeen` is true, `toNode` should stop recursing into `value` and emit a
   * `{ type: "ref", refId }` node instead of walking it again — this is what makes serialization of
   * cyclic or merely-shared structures terminate.
   */
  get(value: object): { refId: RefId; alreadySeen: boolean };
}

/** Same `WeakMap`-keyed-by-live-reference technique already proven by py-slang's CSE machine plugin
 * (`PyCseMachinePlugin.ts`'s `_listIdMap`/`getListId`) for deduplicating a value referenced from
 * multiple bindings down to a single id. */
export function createRefIdAllocator(): RefIdAllocator {
  const ids = new WeakMap<object, RefId>();
  let nextId = 0;
  return {
    get(value: object) {
      const existing = ids.get(value);
      if (existing !== undefined) {
        return { refId: existing, alreadySeen: true };
      }
      const refId = ++nextId;
      ids.set(value, refId);
      return { refId, alreadySeen: false };
    },
  };
}

/**
 * The language-agnostic runner half of the data visualizer.
 *
 * This base class owns everything that is *not* language-specific: the channel wiring, the
 * request/replay protocol with the host, and accumulating rows across a run. A concrete language
 * adapter (e.g. js-slang, py-slang) extends this class and implements the single abstract method
 * {@link toNode}, which converts **one runtime value** into a {@link SerializedDataVisualizerNode} —
 * a purely mechanical conversion (dispatch on the value's own shape, recurse into children). No
 * cycle-detection, pair/list/tree classification, or layout logic belongs in a subclass: unlike the
 * stepper (whose per-language `getSteps` necessarily does the *whole* job, because ASTs share no
 * structure across languages), pairs/lists/arrays share structure across every one of Source
 * Academy's SICP-descended languages, so that logic lives once, host-side.
 *
 * The evaluator (or, more precisely, the `draw_data` builtin it registers) drives this by calling
 * {@link sendDrawing} once per call — unlike the stepper's one-shot whole-program `sendSteps`, this
 * can and normally does fire many times in a single run.
 *
 * @typeParam TValue The language's own runtime value type accepted by {@link toNode}.
 */
export abstract class BaseDataVisualizerRunnerPlugin<TValue> implements IPlugin {
  static readonly channelAttach = [DATA_VISUALIZER_CHANNEL_ID];
  readonly id: string = RUNNER_ID;

  private readonly __channel: IChannel<DataVisualizerMessage>;
  /** Every row sent so far in the current run, replayed on host request. Cleared by {@link resetRun}. */
  private __rows: SerializedDataVisualizerRow[] = [];

  constructor(_conduit: IConduit, [channel]: IChannel<DataVisualizerMessage>[]) {
    this.__channel = channel;
    this.__channel.subscribe(message => {
      // The host (re)opened the data visualizer tab and wants the latest rows without a re-run.
      if (message.type === 'request') {
        this.__channel.send({ type: 'rows', rows: this.__rows });
      }
    });
  }

  /**
   * The language-specific core of the data visualizer: given one runtime value, produce its
   * serialized node. Call `refs.get(value)` for every compound (pair/array/function) value *before*
   * recursing into it, and stop — emitting the returned `{ type: "ref", refId }` node instead of
   * recursing — as soon as `alreadySeen` comes back `true`. See {@link RefIdAllocator}.
   *
   * @param value One argument from a `draw_data(...)` call.
   * @param refs Identity tracking scoped to this one argument, fresh for each call to {@link toNode}.
   */
  protected abstract toNode(value: TValue, refs: RefIdAllocator): SerializedDataVisualizerNode;

  /**
   * Serializes `values` (the arguments of one `draw_data(...)` call) into a new row, appends it to
   * this run's accumulated rows, and pushes the full, updated row list to the host. Call this from
   * the `draw_data` builtin's implementation itself.
   *
   * Each argument gets its own fresh {@link RefIdAllocator}, not one shared across the whole call —
   * matching the old pre-Conductor frontend's `Tree.fromSourceStructure`, whose `visitedStructures`
   * identity map was likewise always fresh per top-level argument, never shared across arguments of
   * one `draw_data(...)` call. This isn't just fidelity to the old behavior: the host renders each
   * argument as its own independent Konva `Stage` (a separate `<canvas>`), so a "ref" node pointing
   * at a value that only got fully expanded in a *different* argument's tree can never be resolved —
   * there is no such thing as an arrow from one canvas into another. A row-scoped allocator would
   * make the wire format collapse a cross-argument-shared value down to a bare ref the host can't
   * resolve, silently losing that data (it falls back to rendering as an empty/None node). Scoping
   * per argument instead means a value shared *across* arguments is simply serialized in full each
   * time (matching legacy exactly); only sharing *within* one argument's own structure collapses to
   * a ref, which the host can always resolve because that whole subtree lives in one Stage.
   */
  sendDrawing(values: TValue[]): void {
    const row: SerializedDataVisualizerRow = values.map(value =>
      this.toNode(value, createRefIdAllocator()),
    );
    this.__rows = [...this.__rows, row];
    this.__channel.send({ type: 'rows', rows: this.__rows });
  }

  /**
   * Clears every row accumulated so far and pushes the (now empty) state to the host. Call this once
   * at the start of each run, alongside the evaluator's other per-run resets — the Conductor-era
   * equivalent of the old pre-Conductor frontend's `DataVisualizer.clearWithData()` on every Run
   * press.
   */
  resetRun(): void {
    this.__rows = [];
    this.__channel.send({ type: 'rows', rows: this.__rows });
  }
}
