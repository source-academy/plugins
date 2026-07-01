<h1 align="center"> Module Loader </h1>

<p align="center">A protocol to load Source Academy modules</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sourceacademy/common-module-loader"><img src="https://img.shields.io/npm/v/@sourceacademy/common-module-loader?color=1a2530&label=npm"></a>
  <a href="https://github.com/source-academy/plugins/tree/main/src/common/module-loader"><img src="https://img.shields.io/badge/github-repo-blue?logo=github"></a>
</p>

## Features
- Protocol for loading Source Academy modules on the runner side, from a changeable module directory on the host side

## Installation
```bash
yarn add @sourceacademy/common-module-loader
# OR
npm i @sourceacademy/common-module-loader
# OR
pnpm add @sourceacademy/common-module-loader
```

## Structure
This package ([`@sourceacademy/common-module-loader`](https://github.com/source-academy/plugins/tree/main/src/common/module-loader)) contains the shared constants and types required by both the runner-side and web-side plugin implementations.

These include:
- The IDs and channel name the two plugins use to find each other (`RUNNER_ID`, `WEB_ID`, `CHANNEL_ID`)
- The message type (`ModuleLoaderMessage`) sent between the two plugins

## Usage
Ideally, you should not need to use this package directly. Instead, use the runner-side plugin ([`@sourceacademy/runner-module-loader`](https://github.com/source-academy/plugins/tree/main/src/runner/module-loader)) or the web-side plugin ([`@sourceacademy/web-module-loader`](https://github.com/source-academy/plugins/tree/main/src/web/module-loader)).

However, if you do need to use this package directly, you can import the constants and types as follows:

```ts
import type { ModuleLoaderMessage } from '@sourceacademy/common-module-loader';
...
```

## Further reading
- To load a module, use [`@sourceacademy/runner-module-loader`](https://github.com/source-academy/plugins/tree/main/src/runner/module-loader)
- To provide the module directory URL, use [`@sourceacademy/web-module-loader`](https://github.com/source-academy/plugins/tree/main/src/web/module-loader)
- The [plugins wiki](https://github.com/source-academy/plugins/wiki) covers how Conductor plugins communicate
