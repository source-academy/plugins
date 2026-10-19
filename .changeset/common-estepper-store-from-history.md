---
"@sourceacademy/common-e-stepper": patch
---

The `frames` and `heap` of a step need not repeat the frames and objects that became unreachable in earlier steps: a host works out the whole store from the step and the ones before it (py-slang#611)
