---
"@sourceacademy/common-stepper": patch
"@sourceacademy/web-stepper": patch
---

Add a `hoverText` `SyntaxProfile` capability: a node type can now show a fixed-text hover popover (e.g. `built-in function print`) alongside its normal inline rendering, without collapsing/replacing that rendering the way `functionValues`'s mu-term does. Unlike a function value's popover (the node's own template, i.e. a body, rendered on demand), this shows a single already-formatted line the language stashed on the node ahead of time — there is no body to expand. A language opts in by listing the node type and the property holding that text in its `SyntaxProfile.hoverText`; `web-stepper` renders the popover generically from the rule, no per-language host code.
