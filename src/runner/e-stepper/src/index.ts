import {
  E_STEPPER_CHANNEL_ID,
  RUNNER_ID,
  type EStepperStep,
} from "@sourceacademy/common-e-stepper";
import { BaseStepperRunnerPlugin } from "@sourceacademy/runner-stepper";

/**
 * The language-agnostic runner half of the e-stepper (environment stepper).
 *
 * The e-stepper's channel protocol has the same shape as the stepper's (`steps`/`error`/`request`
 * messages, the same replay-on-request behaviour); only its steps carry more (frames, heap objects,
 * lookups — see `EStepperStep`) and it talks over its own channel, so a language can offer both
 * tools side by side. This class therefore reuses `BaseStepperRunnerPlugin` and changes just the
 * channel, the plugin id and the step type.
 *
 * A concrete language e-stepper (e.g. py-slang's) extends this class and implements
 * {@link getSteps}, whose only input is an AST. The evaluator drives stepping by calling
 * `sendSteps` with a freshly-parsed AST.
 *
 * @typeParam TAst The language's AST/root-node type accepted by {@link getSteps}.
 */
export abstract class BaseEStepperRunnerPlugin<
  TAst = unknown,
> extends BaseStepperRunnerPlugin<TAst> {
  static override readonly channelAttach = [E_STEPPER_CHANNEL_ID];
  override readonly id: string = RUNNER_ID;

  /**
   * The language-specific core of the e-stepper: given an AST, produce the ordered evaluation
   * steps, each with the frames and heap objects its program refers to. Must return plain,
   * structured-clone-able JSON.
   */
  abstract override getSteps(ast: TAst): EStepperStep[] | Promise<EStepperStep[]>;
}
