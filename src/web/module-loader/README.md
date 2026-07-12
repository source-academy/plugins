<h1 align="center"> Module Loader </h1>

<p align="center">Host-side plugin to load Source Academy modules</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sourceacademy/web-module-loader"><img src="https://img.shields.io/npm/v/@sourceacademy/web-module-loader?color=1a2530&label=npm"></a>
  <a href="https://github.com/source-academy/plugins/tree/main/src/web/module-loader"><img src="https://img.shields.io/badge/github-repo-blue?logo=github"></a>
</p>

## Features
- Provides an interface to load modules with a module ID, as well as the location of tabs on the host-side
- Accepts a module directory URL from the host app

## Installation
To install the package, use:
```bash
yarn add @sourceacademy/web-module-loader
# OR
npm i @sourceacademy/web-module-loader
# OR
pnpm add @sourceacademy/web-module-loader
```

## Structure
This package ([`@sourceacademy/web-module-loader`](https://github.com/source-academy/plugins/tree/main/src/web/module-loader)) contains the `ModuleLoaderWebPlugin` class — a Conductor host plugin that subscribes to a Conductor channel and delivers module information to the host app.

### API Reference
| Name | Description |
|------|-------------|
| `instance` | The singleton instance of the plugin. |
| `onModuleDirectoryURLChange(newUrl: string): void` | To be called during module directory URL changes. |
| `getModuleTabLocation(tabName: string): string | null` | Returns the location of the specified module tab, or null if not found. |

## Usage
During the host-side Conductor initialisation, register the class with the conduit.

```ts
...
hostPlugin.registerPlugin(ModuleLoaderWebPlugin);
ModuleLoaderWebPlugin.instance.onModuleDirectoryURLChange(moduleDirectoryURL);
...
```

Then, on module directory changes, call `onModuleDirectoryURLChange` to update the module directory URL. 

```ts
export const flagDirectoryModulesUrl = createFeatureFlag(
  'directory.modules.url',
  'https://source-academy.github.io/modules-conductor/modules.json',
  'The URL where the module directory may be found.',
  // eslint-disable-next-line require-yield
  function* (url: string) {
    ModuleLoaderWebPlugin.instance?.onModuleDirectoryURLChange(url);
  },
);
```

To receive the location of a module tab, call `getModuleTabLocation` with the tab name.

```ts
const tabLocation = ModuleLoaderWebPlugin.instance.getModuleTabLocation(tabName);
```

## Further reading
- For the shared protocol types and IDs, see [`@sourceacademy/common-module-loader`](https://github.com/source-academy/plugins/tree/main/src/common/module-loader)
- For the runner-side plugin that sends snapshots, see [`@sourceacademy/runner-module-loader`](https://github.com/source-academy/plugins/tree/main/src/runner/module-loader)
- The [plugins wiki](https://github.com/source-academy/plugins/wiki) covers how Conductor plugins communicate
