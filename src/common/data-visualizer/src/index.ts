/**
 * Shared, language-agnostic protocol for the Source Academy data visualizer plugin pair.
 *
 * The data visualizer is split into:
 *  - a {@link https://github.com/source-academy/conductor | Conductor} **runner** plugin
 *    (`@sourceacademy/runner-data-visualizer`) that turns a language's own runtime value into a
 *    {@link SerializedDataVisualizerNode} — a purely mechanical conversion, no graph algorithms, and
 *  - a **web/host** plugin (`@sourceacademy/web-data-visualizer`) that owns cycle-detection, pair/
 *    list/tree classification, and rendering.
 *
 * Classification lives host-side, once, shared across every language — unlike the stepper (where the
 * stepping algorithm is necessarily per-language, because ASTs don't share structure across
 * languages), pairs/lists/arrays *do* share structure across Source Academy's SICP-descended
 * languages, so there is no reason to duplicate cycle-detection/classification per language.
 *
 * They communicate over a single {@link DATA_VISUALIZER_CHANNEL_ID | channel} using the
 * {@link DataVisualizerMessage} protocol. Everything that crosses the channel must be plain,
 * structured-clone-able JSON — class instances with methods (and live object identity) cannot survive
 * a `MessageChannel`, which is why every compound node carries an explicit {@link RefId} instead.
 */

/** The channel the data visualizer runner and host plugins communicate over. */
export const DATA_VISUALIZER_CHANNEL_ID = '__data_visualizer';

/** The id of the runner (worker-side) data visualizer plugin. */
export const RUNNER_ID = '__runner_data_visualizer';

/** The id of the web/host (browser-side) data visualizer plugin. */
export const WEB_ID = '__web_data_visualizer';

/**
 * The id used to look the data visualizer up in the plugin directory (i.e. the argument to
 * `IRunnerPlugin.hostLoadPlugin`). The host resolves this to the web plugin's bundle URL.
 */
export const DATA_VISUALIZER_DIRECTORY_ID = 'data-visualizer';

/**
 * Identifies one distinct compound value (a pair/array or a function) within a single top-level
 * argument of one `draw_data(...)` call (one element of a {@link SerializedDataVisualizerRow}, not
 * the whole row). Assigned by the runner's `RefIdAllocator` on first encounter of a given runtime
 * value (by reference, language-side); only unique **within the argument it appears in** — a
 * `RefIdAllocator` is created fresh for *each argument*, not once per row, so a different argument
 * (even in the same row) may reuse the same numeric id for a completely unrelated value. Never
 * compare or reuse a `refId` across two different elements of a row, or across two different rows.
 *
 * This is what lets the host detect shared structure and cycles within one row without ever seeing a
 * live reference: a runtime value already seen earlier in the same `sendDrawing()` call is re-emitted
 * as a {@link SerializedDataVisualizerNode} `"ref"` node instead of being walked again.
 */
export type RefId = number;

/**
 * One node of a drawable structure, serialized to plain JSON. Each language's runner-side adapter
 * converts its own runtime values into this generic, tagged shape; the host's classifier and renderer
 * never see a language-specific value.
 *
 * A pair and a native (arbitrary-length) list are both the `"array"` variant — Source Academy's
 * SICP-descended languages represent a pair as a 2-element list, not a distinct type, so the host
 * distinguishes "pair" from "list" for classification purposes by `children.length`, not by tag.
 */
export type SerializedDataVisualizerNode =
  | { type: 'array'; refId: RefId; children: SerializedDataVisualizerNode[] }
  | { type: 'empty' }
  | { type: 'leaf'; displayValue: string; label: string }
  | { type: 'function'; refId: RefId; displayValue: string }
  | { type: 'ref'; refId: RefId };

/** One row = the fully-serialized arguments of a single `draw_data(...)` call. */
export type SerializedDataVisualizerRow = SerializedDataVisualizerNode[];

/* -------------------------------------------------------------------------- */
/*                              Channel protocol                              */
/* -------------------------------------------------------------------------- */

/**
 * Runner → host: the full current set of rows for this run. Replaces, not appends — mirrors the
 * stepper's `StepperStepsMessage` replace-not-delta contract, so a host that missed earlier messages
 * (e.g. because the tab was closed) is always brought fully up to date by the next one.
 */
export interface DataVisualizerRowsMessage {
  type: 'rows';
  rows: SerializedDataVisualizerRow[];
}

/**
 * Host → runner: asks the runner to (re)send the rows it last computed. Used to repopulate the
 * display when the data visualizer tab is (re)opened without re-running the program.
 */
export interface DataVisualizerRequestMessage {
  type: 'request';
}

/** Every message that may cross the {@link DATA_VISUALIZER_CHANNEL_ID} channel. */
export type DataVisualizerMessage = DataVisualizerRowsMessage | DataVisualizerRequestMessage;
