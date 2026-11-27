import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import { fileURLToPath } from "node:url";

// React, Blueprint, and Konva/react-konva are provided by the host at load time through the
// require-provider (see the frontend's `requireProvider`, which already exposes them for other
// dynamic modules), so they are kept external and resolved via `require(...)` calls in the
// CommonJS output rather than bundled as a second copy — bundling react-konva pulled in its own
// react-reconciler wired against a duplicate React instance, breaking JSX's internal owner
// dispatcher at runtime. Everything else (conductor conduit, the common CSE protocol, and the
// environment-diagram library from ../environment-diagram/src) is bundled. wrap.mjs then wraps the CJS output into the host's factory contract.
const external = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "@blueprintjs/core",
  "konva",
  "react-konva",
];

/** The id of the module that stands for every `konva/lib/...` import (see the plugin below). */
const KONVA_SUBPATHS = "\0konva-subpaths-from-host";
/** What the environment-diagram library imports from those subpaths at run time. */
const KONVA_CLASSES = [
  "Easings",
  "Group",
  "Label",
  "Layer",
  "Node",
  "Rect",
  "Shape",
  "Stage",
  "Text",
];

/**
 * @type {import('rollup').RollupOptions}
 */
export default {
  input: "src/index.ts",
  output: {
    file: "dist/index.cjs",
    format: "cjs",
    exports: "default",
  },
  external,
  plugins: [
    {
      // The library imports Konva's classes from subpaths (`konva/lib/Group`, ...). Bundled, they would
      // be a second copy next to the host's (the one react-konva draws with), and `instanceof Group`
      // would fail for the nodes that react-konva makes. So every subpath is the host's own Konva:
      // the classes are taken from the external `konva` object.
      name: "konva-subpaths-from-host",
      resolveId(source) {
        return source.startsWith("konva/lib/") ? KONVA_SUBPATHS : null;
      },
      load(id) {
        return id === KONVA_SUBPATHS
          ? `import Konva from "konva"; export const { ${KONVA_CLASSES.join(", ")} } = Konva;`
          : null;
      },
    },
    {
      // The environment-diagram library is TypeScript source. Yarn resolves a workspace dependency
      // through a virtual path that the TypeScript plugin does not transform, so it is resolved to its
      // real path here, as a relative import (the E-Stepper's reuse of ../stepper/src) would be.
      name: "environment-diagram-source",
      resolveId(source) {
        if (source === "@sourceacademy/web-environment-diagram") {
          return fileURLToPath(new URL("../environment-diagram/src/index.ts", import.meta.url));
        }
        return null;
      },
    },
    // konva/react-konva pull in CJS deps (e.g. react-is) that branch on `process.env.NODE_ENV` at
    // module-init time; there's no `process` global in the browser, so replace it at build time.
    replace({ preventAssignment: true, "process.env.NODE_ENV": JSON.stringify("production") }),
    nodeResolve({ browser: true, preferBuiltins: false }),
    commonjs(),
    typescript(),
    terser(),
  ],
};
