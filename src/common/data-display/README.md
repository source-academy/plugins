<h1 align="center"> Data Visualization </h1>

<p align="center">A language agnostic interface to visualise lists, trees and other data structures<br/><img src="https://raw.githubusercontent.com/source-academy/plugins/main/src/common/data-display/docs/image.png" alt="An image of the data visualization tool"/></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sourceacademy/common-data-display"><img src="https://img.shields.io/npm/v/@sourceacademy/common-data-display?color=1a2530&label=npm"></a> 
  <a href="https://github.com/source-academy/plugins/tree/main/src/common/data-display"><img src="https://img.shields.io/badge/github-repo-blue?logo=github"></a>
<p>


## Features
- [Box-and-pointer diagrams](https://sourceacademy.org/sicpjs/2.2) to visualize lists and array structures
- Visualisations for trees (including binary trees or more general trees)

## Installation
To add the common types to your project, add the following
```bash
yarn add @sourceacademy/common-data-display
# OR
npm i @sourceacademy/common-data-display
# OR
pnpm add @sourceacademy/common-data-display
```

## Structure
This package ([`@sourceacademy/common-data-display`](https://github.com/source-academy/plugins/tree/main/src/common/data-display)) contains the common constants and types required for both the host and runner-side plugin implementations.

These include
- the IDs of the runner-side plugin, the web-side plugin and the channel they communicate over.
- the types of the language-agnostic data the runner-side plugin has to convert language values to

## Usage
After installation, import the types from the `@sourceacademy/common-data-display` package.

```ts
import type { Data } from '@sourceacademy/common-data-display';
...
function serialiseData(value: LanguageValue): Data {
    switch (value.type) {
        ...
        case 'number':
            return { type: 'string', value: value.value.toString() };
        ...
    }
}
```

## Data Types
The `Data` type is the simplest possible representation of the data visualisable by the tool. Since the same value may be displayed in two different ways (the JS number `3` is displayed as `3` in Source, but the same number is used by the [Python sublanguage](https://github.com/source-academy/py-slang) to represent `3.0`), language-specific values are stringified into their representation.

For example,
### Source
- `3` serialises to `'3'`
- `true` serialises to `'true'`
- `'a'` serialises to `"'a'"`

### Python 1-4
_Note: py-slang is internally powered by JavaScript. Hence, the serialisation of the internal JS values is implied below_
- `3n` becomes `'3'`
- `3` becomes `'3.0'`
- `true` becomes `'True'`

The `Data` type is a discriminated union with four subtypes. Each subtype is an object with a `type` field, and optionally a `value` field
| Name             | Description | `type` field | `value` field |
|------------------|-------------|--------------|---------------|
| `StringValue`    | Stores a representation of an internal language value. This would be the text present in the boxes of the diagram  | `'string'` | A `string` type with the string representation. _Note: serialised strings will contain their quotes, i.e., `'a'` -> `"'a'"`_ |
| `ArrayValue`     | Represents an array of data objects. This would represent a singular box | `'array'` | A `Data[]` array. These would be the elements of the box |
| `EmptyListValue` | Represents the linked-list termination value (`null`, `None`, etc.). Would be shown as a diagonal line in the diagram  | `'null'`| N/A | 
| `FunctionValue`  |        Represents a function (closure, built-in function, etc.). Represented as two external dotted circles | `'function'` | N/A |

Native JS types aren't directly passed over the channels since functions cannot be passed from a web worker to the main thread. 

## Configuration Types
The `Config` type contains language-specific configuration required for the web plugin including
- `sicpTextbookName`: The name section of the SICP book which contains hierarchical data, as well as box-and-pointer diagrams
- `sicpTextbookUrl`: The URL of the aforementioned section
- `functionCallText`: The function call displayed as an example. For example, `draw_data(x1, x2, ..., xn)`. The suffix after `x` in `x<number>` and `xn` are automatically converted to subscript.

## Further reading
- To use the runner-side plugin, install [`@sourceacademy/runner-data-display`](https://github.com/source-academy/plugins/tree/main/src/runner/data-display)
- To use the web plugin, check out the [Github repo](https://github.com/source-academy/plugins/tree/main/src/web/data-display)
- The [plugins wiki](https://github.com/source-academy/plugins/wiki) provides information on how plugins communicate.