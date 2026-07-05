---
"@sourceacademy/common-stepper": patch
---

Add an optional `output` field to `SerializedStepperStep`. A runner can use it to report the program's cumulative textual output (e.g. everything `print` has written) up to each step, so a host can render a running output panel that grows as the slider advances. The field is optional and backward-compatible: runners that produce no output may omit it, and hosts that ignore it are unaffected.
