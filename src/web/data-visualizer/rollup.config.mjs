import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

// React, Blueprint, and Konva/react-konva are provided by the host at load time through the
// require-provider (see the frontend's `requireProvider`, which already exposes them for other
// dynamic modules), so they are kept external and resolved via `require(...)` calls in the
// CommonJS output rather than bundled as a second copy — bundling react-konva pulled in its own
// react-reconciler wired against a duplicate React instance, breaking JSX's internal owner
// dispatcher at runtime. Everything else (conductor conduit, the common data-visualizer protocol)
// is bundled. wrap.mjs then wraps the CJS output into the host's factory contract.
const external = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "@blueprintjs/core",
  "konva",
  "react-konva",
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
    // konva/react-konva pull in CJS deps (e.g. react-is) that branch on `process.env.NODE_ENV` at
    // module-init time; there's no `process` global in the browser, so replace it at build time.
    replace({ preventAssignment: true, "process.env.NODE_ENV": JSON.stringify("production") }),
    nodeResolve({ browser: true, preferBuiltins: false }),
    commonjs(),
    typescript(),
    terser(),
  ],
};
