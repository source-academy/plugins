# @sourceacademy/common-e-stepper

## 0.0.2

### Patch Changes

- ddd6b9e: Add `ICseDiagramService` and `IHostServices` to `common-cse-machine`: a host can lend web plugins its CSE machine visualization, passed as `registerPlugin(PluginClass, tabService, hostServices)`. Add an optional `cse` snapshot to `EStepperStep`, so a host can draw an e-stepper step's environments with that visualization. A value may carry an `objectId` naming the heap object it refers to, and `CseDiagramViewProps` takes the `hovered` object and an `onHover` callback, so the plugin and the host's diagram highlight the same object.
- Updated dependencies [1019b58]
- Updated dependencies [ddd6b9e]
- Updated dependencies [7574efc]
  - @sourceacademy/common-cse-machine@0.3.1

## 0.0.1

### Patch Changes

- dfd2547: Add the environment stepper ("e-stepper") protocol and runner base. `common-e-stepper` defines the channel and plugin ids, the step type (`EStepperStep`: a stepper step plus environment frames, heap objects, the active frame and the step's lookups) and the `EnvBlock`/`Ref` program node types that refer into them. `runner-e-stepper` provides `BaseEStepperRunnerPlugin`, which reuses the stepper's runner base on the e-stepper's own channel.
