# @sourceacademy/runner-cse-machine

## 3.1.1

### Patch Changes

- 9186564: The package declares the Apache License 2.0 (its metadata said ISC) and ships the licence text; the code is unchanged.
- Updated dependencies [9186564]
  - @sourceacademy/common-cse-machine@0.6.1

## 3.1.0

### Minor Changes

- d9a22e7: The CSE machine can send the snapshots of a run in batches while it runs (`CseSnapshotBatchMessage`: an `index` that continues from the batch before, and `end` on the last one: complete, or cut off with the reason), so that a run that is stopped, or never finishes, leaves the snapshots computed so far. An evaluator calls `sendBatch` for each batch and `endRun` when the run ends (`sendSnapshots`, a whole run at the end, still works). The host plugin hands `receiveSnapshots` the snapshots so far on each batch, and `receiveEnd` (new, optional to implement) how the run ended

### Patch Changes

- Updated dependencies [d9a22e7]
  - @sourceacademy/common-cse-machine@0.5.0

## 3.0.0

### Minor Changes

- 6672299: Add `breakpointSteps` to the CSE snapshot protocol: a run-level array of 0-based step indices
  where a breakpoint (e.g. Python's `breakpoint()`) sits on top of the control. `CseMachinePlugin.sendSnapshots`
  takes it as an optional second argument (defaulting to `[]`); `CseMachineHostPlugin.receiveSnapshots`
  now receives it as a second parameter. Enables host apps to wire breakpoint-navigation controls
  for CSE-machine-based evaluators, matching the stepper's existing `redexNodeType` contract.

### Patch Changes

- Updated dependencies [6672299]
  - @sourceacademy/common-cse-machine@0.3.0

## 2.0.0

### Patch Changes

- Updated dependencies [372c5c9]
  - @sourceacademy/common-cse-machine@0.2.0

## 1.0.0

### Minor Changes

- 79ca2e6: Add language-agnostic CSE machine plugin packages for the Conductor framework.
  - `@sourceacademy/common-cse-machine`: shared protocol — channel ID, plugin IDs, and the `CseSnapshot` type hierarchy
  - `@sourceacademy/runner-cse-machine`: runner-side plugin that serialises and sends CSE snapshots over the CSE channel
  - `@sourceacademy/web-cse-machine`: host-side plugin that receives CSE snapshots and forwards them to the visualiser via `receiveSnapshots`

### Patch Changes

- Updated dependencies [79ca2e6]
  - @sourceacademy/common-cse-machine@0.1.0
