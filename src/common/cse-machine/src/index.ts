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

/** The {@link CseSnapshotMessage.type} discriminator for the snapshots of a whole run. */
export const CSE_MESSAGE_TYPE_SNAPSHOTS = "snapshots";

/** The {@link CseSnapshotBatchMessage.type} discriminator for a part of a run's snapshots. */
export const CSE_MESSAGE_TYPE_SNAPSHOT_BATCH = "snapshot-batch";

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
  /**
   * Coarse type label, e.g. `"number"`, `"closure"`, `"list"`. The renderer knows `"none"`,
   * `"nonetype"` and `"null"` (case-insensitively) as the language's value for nothing: it draws
   * `displayValue` (`"None"` for Python), and a slash inside a list's box. Source's empty list has
   * the label `"empty_list"` instead.
   */
  label: string;
  /** Optional fine-grained tag for the visualizer. */
  tag?: string;
  /** Language-specific extra data (closure frame id, element refs, etc.). */
  metadata?: unknown;
  /**
   * For a value that refers to a heap object (a list, a closure): a stable id of that object,
   * unique within a run, if the evaluator names its objects. A plugin that draws the snapshot
   * through {@link ICseDiagramService} uses it to refer to the object, e.g. to highlight it.
   */
  objectId?: string;
}

/**
 * What a function value's `metadata` may carry (a {@link CseSerializedValue} whose `label` says it is
 * a function or closure). Every field is optional, and a renderer shows what is there, so an
 * evaluator sends what its language has, and no renderer needs to know which language it is.
 */
export interface CseFunctionMetadata {
  /** For a closure: the id of the frame it was defined in. */
  closureFrameId?: string;
  /** The parameter names. */
  params?: string[];
  /** The function's own name; absent or `"lambda"` for an anonymous one. */
  funcName?: string;
  /** The body's source text, if the evaluator has it. */
  body?: string;
  /** The names that the body assigns or defines (the function's own scope), with `globals`. */
  locals?: string[];
  /** The names that the body declares as global. */
  globals?: string[];
  /**
   * `true` for a built-in function: one with no defining frame and no source. It is drawn as such
   * (without parameters or body), and its `displayValue` is its name. Without this flag, a function
   * with no `closureFrameId` is taken to be a built-in as well; send the flag, and do not rely on that.
   */
  builtin?: boolean;
}

/** The {@link CseEnvironmentInstructionMetadata.instrType} of an instruction that restores a frame. */
export const CSE_INSTR_TYPE_ENVIRONMENT = "env";

/**
 * What the `metadata` of the control item that restores an environment carries (the instruction that
 * the machine pushes before a call or a block, so that the frame is current again when the body is
 * done). A renderer draws an arrow from the item to the frame `envId`. Send `displayText` as you
 * like (`"ENVIRONMENT"` has been the habit); a renderer takes the instruction by its `instrType`.
 */
export interface CseEnvironmentInstructionMetadata {
  instrType: typeof CSE_INSTR_TYPE_ENVIRONMENT;
  /** The id of the frame (a {@link CseSerializedEnvFrame.id}) that this instruction restores. */
  envId: string;
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
  /**
   * The frame's heading, if the evaluator chooses it (e.g. `"Global"` and `"Built-ins"` for
   * Python's module and builtins frames). Without it, the host derives one from `name` (e.g.
   * `"Program"` for `"programEnvironment"`).
   */
  label?: string;
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
  /**
   * Names in this frame that resolve to the global frame instead of the usual enclosing-scope
   * chain (e.g. Python's `global` statement). The web plugin uses this to annotate the frame
   * and to short-circuit lookup animations straight to the global frame.
   */
  globalNames?: string[];
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
  /**
   * 0-based `stepIndex`es, in ascending order, of steps where a breakpoint (e.g. Python's
   * `breakpoint()`, JavaScript's `debugger;`) sits on top of the control. Used by the host's
   * breakpoint-navigation controls to jump directly between these steps. Optional so older
   * runners that predate this field remain valid `CseSnapshotMessage`s.
   */
  breakpointSteps?: number[];
}

/**
 * How a run that was sent in batches ended: it ran to its end (`complete`), or the runner stopped
 * recording before that (`cut-off`, with the reason, such as a limit of the runner's own). The same
 * shape as the stepper's `TraceEnd` (`@sourceacademy/common-stepper`); a run with no end at all (the
 * host stopped it) is as far as it got.
 */
export type CseTraceEnd = { status: "complete" } | { status: "cut-off"; reason: string };

/**
 * A part of the snapshots of the run that is going on, sent while it runs, so that a run that is
 * stopped, or never finishes, still leaves the snapshots that it had computed. See
 * {@link CseSnapshotMessage} for a runner that sends a whole run at the end instead.
 *
 * A run is a series of batches whose `index` values continue from one another: the first has `index`
 * 0 (and starts the run afresh), and each next one has the number of snapshots that came before it.
 * The last carries `end`, and may have no snapshots (the end is known only after the last step).
 */
