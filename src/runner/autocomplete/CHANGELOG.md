# @sourceacademy/runner-autocomplete

## 0.0.4

### Patch Changes

- 9186564: The package declares the Apache License 2.0 (its metadata said ISC) and ships the licence text; the code is unchanged.
- Updated dependencies [9186564]
  - @sourceacademy/common-autocomplete@0.0.3

## 0.0.3

### Patch Changes

- cd55e57: An evaluator can answer the editor's questions about the code, over a channel of its own next to the autocomplete and the syntax channels: where a name is used within its scope (`occurrences`), where it is declared (`definition`), and the scope that a position is in (`scope`). A runner provides each by defining the method of that name, and says which it has; the web plugin asks only for those, as promises. The protocol follows the Language Server Protocol (0-based positions and ranges) so that it does not depend on the editor. A plugin made with the two channels it had before keeps working, and an evaluator that does not know the channel only offers no analysis.
- Updated dependencies [cd55e57]
  - @sourceacademy/common-autocomplete@0.0.2
