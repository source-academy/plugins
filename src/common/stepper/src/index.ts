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
  /**
   * The program's cumulative textual output (e.g. everything `print` has written) from the start of
   * evaluation up to and including this step. Unlike a marker's {@link SerializedMarker.explanation}
   * (which describes only this one step), this accumulates: each successive step repeats all earlier
   * output plus whatever this step produced, so a host can show a running output panel that grows as
   * the slider advances. Absent/empty when nothing has been output yet. Runners that produce no output
   * may omit it entirely.
   */
  output?: string;
}

/* -------------------------------------------------------------------------- */
/*                              Syntax profiles                               */
/* -------------------------------------------------------------------------- */

/**
 * The serialized stepper AST is structural (estree-shaped) and language-agnostic — node `type`s and
 * field names are shared across languages, but the *surface syntax* (keywords, punctuation, layout)
 * is not. A {@link SyntaxProfile} is the data a language's runner ships so the host can render that
 * language's syntax **without any per-language code in the host**: the host is a generic interpreter
 * of these profiles. A new language becomes renderable by providing a profile and registering its
 * runner — the host is never edited. When no profile is supplied, the host falls back to its default
 * (Source/JavaScript) renderer.
 *
 * Everything here is plain JSON so it can cross the runner→host channel.
 */

/** A CSS class hint for a rendered token, mapped by the host to its stepper colour classes. */
export type StepperTokenClass = "operator" | "identifier" | "literal" | "conditional";

/**
 * One piece of a node's render template. A template is an ordered list of parts; the host emits each
 * part in order, recursing into child nodes (which are themselves rendered via the profile), so the
 * generic interpreter never needs to know any language's grammar.
 *
 *  - `string` — a literal token, rendered as-is.
 *  - `{ token, cls? }` — a literal token with an optional style class (e.g. a keyword/operator).
 *  - `{ prop, cls? }` — the node's own (possibly dotted, e.g. `"id.name"`) property, as text.
 *  - `{ child, isRight? }` — recurse into `node[child]` (a single child node); a `null` child renders
 *    nothing. `isRight` marks the right operand of a binary/logical node so the host parenthesises
 *    with the correct associativity. Only `child` parts establish a parenthesisation context.
 *  - `{ list, sep, prefix?, cls? }` — render each node in the `node[list]` array, joined by `sep`;
 *    `prefix` is emitted before the list only when it is non-empty (e.g. a leading space).
 *  - `{ block }` — render the `node[block]` array as an indented suite (one statement per line).
 *  - `{ lines }` — render the `node[lines]` array one-per-line without extra indentation (the root).
 *  - `{ when, parts }` — render `parts` only when `node[when]` is present (e.g. an optional `else`).
 *  - `{ unless, parts }` — render `parts` only when `node[unless]` is absent/falsy; the inverse of
 *    `when`, for an "otherwise" branch (e.g. a value that renders one way when a field is present and
 *    another way when it isn't — see `image` below).
 *  - `{ image, altProp?, cls? }` — render `node[image]` as an inline `<img>`; renders nothing when
 *    the property is absent/falsy, or when it isn't a `data:` URL (e.g. `"data:image/png;base64,..."`)
 *    — only self-contained data URLs are rendered, never a live network URL, so a module can't turn a
 *    stepper render into a request to an arbitrary host. `altProp` optionally names another (possibly
 *    dotted) node property to use as the image's `alt`/`title` text. Lets a language display an opaque
 *    runtime value as a small picture inline in a step — e.g. a rendered thumbnail a module attaches
 *    to a graphics object — DrRacket-style, rather than only ever as text.
 */
export type SyntaxTemplatePart =
  | string
  | { token: string; cls?: StepperTokenClass }
  | { prop: string; cls?: StepperTokenClass }
  | { child: string; isRight?: boolean }
  | { list: string; sep: string; prefix?: string; cls?: StepperTokenClass }
  | { block: string }
  | { lines: string }
  | { when: string; parts: SyntaxTemplatePart[] }
  | { unless: string; parts: SyntaxTemplatePart[] }
  | { image: string; altProp?: string; cls?: StepperTokenClass };

/**
 * Declares a node type as a "function value" in the substitution model and where to read its name.
 *
 * A function value that carries a name is rendered collapsed as that name — a bold "mu-term" — with
 * a hover popover showing its full definition (the node's own template); an anonymous one is rendered
 * inline from its template. This mirrors Source's stepper, where a named (possibly recursive) function
 * shows as just its name and you hover to reveal the body, so a substituted function never expands its
 * whole body inline at every use. The host implements this generically from these rules, so any
 * language gets the behaviour by listing its function-value node types — no per-language host code.
 */
export interface FunctionValueRule {
  /** The node `type` this applies to, e.g. `"ArrowFunctionExpression"` or `"FunctionDeclaration"`. */
  type: string;
  /**
   * Dotted path to the property holding the mu-term name (e.g. `"name"`, or `"id.name"` for a node
   * whose name is on a child `id`). When the path resolves to an empty value the function is treated
   * as anonymous and rendered inline.
   */
  nameProp: string;
}

/**
 * Declares a node type that shows a fixed hover popover alongside its normal inline rendering.
 *
 * Unlike {@link FunctionValueRule} — whose popover is the node's own template, i.e. a function's body,
 * rendered on demand — this popover is a single line of *plain text* the language computed ahead of
 * time and stashed on the node (e.g. `"built-in function print"` for a builtin referenced as a value,
 * or `"module function stack"` for a name imported from a module): there is no body to expand, so
 * nothing is collapsed or replaced — the node still renders exactly as `templates[type]` produces it,
 * with a popover merely added on top. The host implements this generically from these rules, so any
 * language gets the behaviour for any node type by listing it here — no per-language host code.
 */
export interface HoverTextRule {
  /** The node `type` this applies to, e.g. `"Builtin"`. */
  type: string;
  /**
   * Dotted path to the node property holding the popover's already-formatted plain-text content (e.g.
   * `"hoverText"`, or `"decl.hoverText"` for a node whose text lives on a child). When the path
   * resolves to an empty value, no popover is added for that particular node.
   */
  textProp: string;
}

/**
 * A language's complete rendering rules: a per-node-type template table plus the precedence maps the
 * host uses to insert parentheses generically. Authored once per language and shipped by its runner.
 */
export interface SyntaxProfile {
  /** node `type` → render template. A type with no template renders as a `<type>` placeholder. */
  templates: Record<string, SyntaxTemplatePart[]>;
  /** Operator string → precedence, used for parenthesising binary/logical operands. */
  operatorPrecedence?: Record<string, number>;
  /** Node `type` → precedence, used for parenthesising sub-expressions. */
  expressionPrecedence?: Record<string, number>;
  /**
   * Node types that are function values in the substitution model. A named one renders as a
   * collapsed mu-term + hover popover instead of expanding its body inline. See {@link FunctionValueRule}.
   */
  functionValues?: FunctionValueRule[];
  /**
   * Node types that show a fixed-text hover popover alongside their normal inline rendering. See
   * {@link HoverTextRule}.
   */
  hoverText?: HoverTextRule[];
}

/* -------------------------------------------------------------------------- */
/*                              Channel protocol                              */
/* -------------------------------------------------------------------------- */

/** Runner → host: the computed evaluation steps for the most recent run. */
export interface StepperStepsMessage {
  type: "steps";
  steps: SerializedStepperStep[];
  /**
   * The language's rendering rules. Optional and run-level (the same for every step). When absent,
   * the host renders with its default (Source/JavaScript) syntax. See {@link SyntaxProfile}.
   */
  profile?: SyntaxProfile;
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
