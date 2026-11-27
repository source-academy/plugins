# @sourceacademy/common-stepper

## 0.1.1

### Patch Changes

- 9186564: The package declares the Apache License 2.0 (its metadata said ISC) and ships the licence text; the code is unchanged.

## 0.1.0

### Minor Changes

- 5ab3224: A stepper or e-stepper can send the trace of a run in batches while it runs (a `batch` message with its `index`, and `end` on the last one: complete, or cut off with the reason), so that a run that is stopped, or never finishes, leaves the steps computed so far. A language streams by overriding `getStepBatches` with a generator of batches, whose return value is how the trace ended; one that does not keeps sending one `steps` message at the end. A request replays a streamed run as one batch with its end

## 0.0.4

### Patch Changes

- 7226fba: Add a `hoverText` `SyntaxProfile` capability: a node type can now show a fixed-text hover popover (e.g. `built-in function print`) alongside its normal inline rendering, without collapsing/replacing that rendering the way `functionValues`'s mu-term does. Unlike a function value's popover (the node's own template, i.e. a body, rendered on demand), this shows a single already-formatted line the language stashed on the node ahead of time — there is no body to expand. A language opts in by listing the node type and the property holding that text in its `SyntaxProfile.hoverText`; `web-stepper` renders the popover generically from the rule, no per-language host code.

## 0.0.3

### Patch Changes

- 065da98: Add an `image` `SyntaxTemplatePart` (renders a node's data-URL property as an inline `<img>`, e.g. a rendered thumbnail for an opaque runtime value — DrRacket-style — falling back to nothing when the property is absent) and an `unless` part (the inverse of `when`, for pairing an image with a textual fallback). `web-stepper` renders both generically; a language opts in by using them in its `SyntaxProfile` templates. Both additions are optional and backward-compatible.

## 0.0.2

### Patch Changes

- c50e84e: Add an optional `output` field to `SerializedStepperStep`. A runner can use it to report the program's cumulative textual output (e.g. everything `print` has written) up to each step, so a host can render a running output panel that grows as the slider advances. The field is optional and backward-compatible: runners that produce no output may omit it, and hosts that ignore it are unaffected.
