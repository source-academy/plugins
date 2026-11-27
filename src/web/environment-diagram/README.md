# Environment diagram

The CSE machine's drawing as a **library**: frames, bindings, values (functions, arrays, closures), the arrows between them, the control and the stash, and their animation. It draws `CseSnapshot`s (the protocol of `@sourceacademy/common-cse-machine`) with React, Konva and Blueprint, which the host provides.

**It is not a plugin.** It has no plugin class, no `manifest.json` and no entry in the plugin directory, and it is private: nothing is published. It is the first package in `src/web` that is not a plugin. Web plugins that draw an environment (the CSE machine tab, and the E-Stepper's embedded pane) list it as a `devDependency`, and their rollup build inlines it, as it inlines the `common-*` packages. Layout and animation state are therefore not shared between plugins, which is fine: each bundle is fetched only when its plugin loads.

It is not `common-cse-machine`, which holds the protocol types, is imported in the evaluator's worker and so must stay free of UI code.

## Use

```ts
import { CseEnvironmentView } from "@sourceacademy/web-environment-diagram";

<CseEnvironmentView snapshots={snapshots} step={step} />;
```

The package's `main` is its TypeScript source; a consumer's tsconfig has to include it (set `rootDir` high enough, as `web-e-stepper` does for `web-stepper`).

## Origin and what is still to do

Lifted without change of behaviour from the Source Academy frontend (`src/features/cseMachine`, with its tests), so the frontend can delete its copy once the CSE machine plugin has shipped (source-academy/frontend#4587, plugins#194). Three differences from the frontend: the protocol types come from `common-cse-machine`; the drag cursor is set with `style.cursor` instead of a SCSS module (the `:active` "grabbing" cursor is gone); and the lint rules `no-explicit-any`, `no-unsafe-function-type` and `no-unnecessary-type-assertion` are off for this package (see `eslint.config.mjs`) until the code is tightened.

Still to do (plugins#194): drop `CseSnapshotAdapter`, which builds js-slang-shaped objects so that the old renderer can draw snapshots; make the language-specific cases part of the snapshot protocol; split the control and stash from the environment diagram.

## Tests

`yarn vitest run src/web/environment-diagram`. They run in jsdom with `canvas` (a native dependency of the root `package.json`, allowed to run its build script through `dependenciesMeta`), because Konva draws to a canvas.
