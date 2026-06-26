import {
  RUNNER_ID,
  STEPPER_CHANNEL_ID,
  type SerializedStepperStep,
  type StepperMessage,
  type SyntaxProfile,
} from "@sourceacademy/common-stepper";
import type { IChannel, IConduit, IPlugin } from "@sourceacademy/conductor/conduit";

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

  constructor(_conduit: IConduit, [stepperChannel]: IChannel<StepperMessage>[]) {
    this.__stepperChannel = stepperChannel;
    this.__stepperChannel.subscribe(message => {
      // The host re-opened the stepper tab and wants the latest steps without a re-run.
      if (message.type === "request") {
        this.__stepperChannel.send({
          type: "steps",
          steps: this.__lastSteps,
          profile: this.getSyntaxProfile(),
        });
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
   * Computes the steps for `ast` and pushes them to the host plugin for display. Call this from the
   * evaluator after parsing a chunk, when stepping is desired. Errors are reported to the host
   * rather than thrown, so a stepping failure does not break the run.
   *
   * @param ast The freshly-parsed program AST.
   */
  async sendSteps(ast: TAst): Promise<void> {
    try {
      const steps = await this.getSteps(ast);
      this.__lastSteps = steps;
      this.__stepperChannel.send({ type: "steps", steps, profile: this.getSyntaxProfile() });
    } catch (error) {
      this.__stepperChannel.send({
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
