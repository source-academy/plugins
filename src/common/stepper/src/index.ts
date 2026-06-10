/**
 * Shared, language-agnostic protocol for the Source Academy Stepper plugin pair.
 *
 * The Stepper is split into:
 *  - a {@link https://github.com/source-academy/conductor | Conductor} **runner** plugin
 *    (`@sourceacademy/runner-stepper`) that turns an AST into evaluation steps, and
 *  - a **web/host** plugin (`@sourceacademy/web-stepper`) that displays those steps.
 *
 * They communicate over a single {@link STEPPER_CHANNEL_ID | channel} using the
 * {@link StepperMessage} protocol. Everything that crosses the channel must be plain,
 * structured-clone-able JSON — class instances with methods cannot survive a `MessageChannel`.
 */

/** The channel the stepper runner and host plugins communicate over. */
export const STEPPER_CHANNEL_ID = "__stepper";

/** The id of the runner (worker-side) stepper plugin. */
export const RUNNER_ID = "__runner_stepper";

/** The id of the web/host (browser-side) stepper plugin. */
export const WEB_ID = "__web_stepper";

/**
 * The id used to look the stepper up in the plugin directory (i.e. the argument to
 * `IRunnerPlugin.hostLoadPlugin`). The host resolves this to the web plugin's bundle URL.
 */
export const STEPPER_DIRECTORY_ID = "stepper";

/**
 * A single AST node, serialized to plain JSON.
 *
 * Language-specific stepper ASTs are class instances dispatched on a `type` string. After
 * serialization the methods are gone, but `type` and the child fields remain so the host can
 * still render the node. Every node additionally carries a stable {@link SerializedStepperNode.nodeId}
 * assigned during serialization, so markers can reference nodes by id rather than by object
 * identity (which does not survive serialization).
 */
export interface SerializedStepperNode {
  /** The node kind, e.g. `"BinaryExpression"`. Mirrors the source AST's `type`. */
  type: string;
  /** A stable id, unique within a single step's tree. Used to match {@link SerializedMarker}s. */
  nodeId: string;
  /** Child nodes, arrays of nodes, and primitive properties of the original node. */
  [key: string]: unknown;
}

/**
 * Highlights a redex (reducible expression) within a step and explains the reduction.
 *
 * In the original (in-memory) stepper a marker pointed at a node by reference. Because that
 * identity is lost across the channel, a serialized marker instead references the target node by
 * its {@link SerializedStepperNode.nodeId} via {@link SerializedMarker.redexId}.
 */
export interface SerializedMarker {
  /** The `nodeId` of the highlighted node, or `null`/absent when there is nothing to highlight. */
  redexId?: string | null;
  /**
   * The `type` of the highlighted node (e.g. `"DebuggerStatement"`). Serialized alongside
   * {@link redexId} because the host can no longer dereference the node to read its type (object
   * identity is lost across the channel). Used e.g. for breakpoint navigation.
   */
  redexNodeType?: string;
  /** Whether the highlight applies before or after the reduction. */
  redexType?: "beforeMarker" | "afterMarker";
  /** A human-readable explanation of the reduction, shown alongside the step. */
  explanation?: string;
}

/** One step of an evaluation: a fully-serialized AST plus the markers describing the reduction. */
export interface SerializedStepperStep {
  /** The program AST at this step. */
  ast: SerializedStepperNode;
  /** Markers highlighting/explaining the redex(es) involved in reaching the next step. */
  markers?: SerializedMarker[];
}

/* -------------------------------------------------------------------------- */
/*                              Channel protocol                              */
/* -------------------------------------------------------------------------- */

/** Runner → host: the computed evaluation steps for the most recent run. */
export interface StepperStepsMessage {
  type: "steps";
  steps: SerializedStepperStep[];
}

/** Runner → host: stepping failed (e.g. a parse error). */
export interface StepperErrorMessage {
  type: "error";
  error: string;
}

/**
 * Host → runner: asks the runner to (re)send the steps it last computed. Used to repopulate the
 * display when the stepper tab is (re)opened without re-running the program.
 */
export interface StepperRequestMessage {
  type: "request";
}

/** Every message that may cross the {@link STEPPER_CHANNEL_ID} channel. */
export type StepperMessage = StepperStepsMessage | StepperErrorMessage | StepperRequestMessage;
