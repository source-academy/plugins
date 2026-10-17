# @sourceacademy/runner-e-stepper

Language-agnostic runner plugin for the Source Academy environment stepper ("e-stepper"). See
`@sourceacademy/common-e-stepper` for the protocol.

A language extends `BaseEStepperRunnerPlugin<TAst>` and implements `getSteps(ast)`, returning
`EStepperStep`s; its evaluator registers the plugin and calls `sendSteps(ast)` after parsing. The
class reuses the stepper's `BaseStepperRunnerPlugin` (replay on request, error reporting, shipping a
`SyntaxProfile`) and only changes the channel, the plugin id and the step type, so a language can
offer the stepper and the e-stepper side by side.

```ts
import { BaseEStepperRunnerPlugin } from "@sourceacademy/runner-e-stepper";
import type { EStepperStep } from "@sourceacademy/common-e-stepper";

class MyEStepper extends BaseEStepperRunnerPlugin<MyAst> {
  getSteps(ast: MyAst): EStepperStep[] {
    // reduce the program, recording frames and heap objects at each step
  }
}
```
