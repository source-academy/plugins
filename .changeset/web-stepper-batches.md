---
"@sourceacademy/web-stepper": patch
"@sourceacademy/web-e-stepper": patch
---

The Stepper and E-Stepper tabs take the trace of a run in batches (`batch` messages) and keep the steps received so far, and how the trace ended, if it has (`getEnd`; `end` in the E-Stepper's state): complete, or cut off by the runner
