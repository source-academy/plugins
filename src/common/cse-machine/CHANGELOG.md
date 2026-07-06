# @sourceacademy/common-cse-machine

## 0.2.0

### Minor Changes

- 372c5c9: Add optional `globalNames` field to `CseSerializedEnvFrame`, letting an evaluator (e.g. py-slang) mark names in a call frame that resolve via the global frame instead of the usual enclosing-scope chain (e.g. Python's `global` statement).

## 0.1.0

### Minor Changes

- 79ca2e6: Add language-agnostic CSE machine plugin packages for the Conductor framework.
  - `@sourceacademy/common-cse-machine`: shared protocol — channel ID, plugin IDs, and the `CseSnapshot` type hierarchy
  - `@sourceacademy/runner-cse-machine`: runner-side plugin that serialises and sends CSE snapshots over the CSE channel
  - `@sourceacademy/web-cse-machine`: host-side plugin that receives CSE snapshots and forwards them to the visualiser via `receiveSnapshots`
