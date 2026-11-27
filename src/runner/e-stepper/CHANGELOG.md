# @sourceacademy/runner-e-stepper

## 0.0.3

### Patch Changes

- 9186564: The package declares the Apache License 2.0 (its metadata said ISC) and ships the licence text; the code is unchanged.
- Updated dependencies [9186564]
  - @sourceacademy/common-e-stepper@0.1.2
  - @sourceacademy/common-stepper@0.1.1
  - @sourceacademy/runner-stepper@0.1.1

## 0.0.2

### Patch Changes

- 79413aa: Require the stepper packages that can send a trace in batches (`common-stepper` and `runner-stepper` 0.1.0), which the e-stepper runner extends and so offers to its languages
- Updated dependencies [5ab3224]
  - @sourceacademy/common-stepper@0.1.0
  - @sourceacademy/common-e-stepper@0.1.0
  - @sourceacademy/runner-stepper@0.1.0

## 0.0.1

### Patch Changes

- dfd2547: Add the environment stepper ("e-stepper") protocol and runner base. `common-e-stepper` defines the channel and plugin ids, the step type (`EStepperStep`: a stepper step plus environment frames, heap objects, the active frame and the step's lookups) and the `EnvBlock`/`Ref` program node types that refer into them. `runner-e-stepper` provides `BaseEStepperRunnerPlugin`, which reuses the stepper's runner base on the e-stepper's own channel.
- Updated dependencies [dfd2547]
  - @sourceacademy/common-e-stepper@0.0.1