export interface CseSnapshotBatchMessage {
  /** Discriminator; always {@link CSE_MESSAGE_TYPE_SNAPSHOT_BATCH}. */
  type: typeof CSE_MESSAGE_TYPE_SNAPSHOT_BATCH;
  /** The number of snapshots of this run that precede this batch. 0 starts a run. */
  index: number;
  /** The snapshots of this batch, in step order. */
  snapshots: CseSnapshot[];
  /**
   * As {@link CseSnapshotMessage.breakpointSteps} (absolute step indices of the run), for the
   * steps of this batch only.
   */
  breakpointSteps?: number[];
  /** Present on the last batch of the run. */
  end?: CseTraceEnd;
}

/** Every message that may cross the {@link CSE_CHANNEL} channel, runner to host. */
export type CseMessage = CseSnapshotMessage | CseSnapshotBatchMessage;

/* -------------------------------------------------------------------------- */
/*                         Host services for web plugins                      */
/* -------------------------------------------------------------------------- */

/** A point in a diagram view's own coordinates: pixels from the view's top-left corner. */
export interface CseDiagramPoint {
  x: number;
  y: number;
}

/** Where an arrow should end in a diagram view, and how much the view is zoomed. */
export interface CseDiagramAnchor extends CseDiagramPoint {
  /** The view's zoom (1 when not zoomed): arrowheads and lines scale with it, like the diagram's. */
  scale?: number;
}

/**
 * Finds where a heap object or a frame is in a diagram view, as it is drawn right now (with the
 * user's pan and zoom): the point an arrow pointing at it should end at. `null` if it is not
 * drawn, e.g. when it is scrolled or collapsed out of the view.
 */
export type CseDiagramAnchorResolver = (target: {
  kind: "object" | "frame";
  /** A {@link CseSerializedValue.objectId} or a {@link CseSerializedEnvFrame.id}. */
  id: string;
}) => CseDiagramAnchor | null;

/** What {@link ICseDiagramService.createView} draws. */
export interface CseDiagramViewProps {
  /** A run's snapshots; frames from earlier snapshots are shown as unreachable frames. */
  snapshots: CseSnapshot[];
  /** The 0-based index of the snapshot to draw. */
  step: number;
  /** The {@link CseSerializedValue.objectId} of the heap object to highlight, if any. */
  hovered?: string | null;
  /**
   * Called with a heap object's {@link CseSerializedValue.objectId} when the mouse enters the
   * object in the diagram, and with `null` when it leaves.
   */
  onHover?: (objectId: string | null) => void;
  /**
   * Colours for frames, by {@link CseSerializedEnvFrame.id}, e.g. to match the plugin's own
   * colouring of environments. A host draws a coloured frame's box in its colour, and the active
   * frame in its colour with a wider outline, instead of its own colour for the active frame.
   */
  frameColors?: Record<string, string>;
  /** The {@link CseSerializedEnvFrame.id} of the frame to highlight, if any. */
  hoveredFrame?: string | null;
  /** Called with a frame's id when the mouse enters the frame in the diagram, `null` when it leaves. */
  onHoverFrame?: (frameId: string | null) => void;
  /**
   * Asks the view to report where its objects and frames are, so the plugin can draw arrows into
   * the diagram from its own panes (the environment stepper's program pane). Called whenever the
   * drawing moves (a new step, pan, zoom, resize), and with `null` when the view no longer has
   * anchors to give: when it unmounts.
   *
   * `fromProgram` is whether the host's arrow menu asks for all arrows from the program to be
   * drawn ("From program"). When it is `false`, the plugin draws such an arrow only while the
   * object or frame it points to is hovered. Omitted, it is `true`: a host that predates this
   * argument called `onAnchors` only while the menu asked for the arrows, and with `null` otherwise.
   * Optional: a host that does not support `onAnchors` never calls it, and the plugin draws no arrows.
   */
  onAnchors?: (resolve: CseDiagramAnchorResolver | null, fromProgram?: boolean) => void;
}

/**
 * A host's CSE machine visualization, lent to web plugins that want to draw environments the way
 * the CSE Machine tab does (arrow routing and filtering, alignment, printable mode, clearing unreachable
 * frames, saving, zoom) instead of drawing them themselves — e.g. the environment stepper.
 */
export interface ICseDiagramService {
  /**
   * Returns an element of the host's UI framework (a React element in the Source Academy frontend,
   * which also provides React to the plugin) that draws the environments of `snapshots[step]` —
   * environment only, without control and stash — together with the host's diagram toolbar.
   */
  createView(props: CseDiagramViewProps): unknown;
}

/**
 * Optional services a host passes to the web plugins it loads, after the tab service:
 * `registerPlugin(PluginClass, tabService, hostServices)`. Every member is optional, and a plugin
 * that does not expect the argument simply ignores it.
 */
export interface IHostServices {
  cseDiagram?: ICseDiagramService;
}
