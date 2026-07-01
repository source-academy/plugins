<h1 align="center">Module Loader</h1>

<p align="center">Runner-side plugin for loading Source Academy modules</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sourceacademy/runner-module-loader"><img src="https://img.shields.io/npm/v/@sourceacademy/runner-module-loader?color=1a2530&label=npm"></a>
  <a href="https://github.com/source-academy/plugins/tree/main/src/runner/module-loader"><img src="https://img.shields.io/badge/github-repo-blue?logo=github"></a>
</p>

## Features
The plugin provides an interface to load modules with a module ID

## Installation
```bash
yarn add @sourceacademy/runner-module-loader
# OR
npm i @sourceacademy/runner-module-loader
# OR
pnpm add @sourceacademy/runner-module-loader
```

## Structure
This package ([`@sourceacademy/runner-module-loader`](https://github.com/source-academy/plugins/tree/main/src/runner/module-loader)) contains the `ModuleLoaderRunnerPlugin` class — a Conductor runner plugin that an evaluator can call to load modules.

### API Reference
| Name | Description |
|------|-------------|
| `instance` | The singleton instance of the plugin. | 
| `async requestModule(moduleName: string): Promise<IModulePlugin>` | Request a module by name from the host plugin. Rejects with an error if the module is not found. |

## Usage
After installation, import `ModuleLoaderRunnerPlugin` and register it with the Conductor evaluator. When evaluating `import` statements, call `requestModule` to load the module.

```ts
...
const pluginObj = await ModuleLoaderRunnerPlugin.instance.requestModule(moduleName);
context.nativeStorage.loadedModules[moduleName] = Object.fromEntries(
    pluginObj?.exports.map(t => [t.symbol, t]) || [],
);
...
```

## Further reading
- For the shared protocol types and IDs, see [`@sourceacademy/common-module-loader`](https://github.com/source-academy/plugins/tree/main/src/common/module-loader)
- For the host-side plugin that accepts the module directory URL, see [`@sourceacademy/web-module-loader`](https://github.com/source-academy/plugins/tree/main/src/web/module-loader)
- The [plugins wiki](https://github.com/source-academy/plugins/wiki) covers how Conductor plugins communicate
