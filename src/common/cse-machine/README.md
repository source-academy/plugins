<h1 align="center"> CSE Machine </h1>

<p align="center">A language-agnostic protocol for the Source Academy CSE (Control–Stash–Environment) machine visualizer</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sourceacademy/common-cse-machine"><img src="https://img.shields.io/npm/v/@sourceacademy/common-cse-machine?color=1a2530&label=npm"></a>
  <a href="https://github.com/source-academy/plugins/tree/main/src/common/cse-machine"><img src="https://img.shields.io/badge/github-repo-blue?logo=github"></a>
</p>

## Features
- Language-agnostic snapshot protocol — any evaluator (js-slang, py-slang, …) can feed the same CSE machine visualization
- Structured-clone-safe types: everything that crosses the channel is plain JSON, so it survives `MessageChannel` / web-worker boundaries

## Installation
```bash
yarn add @sourceacademy/common-cse-machine
# OR
npm i @sourceacademy/common-cse-machine
# OR
pnpm add @sourceacademy/common-cse-machine
```

## Structure
This package ([`@sourceacademy/common-cse-machine`](https://github.com/source-academy/plugins/tree/main/src/common/cse-machine)) contains the shared constants and types required by both the runner-side and web-side plugin implementations.

These include:
- The IDs and channel name the two plugins use to find each other (`RUNNER_ID`, `WEB_ID`, `CSE_CHANNEL`, `CSE_DIRECTORY_ID`)
- The snapshot types that represent a complete evaluation step (`CseSnapshot`, `CseSnapshotMessage`)
- The serialized sub-types for each part of the machine (`CseSerializedInstruction`, `CseSerializedValue`, `CseSerializedEnvFrame`, `CseSerializedBinding`)

## Usage
Import types from `@sourceacademy/common-cse-machine` when implementing a language-specific serializer:

```ts
import type {
  CseSnapshot,
  CseSerializedValue,
  CseSerializedInstruction,
  CseSerializedEnvFrame,
} from '@sourceacademy/common-cse-machine';

function buildSnapshot(stepIndex: number): CseSnapshot {
  return {
    stepIndex,
    control: [ { displayText: "call f" } ],
    stash:   [ { displayValue: "42", label: "number" } ],
    environments: [ { id: "e0", name: "global", parentId: null, bindings: [], isActive: true } ],
    currentLine: 3,
  };
}
```

## Protocol Types

### Constants
| Name | Value | Description |
|------|-------|-------------|
| `CSE_CHANNEL` | `"__cse"` | The channel the runner and host plugins communicate over |
| `RUNNER_ID` | `"__runner_cse"` | ID of the runner-side plugin |
| `WEB_ID` | `"__web_cse"` | ID of the web/host-side plugin |
| `CSE_DIRECTORY_ID` | `"cse-machine"` | Plugin directory lookup key |
| `CSE_MESSAGE_TYPE_SNAPSHOTS` | `"snapshots"` | Discriminator for `CseSnapshotMessage` |

### `CseSnapshot`
A complete snapshot of the CSE machine at a single evaluation step. Arrays are ordered top-first (i.e. top of control/stash is index 0).

| Field | Type | Description |
|-------|------|-------------|
| `stepIndex` | `number` | 0-based index of this step within the run |
| `control` | `CseSerializedInstruction[]` | Control items, top first |
| `stash` | `CseSerializedValue[]` | Stash values, top first |
| `environments` | `CseSerializedEnvFrame[]` | All live environment frames at this step |
| `currentLine` | `number \| undefined` | 1-based source line of the most recently evaluated node |

### `CseSerializedValue`
A single value on the stash or bound in an environment frame.

| Field | Type | Description |
|-------|------|-------------|
| `displayValue` | `string` | Pre-rendered string shown in the visualizer |
| `label` | `string` | Coarse type tag, e.g. `"number"`, `"closure"`, `"list"` |
| `tag` | `string \| undefined` | Optional fine-grained tag for the visualizer |
| `metadata` | `unknown \| undefined` | Language-specific extras (e.g. closure frame id, array element refs) |

### `CseSerializedInstruction`
A single item on the control stack.

| Field | Type | Description |
|-------|------|-------------|
| `displayText` | `string` | Pre-rendered text shown on the control stack |
| `tag` | `string \| undefined` | Optional fine-grained tag for the visualizer |
| `metadata` | `unknown \| undefined` | Typed info used for animation dispatch (e.g. `instrType`, `numOfArgs`, `startLine`) |

### `CseSerializedEnvFrame`
A single environment frame.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Stable unique id within a run |
| `name` | `string` | Display name (e.g. `"global"`, function name) |
| `parentId` | `string \| null` | Lexical parent frame id, or `null` for the root |
| `closureFrameId` | `string \| undefined` | For a closure's frame: the id of the frame it was defined in |
| `bindings` | `CseSerializedBinding[]` | Name → value bindings in this frame |
| `heapObjects` | `CseSerializedValue[] \| undefined` | Anonymous heap objects (closures/arrays) not bound to any name |
| `isActive` | `boolean` | Whether this is the currently-active (innermost) frame |
| `isOnCallStack` | `boolean \| undefined` | Whether this frame is currently on the call stack |

### `CseSerializedBinding`
A single name → value binding within a frame.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | The bound name |
| `value` | `CseSerializedValue` | The bound value |
| `isConst` | `boolean \| undefined` | Whether the binding is a constant (e.g. `const` in Source) |

## Further reading
- To send snapshots from an evaluator, use [`@sourceacademy/runner-cse-machine`](https://github.com/source-academy/plugins/tree/main/src/runner/cse-machine)
- To receive snapshots in a host app, use [`@sourceacademy/web-cse-machine`](https://github.com/source-academy/plugins/tree/main/src/web/cse-machine)
- The [plugins wiki](https://github.com/source-academy/plugins/wiki) covers how Conductor plugins communicate
