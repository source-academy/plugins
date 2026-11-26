import {
  RUNNER_ID,
  STEPPER_CHANNEL_ID,
  type SerializedStepperStep,
  type StepperMessage,
  type SyntaxProfile,
  type TraceEnd,
} from "@sourceacademy/common-stepper";
import type { IChannel, IConduit, IPlugin } from "@sourceacademy/conductor/conduit";

/** The batches of steps of a run, as a language that streams its steps provides them. */
export type StepBatches =
  Iterable<SerializedStepperStep[]> | AsyncIterable<SerializedStepperStep[]>;

/**
 * The language-agnostic runner half of the stepper.
 *
 * This base class owns everything that is *not* language-specific: the channel wiring, the
 * request/replay protocol with the host, error reporting, and caching of the most recent steps.
 *
 * A concrete language stepper (e.g. js-slang, py-slang) extends this class and implements the
 * single abstract method {@link getSteps}, whose **only input is an AST**. The class is generic
 * over the AST type `TAst` so each language can use its own node representation while the core
 * stays language-agnostic.
 *
 * The evaluator drives stepping by calling {@link sendSteps} with a freshly-parsed AST (parsing is
 * the evaluator's/language's concern, never this plugin's).
 *
 * @typeParam TAst The language's AST/root-node type accepted by {@link getSteps}.
 */
export abstract class BaseStepperRunnerPlugin<TAst = unknown> implements IPlugin {
  static readonly channelAttach = [STEPPER_CHANNEL_ID];
  readonly id: string = RUNNER_ID;

  private readonly __stepperChannel: IChannel<StepperMessage>;
  /** The steps from the most recent {@link sendSteps} call, replayed on host request. */
  private __lastSteps: SerializedStepperStep[] = [];
  /** How the most recent run was sent: in batches (with the way it ended, if it did) or whole. */
  private __lastRun: { streamed: false } | { streamed: true; end?: TraceEnd } = { streamed: false };

  constructor(_conduit: IConduit, [stepperChannel]: IChannel<StepperMessage>[]) {
    this.__stepperChannel = stepperChannel;
    this.__stepperChannel.subscribe(message => {
      // The host re-opened the stepper tab and wants the latest steps without a re-run.
      if (message.type === "request") {
        this.__stepperChannel.send(
          this.__lastRun.streamed
            ? {
                type: "batch",
                index: 0,
                steps: this.__lastSteps,
                profile: this.getSyntaxProfile(),
                end: this.__lastRun.end,
              }
            : { type: "steps", steps: this.__lastSteps, profile: this.getSyntaxProfile() },
        );
      }
    });
  }

  /**
   * The language's rendering rules, shipped to the host so it can display this language's surface
   * syntax with no per-language host code. The default returns `undefined`, leaving the host on its
   * built-in (Source/JavaScript) renderer; a concrete language overrides this to return its profile.
   * See `SyntaxProfile`.
   */
  protected getSyntaxProfile(): SyntaxProfile | undefined {
    return undefined;
  }

  /**
   * The language-specific core of the stepper: given an AST, produce the ordered evaluation steps
   * (each a serialized AST plus markers/explanations). Must return plain, structured-clone-able
   * JSON — see `SerializedStepperStep`.
   *
   * @param ast The program AST to step through.
   * @returns The evaluation steps, synchronously or as a promise.
   */
  abstract getSteps(ast: TAst): SerializedStepperStep[] | Promise<SerializedStepperStep[]>;

  /**
   * The steps of `ast` in batches, as they are computed, for a language whose steps can be had
   * incrementally. The default returns `undefined`: the language does not stream, and
   * {@link sendSteps} uses {@link getSteps} and sends the whole trace at the end.
   *
   * A language that streams returns an (async) generator of batches, which the runner sends as they
   * come, so that a run that is stopped, or never finishes, still leaves the steps computed so far.
   * Its return value, if any, says how the trace ended (see {@link TraceEnd}): return
   * `{ status: "cut-off", reason }` when the language stops recording before the program's end, such
   * as at a limit of its own. A generator that returns nothing ended its trace completely.
   *
   * Each batch must be plain, structured-clone-able JSON, like the result of {@link getSteps}.
   */
  protected getStepBatches(_ast: TAst): StepBatches | undefined {
    return undefined;
  }

  /**
   * Computes the steps for `ast` and pushes them to the host plugin for display: in batches while
   * they are computed if the language streams (see {@link getStepBatches}), otherwise as one message
   * at the end. Call this from the evaluator after parsing a chunk, when stepping is desired. Errors
   * are reported to the host rather than thrown, so a stepping failure does not break the run.
   *
   * @param ast The freshly-parsed program AST.
   */
  async sendSteps(ast: TAst): Promise<void> {
    let batches: StepBatches | undefined;
    try {
      batches = this.getStepBatches(ast);
      if (batches === undefined) {
        const steps = await this.getSteps(ast);
        this.__lastSteps = steps;
        this.__lastRun = { streamed: false };
        this.__stepperChannel.send({ type: "steps", steps, profile: this.getSyntaxProfile() });
        return;
      }
    } catch (error) {
      this.__sendError(error);
      return;
    }
    await this.__sendBatches(batches);
  }

  /** Sends the batches of a run as they come, and how the run ended. */
  private async __sendBatches(batches: StepBatches): Promise<void> {
    this.__lastSteps = [];
    this.__lastRun = { streamed: true };
    // Iterated by hand to get the generator's return value, which says how the trace ended.
    const iterator:
      | Iterator<SerializedStepperStep[], TraceEnd | void>
      | AsyncIterator<SerializedStepperStep[], TraceEnd | void> =
      Symbol.asyncIterator in batches
        ? (batches as AsyncIterable<SerializedStepperStep[]>)[Symbol.asyncIterator]()
        : (batches as Iterable<SerializedStepperStep[]>)[Symbol.iterator]();
    let sentAny = false;
    try {
      for (;;) {
        const result = await iterator.next();
        if (result.done) {
          this.__finishRun(result.value ?? { status: "complete" });
          return;
        }
        if (result.value.length === 0) continue;
        this.__stepperChannel.send({
          type: "batch",
          index: this.__lastSteps.length,
          steps: result.value,
          profile: this.__lastSteps.length === 0 ? this.getSyntaxProfile() : undefined,
        });
        this.__lastSteps = this.__lastSteps.concat(result.value);
        sentAny = true;
      }
    } catch (error) {
      if (!sentAny) {
        this.__lastRun = { streamed: false };
        this.__sendError(error);
        return;
      }
      // The steps so far stay; the trace ends here, and says why.
      this.__finishRun({
        status: "cut-off",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Ends the run that is being sent: an empty last batch, since the end is known only after the last step. */
  private __finishRun(end: TraceEnd): void {
    this.__lastRun = { streamed: true, end };
    this.__stepperChannel.send({
      type: "batch",
      index: this.__lastSteps.length,
      steps: [],
      // A run that had no steps at all still starts the run afresh at the host, with its profile.
      profile: this.__lastSteps.length === 0 ? this.getSyntaxProfile() : undefined,
      end,
    });
  }

  private __sendError(error: unknown): void {
    this.__stepperChannel.send({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
