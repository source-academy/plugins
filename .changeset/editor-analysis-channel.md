---
"@sourceacademy/common-autocomplete": patch
"@sourceacademy/runner-autocomplete": patch
"@sourceacademy/web-autocomplete": patch
---

An evaluator can answer the editor's questions about the code, over a channel of its own next to the autocomplete and the syntax channels: where a name is used within its scope (`occurrences`), where it is declared (`definition`), and the scope that a position is in (`scope`). A runner provides each by defining the method of that name, and says which it has; the web plugin asks only for those, as promises. The protocol follows the Language Server Protocol (0-based positions and ranges) so that it does not depend on the editor. A plugin made with the two channels it had before keeps working, and an evaluator that does not know the channel only offers no analysis.
