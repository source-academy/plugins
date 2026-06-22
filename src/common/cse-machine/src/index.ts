/**
 * Shared, language-agnostic protocol for the Source Academy CSE (Control–Stash–Environment)
 * machine plugin pair.
 *
 * The CSE machine is split into:
 *  - a {@link https://github.com/source-academy/conductor | Conductor} **runner** plugin
 *    (`@sourceacademy/runner-cse-machine`) that an evaluator feeds serialized evaluation
 *    snapshots to, and
 *  - a **web/host** plugin (`@sourceacademy/web-cse-machine`) that renders those snapshots
 *    as the CSE machine visualization.
 *
 * They communicate over a single {@link CSE_CHANNEL} using {@link CseSnapshotMessage}.
 * Everything that crosses the channel must be plain, structured-clone-able JSON — class
 * instances with methods cannot survive a `MessageChannel`. Each language evaluator
 * (js-slang, py-slang, ...) is responsible for serializing its own control/stash/environment
 * into these shared shapes, keeping the protocol language-agnostic.
 */

/** The channel the CSE machine runner and host plugins communicate over. */
export const CSE_CHANNEL = "__cse";

/** The id of the runner (worker-side) CSE machine plugin. */
export const RUNNER_ID = "__runner_cse";

/** The id of the web/host (browser-side) CSE machine plugin. */
export const WEB_ID = "__web_cse";

/**
 * The id used to look the CSE machine up in the plugin directory (i.e. the argument to
 * `IRunnerPlugin.hostLoadPlugin`). The host resolves this to the web plugin's bundle URL.
 */
export const CSE_DIRECTORY_ID = "cse-machine";

/** The {@link CseSnapshotMessage.type} discriminator for a batch of snapshots. */
export const CSE_MESSAGE_TYPE_SNAPSHOTS = "snapshots";

/**
 * A single value on the stash or bound in an environment, serialized to plain JSON.
 *
 * `displayValue` is the already-rendered string the visualizer shows; `label` is a coarse
 * type tag (e.g. `"number"`, `"closure"`). `metadata` carries language-specific extras the
 * web plugin may use (e.g. a closure's defining-frame id, array element refs).
 */
export interface CseSerializedValue {
  /** Pre-rendered display string for the value. */
  displayValue: string;
  /** Coarse type label, e.g. `"number"`, `"closure"`, `"list"`. */
  label: string;
  /** Optional fine-grained tag for the visualizer. */
  tag?: string;
  /** Language-specific extra data (closure frame id, element refs, etc.). */
  metadata?: unknown;
}

/**
 * A single item on the control, serialized to plain JSON.
 *
 * `displayText` is what the control stack shows. `metadata` carries the typed info the
 * animation/rendering system dispatches on (e.g. `instrType`, `symbol`, `numOfArgs`,
 * `startLine`/`endLine`, `nodeType`).
 *
 * Unlike {@link CseSerializedValue}, instructions have no `label` field: they are operations
 * (apply, branch, assignment, …), not typed values, so a coarse type-tag is not meaningful
 * here. Renderers should use `displayText` for display and `metadata.instrType` (or equivalent)
 * for dispatch.
 */
export interface CseSerializedInstruction {
  /** Pre-rendered display text for the control item. */
  displayText: string;
  /** Optional fine-grained tag for the visualizer. */
  tag?: string;
  /** Typed metadata used for animation dispatch and source mapping. */
  metadata?: unknown;
}

/** A name → value binding within an environment frame. */
export interface CseSerializedBinding {
  /** The bound name. */
  name: string;
  /** The bound value. */
  value: CseSerializedValue;
  /** Whether the binding is a constant (e.g. `const` in Source). */
  isConst?: boolean;
}

/** A single environment frame, serialized to plain JSON. */
export interface CseSerializedEnvFrame {
  /** Stable id, unique within a run; referenced by `parentId`/`closureFrameId`. */
  id: string;
  /** Display name of the frame (e.g. function name, `"global"`, `"block"`). */
  name: string;
  /** Id of the lexical parent frame, or `null` for the root. */
  parentId: string | null;
  /** For a closure value's frame: the id of the frame the closure was defined in. */
  closureFrameId?: string;
  /** The name → value bindings in this frame. */
  bindings: CseSerializedBinding[];
  /** Closures/arrays in this frame's heap not bound to any name (anonymous heap objects). */
  heapObjects?: CseSerializedValue[];
  /** Whether this frame is the currently-active (innermost) frame at this step. */
  isActive: boolean;
  /** Whether this frame is currently on the call stack (vs only reachable via a closure). */
  isOnCallStack?: boolean;
}

/**
 * A complete snapshot of the CSE machine at a single evaluation step.
 *
 * The arrays are ordered for display (control/stash top-first). `currentLine` is the 1-based
 * source line of the node most recently evaluated at this step (i.e. the language runtime's
 * "current node"), used to drive the editor's current-line highlight; it is `undefined` when
 * there is no current node.
 */
export interface CseSnapshot {
  /** 0-based index of this step within the run. */
  stepIndex: number;
  /** Control items, top of control first. */
  control: CseSerializedInstruction[];
  /** Stash values, top of stash first. */
  stash: CseSerializedValue[];
  /** All (live) environment frames at this step. */
  environments: CseSerializedEnvFrame[];
  /** 1-based source line of the node most recently evaluated at this step. */
  currentLine?: number;
}

/** The message sent over {@link CSE_CHANNEL} carrying a batch of snapshots for a run. */
export interface CseSnapshotMessage {
  /** Discriminator; always {@link CSE_MESSAGE_TYPE_SNAPSHOTS}. */
  type: typeof CSE_MESSAGE_TYPE_SNAPSHOTS;
  /** All snapshots for the run, in step order. */
  snapshots: CseSnapshot[];
  /** Convenience count; equals `snapshots.length`. */
  totalSteps: number;
}
