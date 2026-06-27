<h1 align="center"> CSE Machine </h1>

<p align="center">Runner-side plugin for the Source Academy CSE machine — sends evaluation snapshots to the host</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sourceacademy/runner-cse-machine"><img src="https://img.shields.io/npm/v/@sourceacademy/runner-cse-machine?color=1a2530&label=npm"></a>
  <a href="https://github.com/source-academy/plugins/tree/main/src/runner/cse-machine"><img src="https://img.shields.io/badge/github-repo-blue?logo=github"></a>
</p>

## Features
- Transports a complete run's worth of CSE snapshots from the evaluator (worker) to the host app (browser) over a Conductor channel
- Language-agnostic: any evaluator can use it as long as it serializes its state into `CseSnapshot`s

## Installation
```bash
yarn add @sourceacademy/runner-cse-machine
# OR
npm i @sourceacademy/runner-cse-machine
# OR
pnpm add @sourceacademy/runner-cse-machine
```

## Structure
This package ([`@sourceacademy/runner-cse-machine`](https://github.com/source-academy/plugins/tree/main/src/runner/cse-machine)) contains the `CseMachinePlugin` class — a Conductor runner plugin that an evaluator registers and calls after each run to forward snapshots to the host.

The plugin owns only the transport. Serializing a language's control/stash/environment into [`CseSnapshot`](https://github.com/source-academy/plugins/tree/main/src/common/cse-machine/README.md#csesnapshot)s is the evaluator's responsibility and stays in the evaluator repo.

### API Reference
| Name | Description |
|------|-------------|
| `sendSnapshots(snapshots: CseSnapshot[]): void` | Send the full batch of snapshots for a completed run to the host plugin. Call this once per run after all steps have been collected. |

## Usage
After installation, import `CseMachinePlugin` and register it with the Conductor evaluator. After each run, collect your language-specific snapshots, serialize them into [`CseSnapshot`](https://github.com/source-academy/plugins/tree/main/src/common/cse-machine/README.md#csesnapshot)s, and call `sendSnapshots`.

```ts
import { CseMachinePlugin } from '@sourceacademy/runner-cse-machine';
import type { CseSnapshot } from '@sourceacademy/common-cse-machine';

// Register the plugin when setting up the evaluator
const cseMachinePlugin = conductorContext.getPlugin(CseMachinePlugin);

// After a run completes, serialize each step into a CseSnapshot
const snapshots: CseSnapshot[] = steps.map((step, i) => ({
  stepIndex: i,
  control: step.control.map(serializeControlItem),
  stash: step.stash.map(serializeValue),
  environments: serializeEnvChain(step.environments),
  currentLine: step.currentNode?.line,
}));

cseMachinePlugin.sendSnapshots(snapshots);
```

For a full example of how to serialize a language's control/stash/environment into `CseSnapshot`s, see the [py-slang `PyCseMachinePlugin`](https://github.com/source-academy/py-slang/blob/main/src/conductor/plugins/PyCseMachinePlugin.ts).

## Further reading
- For the shared protocol types and IDs, see [`@sourceacademy/common-cse-machine`](https://github.com/source-academy/plugins/tree/main/src/common/cse-machine)
- For the host-side plugin that renders snapshots, see [`@sourceacademy/web-cse-machine`](https://github.com/source-academy/plugins/tree/main/src/web/cse-machine)
- The [plugins wiki](https://github.com/source-academy/plugins/wiki) covers how Conductor plugins communicate
