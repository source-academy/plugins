# @sourceacademy/common-e-stepper

## 0.0.1

### Patch Changes

- dfd2547: Add the environment stepper ("e-stepper") protocol and runner base. `common-e-stepper` defines the channel and plugin ids, the step type (`EStepperStep`: a stepper step plus environment frames, heap objects, the active frame and the step's lookups) and the `EnvBlock`/`Ref` program node types that refer into them. `runner-e-stepper` provides `BaseEStepperRunnerPlugin`, which reuses the stepper's runner base on the e-stepper's own channel.
