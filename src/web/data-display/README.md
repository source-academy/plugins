<h1 align="center"> Data Visualization </h1>

<p align="center">A language agnostic interface to visualise lists, trees and other data structures<br/><img src="https://raw.githubusercontent.com/source-academy/plugins/main/src/common/data-display/docs/image.png" alt="An image of the data visualization tool"/></p>

<p align="center">
  <a href="https://github.com/source-academy/plugins/tree/main/src/web/data-display"><img src="https://img.shields.io/badge/github-repo-blue?logo=github"></a>
<p>

## Features
- [Box-and-pointer diagrams](https://sourceacademy.org/sicpjs/2.2) to visualize lists and array structures
- Visualisations for trees (including binary trees or more general trees)

## Installation
In production, use the [plugin directory](https://github.com/source-academy/plugin-directory) hosted on [GitHub Pages](https://source-academy.github.io/plugins/directory.json). It contains a list of all the plugins available in this monorepo. Your host plugin should have the capability to load plugins from the plugin directory (the Source Academy frontend does). 

For locally hosting the plugin repository, run `yarn build` at the root of the repository. Then, serve the plugin directory with
```bash
yarn dlx serve --cors dist/ -p 1915
```
The plugin directory will be online at `http://localhost:1915/directory.json`.
For rebuilding the plugin during development, run `yarn build` again

## Structure
This package ([`@sourceacademy/web-data-display`](https://github.com/source-academy/plugins/tree/main/src/web/data-display)) contains the host-side plugin to display data. Most of the code has been extracted from the [frontend](https://github.com/source-academy/frontend).

The entry point is `src/index.tsx`, which contains the actual host plugin. It subscribes to a data channel, which receives the [`Data`](../../common/data-display/README.md#data-types) type. It serialises the data into a native JS format which is then displayed in a tab.

## Serialisation

The [`Data`](../../common/data-display/README.md#data-types) type is serialised again into a native JS structure for the internal data visualizer.

Let `s(x)` be the serialisation function 
- `s({ type: 'array', value: v })` returns `v.map(s)`
- `s({ type: 'function' })` returns `() => {}`. This is because the data visualiser doesn't need any other metadata from a function, only the fact that the value is a function. It displays all functions as two dotted circles.
- `s({ type: 'null' })` returns `null`
- `s({ type: 'string', value: v })` returns `v`

### Circular references
The above simplification would fail on circular arrays. To prevent infinite recursion, a mapping from all the `Data` types to the native JS type is created. 
When an array is passed into the function, a preemptive array is added to the cache
```js
cache[data] = [];
```
Then the elements of `data.v` are mapped over, and pushed to the original array
```js
cache[data].push(...data.v.map(s))
```

This ensures that if the `data` object is referenced in any of the elements/subelements of `data.v`,
it just passes the to-be final array.

## Further reading
- To use the runner-side plugin, install [`@sourceacademy/runner-data-display`](https://github.com/source-academy/plugins/tree/main/src/runner/data-display)
- To use the common types and IDs, install [`@sourceacademy/common-data-display`](https://github.com/source-academy/plugins/tree/main/src/common/data-display)
- The [plugins wiki](https://github.com/source-academy/plugins/wiki) provides information on how plugins communicate.