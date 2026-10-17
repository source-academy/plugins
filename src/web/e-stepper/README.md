# @sourceacademy/web-e-stepper

The host (web) plugin of the Source Academy environment stepper ("e-stepper"). It shows the steps
that a language's runner computes: the program, rewritten one reduction at a time, together with
the environment frames and heap objects that it refers to. It is language-agnostic: it knows only
the protocol of `@sourceacademy/common-e-stepper`.

For students, there is [a guide](https://docs.sourceacademy.org/python/e-stepper/) that explains
what the brackets, labels and badges mean. For the design of the e-stepper (the model, the rules
for Python §3/§4), see the
[design note](https://github.com/source-academy/py-slang/blob/main/docs/e-stepper.md).

## The three packages

| Package                                      | Side   | What it is                                                                                            |
| -------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| [`common-e-stepper`](../../common/e-stepper) | both   | the protocol: ids, the step type `EStepperStep`, the program nodes `EnvBlock` and `Ref`, the messages |
| [`runner-e-stepper`](../../runner/e-stepper) | runner | a base class that a language extends to compute steps and send them                                   |
| `web-e-stepper` (this package)               | host   | receives the steps and renders the tab                                                                |

## What it does

- It attaches to the e-stepper channel (`E_STEPPER_CHANNEL_ID`) and listens for `steps` messages
  (the steps of a run, with the language's `SyntaxProfile`) and `error` messages. On start-up it
  sends a `request` message, so that a runner replays the steps that it already has (a tab that is
  opened after a run).
- It registers a side-content tab, `E-Stepper` (tab id `e-stepper`), and reveals it. It uses the
  stepper's icon: the two do not appear together (Stepper for Python §1–2, E-Stepper for §3–4).
- It renders the steps in that tab.

## The tab

- **Explanation:** the text of the step ("Looked up balance in frame E1: 100").
- **Program:** drawn by the stepper's profile-driven renderer. The two program nodes of the
  protocol are drawn by this package: `EnvBlock` as a bracket, in the colour of its frame and with
  the frame's label (`E2`), and `Ref` as a badge with the number of the object (`#2`; a function's
  header is in its tooltip). Hovering over either highlights the frame or the object in the
  diagram. The output of the program is under it (a toggle).
- **Environments:** frames and heap objects, with the active frame and the binding that a lookup
  read highlighted, and frames and objects that nothing refers to any more greyed out.
  - When the host lends its CSE machine diagram (`ICseDiagramService` in `IHostServices`; the
    Source Academy frontend does), the environments are drawn with it, as in the CSE machine, with
    its toolbar (arrow filters, _Clear Dead Frames_). Each step carries its store as a CSE machine
    snapshot for it.
  - Otherwise, the plugin draws them with its own Konva diagram (`EnvDiagram.tsx`), with the
    options _From program_ (arrows from the program to the diagram) and _Clear dead frames_.
- **Controls:** a slider (0 is the start of the evaluation); buttons for the first, previous,
  next and last step; _Vertical_, which puts the program above the diagram instead of beside it.
  The arrangement, and the divider between the panes, stay as the user left them over runs.
- **Keyboard** (when the tab has the focus; click on the explanation first): `f` and `b` for the next and the
  previous step; `a` and `e` for the previous and the next `breakpoint()` statement of the program,
  or for the first and the last step if there is none.

## How it is loaded

The package is an _external_ plugin (`manifest.json`): the host loads a bundle at run time, by the
name that the plugin directory gives it, `e-stepper`. A language's evaluator asks for it with
`hostLoadPlugin("e-stepper")`. `yarn build` makes the bundle with rollup and wraps it in a factory
(`wrap.mjs`) that the host calls on every Run, since the host terminates the conduit and makes new
plugins each time; the bundle's default export is `EStepperHostPlugin`. React, Blueprint and Konva
are peer dependencies, which the host provides.

## Source

| File                                  | Contents                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `src/EStepperHostPlugin.tsx`          | the plugin: the channel, the state of the steps, the tab                         |
| `src/EStepperView.tsx`                | the tab: explanation, program, controls, node renderers for `EnvBlock` and `Ref` |
| `src/EnvDiagram.tsx`, `src/layout.ts` | the plugin's own diagram of frames and heap objects                              |
| `src/ProgramArrows.tsx`               | arrows from the program to the diagram                                           |
| `src/colors.ts`, `src/styles.ts`      | the colour of each frame, the stylesheet                                         |

Tests are in `src/__tests__`; run them with `yarn vitest run src/web/e-stepper` from the
repository root.
