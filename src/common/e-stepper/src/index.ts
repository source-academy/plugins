/**
 * Shared, language-agnostic protocol for the Source Academy environment stepper ("e-stepper").
 *
 * The e-stepper is a cross between the substitution stepper and the CSE machine: like the stepper,
 * it shows the program being rewritten one step at a time, but a function body under evaluation
 * carries the environment it is evaluated in, names are looked up instead of substituted, and
 * function objects and data structures live in a heap. Each step therefore pairs the program (an
 * AST, exactly as in `@sourceacademy/common-stepper`) with the environment frames and heap objects
 * it refers to, drawn as in the CSE machine visualization. Design note:
 * https://github.com/source-academy/py-slang/blob/main/docs/e-stepper.md
 *
 * The e-stepper is split into:
 *  - a {@link https://github.com/source-academy/conductor | Conductor} **runner** plugin
 *    (`@sourceacademy/runner-e-stepper`) that turns an AST into evaluation steps, and
 *  - a **web/host** plugin (`@sourceacademy/web-e-stepper`) that displays those steps.
 *
 * They communicate over a single {@link E_STEPPER_CHANNEL_ID | channel} using the
 * {@link EStepperMessage} protocol, which has the same shape as the stepper's. Everything that
 * crosses the channel must be plain, structured-clone-able JSON.
 *
 * The program refers into the store through two node types with fixed meaning, which a host
 * renders itself (they are not part of a language's `SyntaxProfile`):
 *  - {@link EnvBlockNode}: a function body being evaluated in a frame,
 *  - {@link RefNode}: a reference to a heap object.
 */

import type { CseSnapshot } from "@sourceacademy/common-cse-machine";
import type {
  SerializedMarker,
  SerializedStepperNode,
  SerializedStepperStep,
  SyntaxProfile,
} from "@sourceacademy/common-stepper";

/** The channel the e-stepper runner and host plugins communicate over. */
export const E_STEPPER_CHANNEL_ID = "__e_stepper";

/** The id of the runner (worker-side) e-stepper plugin. */
export const RUNNER_ID = "__runner_e_stepper";

/** The id of the web/host (browser-side) e-stepper plugin. */
export const WEB_ID = "__web_e_stepper";

/**
 * The id used to look the e-stepper up in the plugin directory (i.e. the argument to
 * `IRunnerPlugin.hostLoadPlugin`). The host resolves this to the web plugin's bundle URL.
 */
export const E_STEPPER_DIRECTORY_ID = "e-stepper";

/* -------------------------------------------------------------------------- */
/*                         Program nodes into the store                       */
/* -------------------------------------------------------------------------- */

/** The `type` of an {@link EnvBlockNode}. */
export const ENV_BLOCK_NODE_TYPE = "EnvBlock";

/** The `type` of a {@link RefNode}. */
export const REF_NODE_TYPE = "Ref";

/**
 * A function body under evaluation, together with the frame it is evaluated in. Created when a
 * function is called, and replaced by the call's result when the body returns. Names inside the
 * body (outside any nested `EnvBlock`) are looked up starting from frame `envId`.
 *
 * `body` is a list of statements for a function with a statement body, or a single expression node
 * for a function whose body is an expression (e.g. a Python `lambda`).
 */
export interface EnvBlockNode extends SerializedStepperNode {
  type: typeof ENV_BLOCK_NODE_TYPE;
  /** The {@link EStepperFrame.id} of the frame the body is evaluated in. */
  envId: string;
  body: SerializedStepperNode[] | SerializedStepperNode;
}

/** A value in the program that is a reference to a heap object (a function object or a list). */
export interface RefNode extends SerializedStepperNode {
  type: typeof REF_NODE_TYPE;
  /** The {@link EStepperHeapObject.id} of the referenced object. */
  objectId: string;
}

export function isEnvBlockNode(node: SerializedStepperNode): node is EnvBlockNode {
  return node.type === ENV_BLOCK_NODE_TYPE;
}

export function isRefNode(node: SerializedStepperNode): node is RefNode {
  return node.type === REF_NODE_TYPE;
}

/* -------------------------------------------------------------------------- */
/*                                   Store                                    */
/* -------------------------------------------------------------------------- */

