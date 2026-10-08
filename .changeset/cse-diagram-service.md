---
"@sourceacademy/common-cse-machine": patch
"@sourceacademy/common-e-stepper": patch
---

Add `ICseDiagramService` and `IHostServices` to `common-cse-machine`: a host can lend web plugins its CSE machine visualization, passed as `registerPlugin(PluginClass, tabService, hostServices)`. Add an optional `cse` snapshot to `EStepperStep`, so a host can draw an e-stepper step's environments with that visualization.
