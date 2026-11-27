---
"@sourceacademy/common-tabs": minor
---

The host contract: what a host may offer a plugin that contributes a tab, beyond the tab service, named for no tool and no language. `IHostContract` has an editor service with one call, `highlight(lines)`, which marks lines of the editor as the host chooses. It is optional, so older hosts and older plugins keep working.