/** A value bound in a frame or stored in a list. */
export type EStepperValue =
  /**
   * A primitive value, shown inline. `display` is the already-rendered text (e.g. `"3.0"`,
   * `"'hello'"`, `"None"`); `label` is a coarse type tag (e.g. `"int"`, `"float"`, `"str"`).
   */
  | { kind: "primitive"; display: string; label: string }
  /** A reference to a heap object. */
  | { kind: "ref"; objectId: string }
  /** A builtin function, shown by its name (builtins are not heap objects and not drawn). */
  | { kind: "builtin"; name: string }
  /** A binding that exists but has not been assigned yet (e.g. a function's local). */
  | { kind: "unassigned" };

/** A name → value binding in a frame. */
export interface EStepperBinding {
  name: string;
  value: EStepperValue;
}

/** An environment frame. */
export interface EStepperFrame {
  /**
   * Stable id for the whole run, unique among frames, and also the label shown on the frame and on
   * every {@link EnvBlockNode} that refers to it (e.g. `"Global"`, `"E3"`).
   */
  id: string;
  /** What created the frame: `"global"`, or the name of the called function. */
  name: string;
  /** The parent (enclosing) frame, or `null` for the global frame. */
  parentId: string | null;
  /** Bindings in creation order. */
  bindings: EStepperBinding[];
  /** Whether the frame is no longer reachable from the program or the global frame. */
  isGarbage: boolean;
}

/** A function object: what a function definition or lambda expression evaluates to. */
export interface EStepperFunctionObject {
  kind: "function";
  /** Stable id for the whole run, unique among heap objects; also its label (e.g. `"#3"`). */
  id: string;
  /** The function's name, or absent for an anonymous function (e.g. a lambda). */
  name?: string;
  /** Parameter names, as written (e.g. `"*rest"`). */
  params: string[];
  /** The frame the function was defined in. */
  envId: string;
  /** The function's source text, for a hover/expanded view. */
  source: string;
  isGarbage: boolean;
}

/** A mutable sequence, e.g. a Python list. A pair is a list of two elements. */
export interface EStepperListObject {
  kind: "list";
  /** Stable id for the whole run, unique among heap objects; also its label (e.g. `"#7"`). */
  id: string;
  elements: EStepperValue[];
  isGarbage: boolean;
}

export type EStepperHeapObject = EStepperFunctionObject | EStepperListObject;

/* -------------------------------------------------------------------------- */
/*                                    Steps                                   */
/* -------------------------------------------------------------------------- */

/** A binding read by a step's (implicit) name lookups, for the host to highlight. */
export interface EStepperLookup {
  frameId: string;
  name: string;
}

/**
 * One step of an evaluation: the program (with {@link EnvBlockNode}s and {@link RefNode}s) plus the
 * store it refers to, in the state *before* the step's reduction, as in the stepper.
 */
export interface EStepperStep extends SerializedStepperStep {
  /** All frames created so far, in creation order (the global frame first). */
  frames: EStepperFrame[];
  /** All heap objects created so far, in creation order. */
  heap: EStepperHeapObject[];
  /** The frame the step's redex is evaluated in (the innermost enclosing `EnvBlock`'s frame). */
  activeFrameId: string;
  /** Bindings this step reads through implicit lookups. */
  lookups?: EStepperLookup[];
  /**
   * The same store as a CSE machine snapshot (environments only; control and stash empty), so a
   * host can draw it with its CSE machine visualization (see `ICseDiagramService` in
   * `@sourceacademy/common-cse-machine`). Optional: a host without that service, or a runner that
   * does not produce it, uses `frames` and `heap` instead.
   */
  cse?: CseSnapshot;
}

export type { SerializedMarker, SerializedStepperNode, SyntaxProfile };

/* -------------------------------------------------------------------------- */
/*                              Channel protocol                              */
/* -------------------------------------------------------------------------- */

/** Runner → host: the computed evaluation steps for the most recent run. */
export interface EStepperStepsMessage {
  type: "steps";
  steps: EStepperStep[];
  /**
   * The language's rendering rules for ordinary program nodes, as for the stepper. `EnvBlock` and
   * `Ref` nodes are rendered by the host itself and need no template.
   */
  profile?: SyntaxProfile;
}

/** Runner → host: stepping failed (e.g. a parse error). */
export interface EStepperErrorMessage {
  type: "error";
  error: string;
}

/** Host → runner: asks the runner to (re)send the steps it last computed. */
export interface EStepperRequestMessage {
  type: "request";
}

/** Every message that may cross the {@link E_STEPPER_CHANNEL_ID} channel. */
export type EStepperMessage = EStepperStepsMessage | EStepperErrorMessage | EStepperRequestMessage;
