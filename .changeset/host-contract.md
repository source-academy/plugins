---
"@sourceacademy/common-tabs": patch
---

The host contract: what a host may offer a plugin that contributes a tab, beyond the tab service, named for no tool and no language. `IHostContract` has an editor service (`highlight` and `clearHighlights`, by lines and by an owner, drawn as the host chooses) and a run service (`request`, to run the program again). `ITabService` gets `alertTab`, `isTabSelected` and `onTabSelectionChange`. Every new member is optional, so older hosts and older plugins keep working.
