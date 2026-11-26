---
"@sourceacademy/common-cse-machine": minor
"@sourceacademy/runner-cse-machine": minor
"@sourceacademy/web-cse-machine": minor
---

The CSE machine can send the snapshots of a run in batches while it runs (`CseSnapshotBatchMessage`: an `index` that continues from the batch before, and `end` on the last one: complete, or cut off with the reason), so that a run that is stopped, or never finishes, leaves the snapshots computed so far. An evaluator calls `sendBatch` for each batch and `endRun` when the run ends (`sendSnapshots`, a whole run at the end, still works). The host plugin hands `receiveSnapshots` the snapshots so far on each batch, and `receiveEnd` (new, optional to implement) how the run ended
