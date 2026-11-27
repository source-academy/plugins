# @sourceacademy/common-e-stepper

## 0.1.1

### Patch Changes

- d2d57de: The `frames` and `heap` of a step need not repeat the frames and objects that became unreachable in earlier steps: a host works out the whole store from the step and the ones before it (py-slang#611)

## 0.1.0

### Minor Changes

- 5ab3224: A stepper or e-stepper can send the trace of a run in batches while it runs (a `batch` message with its `index`, and `end` on the last one: complete, or cut off with the reason), so that a run that is stopped, or never finishes, leaves the steps computed so far. A language streams by overriding `getStepBatches` with a generator of batches, whose return value is how the trace ended; one that does not keeps sending one `steps` message at the end. A request replays a streamed run as one batch with its end

### Patch Changes

- Updated dependencies [d9a22e7]
- Updated dependencies [5ab3224]
  - @sourceacademy/common-cse-machine@0.5.0
  - @sourceacademy/common-stepper@0.1.0

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
