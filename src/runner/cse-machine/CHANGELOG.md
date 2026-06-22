# @sourceacademy/runner-cse-machine

## 1.0.0

### Minor Changes

- 79ca2e6: Add language-agnostic CSE machine plugin packages for the Conductor framework.
  - `@sourceacademy/common-cse-machine`: shared protocol — channel ID, plugin IDs, and the `CseSnapshot` type hierarchy
  - `@sourceacademy/runner-cse-machine`: runner-side plugin that serialises and sends CSE snapshots over the CSE channel
  - `@sourceacademy/web-cse-machine`: host-side plugin that receives CSE snapshots and forwards them to the visualiser via `receiveSnapshots`

### Patch Changes

- Updated dependencies [79ca2e6]
  - @sourceacademy/common-cse-machine@0.1.0
