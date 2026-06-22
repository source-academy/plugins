<h1 align="center"> Data Visualization </h1>

<p align="center">A language agnostic interface to visualise lists, trees and other data structures<br/><img src="https://raw.githubusercontent.com/source-academy/plugins/main/src/common/data-display/docs/image.png" alt="An image of the data visualization tool"/></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sourceacademy/runner-data-display"><img src="https://img.shields.io/npm/v/@sourceacademy/runner-data-display?color=1a2530&label=npm"></a> 
  <a href="https://github.com/source-academy/plugins/tree/main/src/runner/data-display"><img src="https://img.shields.io/badge/github-repo-blue?logo=github"></a>
<p>

## Features
- [Box-and-pointer diagrams](https://sourceacademy.org/sicpjs/2.2) to visualize lists and array structures
- Visualisations for trees (including binary trees or more general trees)

## Installation
To add the base runner plugin to your project, add the following
```bash
yarn add @sourceacademy/runner-data-display
# OR
npm i @sourceacademy/runner-data-display
# OR
pnpm add @sourceacademy/runner-data-display
```

## Structure
This package ([`@sourceacademy/runner-data-display`](https://github.com/source-academy/plugins/tree/main/src/runner/data-display)) contains the base runner plugin required for sending data to the host-side plugin.

This is encompassed by the `BaseDataDisplayRunnerPlugin<T>` abstract class. 

### API Reference
The abstract class is generic, where the type parameter `T` represents the language value type. 
| Name          | Description |
|---------------|-------------|
| `abstract getConfig(): Config` | It returns the language-specific [`Config`](https://github.com/source-academy/plugins/tree/main/src/common/data-display/README.md#configuration-types) type. |
| `abstract serialiseData(data: T): Data` | It serialises the language value type into the language-agnostic [`Data`](https://github.com/source-academy/plugins/tree/main/src/common/data-display/README.md#data-types) type. Ensure it works on circular objects, similar to the example below |
| `sendData(data: T): void`  | It is meant to be called by the evaluator when it encounters the `draw_data` function. It serialises a language value and sends it to the web plugin|

## Usage
After installation, import the class from the `@sourceacademy/runner-data-display` package.

```ts
import { BaseDataDisplayRunnerPlugin } from "@sourceacademy/runner-data-display";
...
export class DataDisplayRunnerPlugin extends BaseDataDisplayRunnerPlugin<Value> {
  serialiseData(value: Value): Data {
    const objCache = new Map<Value, Data>();
    function helper(value: Value): Data {
      if (objCache.has(value)) {
        return objCache.get(value)!;
      }
      switch (value.type) {
        case "number":
        case "bool":
        case "complex":
        case "bigint":
        case "string":
        case "error":
          return { type: "string", value: toPythonString(value, true) };
        case "builtin":
        case "closure":
        case "function":
        case "multi_lambda":
          return { type: "function" };
        case "list":
          const listData: Data[] = [];
          objCache.set(value, { type: "array", value: listData });
          for (const item of value.value) {
            listData.push(helper(item));
          }
          return { type: "array", value: listData };
        case "none":
          return { type: "null" };
      }
    }
    return helper(value);
  }
  getConfig(): Config {
    return {
      sicpTextbookName: "Structure and Interpretation of Computer Programs, JavaScript Edition, Chapter 2, Section 2",
      sicpTextbookUrl: "https://sourceacademy.org/sicpjs/2.2",
      functionCallText: "draw_data(x1, x2, ..., xn)"
    }
  }
}
```

## Further reading
- To use the common types and IDs, install [`@sourceacademy/common-data-display`](https://github.com/source-academy/plugins/tree/main/src/common/data-display)
- To use the web plugin, check out the [Github repo](https://github.com/source-academy/plugins/tree/main/src/web/data-display)
- The [plugins wiki](https://github.com/source-academy/plugins/wiki) provides information on how plugins communicate.