# @sourceacademy/web-cse-machine

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
