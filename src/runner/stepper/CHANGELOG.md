# @sourceacademy/runner-stepper

## 0.1.0

### Minor Changes

- 5ab3224: A stepper or e-stepper can send the trace of a run in batches while it runs (a `batch` message with its `index`, and `end` on the last one: complete, or cut off with the reason), so that a run that is stopped, or never finishes, leaves the steps computed so far. A language streams by overriding `getStepBatches` with a generator of batches, whose return value is how the trace ended; one that does not keeps sending one `steps` message at the end. A request replays a streamed run as one batch with its end
