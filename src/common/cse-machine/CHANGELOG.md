# @sourceacademy/common-cse-machine

## 0.3.1

### Patch Changes

- 1019b58: `CseDiagramViewProps` takes `frameColors` (frame colours by frame id; the active frame keeps its colour, with a wider outline), and `hoveredFrame` / `onHoverFrame`, so a plugin and the host's diagram highlight the same frame.
- ddd6b9e: Add `ICseDiagramService` and `IHostServices` to `common-cse-machine`: a host can lend web plugins its CSE machine visualization, passed as `registerPlugin(PluginClass, tabService, hostServices)`. Add an optional `cse` snapshot to `EStepperStep`, so a host can draw an e-stepper step's environments with that visualization. A value may carry an `objectId` naming the heap object it refers to, and `CseDiagramViewProps` takes the `hovered` object and an `onHover` callback, so the plugin and the host's diagram highlight the same object.
- 7574efc: Add an optional `label` to `CseSerializedEnvFrame`: the frame's heading, chosen by the evaluator (e.g. Python's `"Global"` and `"Built-ins"`) instead of derived by the host from the frame's `name`.

## 0.3.0

### Minor Changes

- 6672299: Add `breakpointSteps` to the CSE snapshot protocol: a run-level array of 0-based step indices
  where a breakpoint (e.g. Python's `breakpoint()`) sits on top of the control. `CseMachinePlugin.sendSnapshots`
  takes it as an optional second argument (defaulting to `[]`); `CseMachineHostPlugin.receiveSnapshots`
  now receives it as a second parameter. Enables host apps to wire breakpoint-navigation controls
  for CSE-machine-based evaluators, matching the stepper's existing `redexNodeType` contract.

## 0.2.0

### Minor Changes

- 372c5c9: Add optional `globalNames` field to `CseSerializedEnvFrame`, letting an evaluator (e.g. py-slang) mark names in a call frame that resolve via the global frame instead of the usual enclosing-scope chain (e.g. Python's `global` statement).

## 0.1.0

### Minor Changes

- 79ca2e6: Add language-agnostic CSE machine plugin packages for the Conductor framework.
  - `@sourceacademy/common-cse-machine`: shared protocol — channel ID, plugin IDs, and the `CseSnapshot` type hierarchy
  - `@sourceacademy/runner-cse-machine`: runner-side plugin that serialises and sends CSE snapshots over the CSE channel
  - `@sourceacademy/web-cse-machine`: host-side plugin that receives CSE snapshots and forwards them to the visualiser via `receiveSnapshots`
