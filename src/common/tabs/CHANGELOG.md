# @sourceacademy/common-tabs

## 0.2.0

### Minor Changes

- a889063: The host contract: what a host may offer a plugin that contributes a tab, beyond the tab service, named for no tool and no language. `IHostContract` has an editor service with one call, `highlight(lines)`, which marks lines of the editor as the host chooses. It is optional, so older hosts and older plugins keep working.

## 0.1.0

### Minor Changes

- 28a3411: `Tab` can say that the host should hide its REPL while the tab is selected (`hidesRepl`) and that the side content cannot be resized then (`resizable: false`), so that a host need not know the ids of the tabs that want this
