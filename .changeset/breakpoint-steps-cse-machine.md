---
"@sourceacademy/common-cse-machine": minor
"@sourceacademy/runner-cse-machine": minor
"@sourceacademy/web-cse-machine": minor
---

Add `breakpointSteps` to the CSE snapshot protocol: a run-level array of 0-based step indices
where a breakpoint (e.g. Python's `breakpoint()`) sits on top of the control. `CseMachinePlugin.sendSnapshots`
takes it as an optional second argument (defaulting to `[]`); `CseMachineHostPlugin.receiveSnapshots`
now receives it as a second parameter. Enables host apps to wire breakpoint-navigation controls
for CSE-machine-based evaluators, matching the stepper's existing `redexNodeType` contract.
