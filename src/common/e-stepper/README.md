# @sourceacademy/common-e-stepper

Shared, language-agnostic protocol for the Source Academy environment stepper ("e-stepper"): a
cross between the substitution stepper and the CSE machine. Each step pairs the program, rewritten
one reduction at a time as in the stepper, with the environment frames and heap objects it refers
to. Design note: [docs/e-stepper.md](https://github.com/source-academy/py-slang/blob/main/docs/e-stepper.md).

This package contains:

- the ids the runner and web plugins use to find each other (`E_STEPPER_CHANNEL_ID`, `RUNNER_ID`,
  `WEB_ID`, `E_STEPPER_DIRECTORY_ID`),
- the step type `EStepperStep`: a `SerializedStepperStep` (from `@sourceacademy/common-stepper`)
  plus `frames`, `heap`, `activeFrameId` and `lookups`,
- the two program node types that refer into the store, rendered by the host itself:
  `EnvBlock { envId, body }` (a function body under evaluation in frame `envId`) and
  `Ref { objectId }` (a reference to a heap object), with type guards,
- the channel messages (`EStepperMessage`), which have the same shape as the stepper's.

To produce steps from a language, extend `BaseEStepperRunnerPlugin` from
`@sourceacademy/runner-e-stepper`.
