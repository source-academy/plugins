---
"@sourceacademy/common-cse-machine": minor
---

The metadata that a renderer reads is now typed and documented: `CseFunctionMetadata` (`closureFrameId`, `params`, `funcName`, `body`, `locals`, `globals`, and the new `builtin`) and `CseEnvironmentInstructionMetadata` (`instrType` `"env"`, `envId`; `CSE_INSTR_TYPE_ENVIRONMENT`). All optional and additive: an evaluator that sends none of the new fields works as before.
