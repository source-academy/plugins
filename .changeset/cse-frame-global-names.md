---
"@sourceacademy/common-cse-machine": minor
---

Add optional `globalNames` field to `CseSerializedEnvFrame`, letting an evaluator (e.g. py-slang) mark names in a call frame that resolve via the global frame instead of the usual enclosing-scope chain (e.g. Python's `global` statement).
