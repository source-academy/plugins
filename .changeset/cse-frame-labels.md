---
"@sourceacademy/common-cse-machine": patch
---

Add an optional `label` to `CseSerializedEnvFrame`: the frame's heading, chosen by the evaluator (e.g. Python's `"Global"` and `"Built-ins"`) instead of derived by the host from the frame's `name`.
