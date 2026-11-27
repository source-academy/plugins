# @sourceacademy/web-cse-machine

The host (web) plugin of the Source Academy CSE machine. It receives the snapshots that a language's
runner sends (`@sourceacademy/common-cse-machine`) and contributes a **CSE Machine** side-content
tab: a step slider, the control, the stash and the environment diagram at each step, with the toggles
(control and stash, truncate, alignment, arrow filters, print, save, clear unreachable objects) and
step navigation (by step, by change, by breakpoint) of the CSE machine. It knows no language.

It is an external web plugin, like the E-Stepper: it is not installed from npm, and an evaluator
loads it with `hostLoadPlugin(CSE_DIRECTORY_ID)` (`"cse-machine"`); the host resolves that through the
plugin directory. Up to 3.1.0 this package was published to npm as the transport only (an abstract
`CseMachineHostPlugin`, from which the frontend drew the diagram itself); those versions stay on npm,
and nothing newer is published.

## What it needs from the host

`ITabService` (to contribute the tab; the tab hides the REPL and is not resizable), and, optionally,
`editor.highlight` of the host contract (`IHostContract` of `@sourceacademy/common-tabs`), with
which it marks the line of the step in the editor and clears it when the tab goes away. A host that
has no editor still gets the tab. Nothing else is asked of the host: the snapshots arrive on the
plugin's own channel, the size is that of the tab, and the keys (a, e, f, b: first, last, next,
previous step) work while the focus is on it.

## How it is built

- `CseMachineHostPlugin` (`src/CseMachineHostPlugin.ts`): the transport. It subscribes to
  `CSE_CHANNEL`, puts the batches of a run together, and calls `receiveSnapshots` and `receiveEnd`.
- `CseMachineTabPlugin` (`src/CseMachineTabPlugin.tsx`): its subclass that keeps the snapshots as an
  external store and registers the tab.
- `CseMachineView` (`src/CseMachineView.tsx`): the tab, ported from the frontend's
  `SideContentCseMachine`. It draws with `@sourceacademy/web-environment-diagram`, a library in this
  repository whose source the bundle inlines (see `rollup.config.mjs` and the `paths` entry of
  `tsconfig.json`, which make the build read it from its source).
- React, Konva, react-konva and Blueprint are provided by the host and are not bundled.

## Not done yet

The frontend still draws its own CSE machine tab and does not load this plugin (it skips the id, so
that a user does not get two tabs); the switch is source-academy/frontend#4587. The diagram does not
follow the frontend's green-screen mode (plugins#194, "green-screen mode"). `CseSnapshotAdapter`,
which turns snapshots into js-slang-shaped objects for the renderer, is still in the library.
