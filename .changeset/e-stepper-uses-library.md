---
"@sourceacademy/common-cse-machine": patch
---

`ICseDiagramService` and `IHostServices` are deprecated: the E-Stepper draws its environments with the environment-diagram library that its bundle contains, so a host lends nothing. A host that still passes them is ignored.
