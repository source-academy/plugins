<h1 align="center"> CSE Machine </h1>

<p align="center">Web/host-side plugin for the Source Academy CSE machine — receives evaluation snapshots for rendering</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sourceacademy/web-cse-machine"><img src="https://img.shields.io/npm/v/@sourceacademy/web-cse-machine?color=1a2530&label=npm"></a>
  <a href="https://github.com/source-academy/plugins/tree/main/src/web/cse-machine"><img src="https://img.shields.io/badge/github-repo-blue?logo=github"></a>
</p>

## Features
- Subscribes to the CSE channel and delivers snapshot batches to the host app's visualization layer
- Language-agnostic: works with any evaluator that sends `CseSnapshot`s via the runner plugin
- Re-exports all protocol types from `@sourceacademy/common-cse-machine` so host apps need only one import

## Installation
In production, use the [plugin directory](https://github.com/source-academy/plugin-directory) hosted on [GitHub Pages](https://source-academy.github.io/plugins/directory.json). It contains a list of all plugins available in this monorepo. Your host app should be able to load plugins from the plugin directory (the Source Academy frontend does).

For locally hosting the plugin repository, run `yarn build` at the root of the repository. Then serve the plugin directory with:
```bash
yarn dlx serve --cors dist/ -p 1915
```
The plugin directory will be available at `http://localhost:1915/directory.json`.

To install the package directly:
```bash
yarn add @sourceacademy/web-cse-machine
# OR
npm i @sourceacademy/web-cse-machine
# OR
pnpm add @sourceacademy/web-cse-machine
```

## Structure
This package ([`@sourceacademy/web-cse-machine`](https://github.com/source-academy/plugins/tree/main/src/web/cse-machine)) contains the `CseMachineHostPlugin` abstract class — a Conductor host plugin that subscribes to the [`CSE_CHANNEL`](https://github.com/source-academy/plugins/tree/main/src/common/cse-machine/README.md#constants) and delivers received [`CseSnapshot`](https://github.com/source-academy/plugins/tree/main/src/common/cse-machine/README.md#csesnapshot) batches to the host app.

The plugin owns only the transport/receipt. Wiring snapshots into the actual visualization layer (adapter + renderer) is the host app's responsibility and stays in the host repo, because it is tightly coupled to the host's existing CSE machine UI.

### API Reference
| Name | Description |
|------|-------------|
| `abstract receiveSnapshots(snapshots: CseSnapshot[]): void` | Called by the plugin each time a batch of snapshots arrives. Implement this in your host app to wire the snapshots into your visualization layer. |

## Usage
Extend `CseMachineHostPlugin` and implement `receiveSnapshots` to connect incoming snapshots to your rendering layer:

```ts
import { CseMachineHostPlugin } from '@sourceacademy/web-cse-machine';
import type { CseSnapshot } from '@sourceacademy/web-cse-machine'; // re-exported from common

export class MyCseMachinePlugin extends CseMachineHostPlugin {
  receiveSnapshots(snapshots: CseSnapshot[]): void {
    // Hand snapshots to your visualization layer, e.g.:
    cseMachineStore.setSnapshots(snapshots);
  }
}
```

For a full example of how the Source Academy frontend wires this into its CSE machine UI, see the [frontend source](https://github.com/source-academy/frontend).

## Further reading
- For the shared protocol types and IDs, see [`@sourceacademy/common-cse-machine`](https://github.com/source-academy/plugins/tree/main/src/common/cse-machine)
- For the runner-side plugin that sends snapshots, see [`@sourceacademy/runner-cse-machine`](https://github.com/source-academy/plugins/tree/main/src/runner/cse-machine)
- The [plugins wiki](https://github.com/source-academy/plugins/wiki) covers how Conductor plugins communicate
