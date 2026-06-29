import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

export default [
  // existing build
  {
    input: "src/index.ts",
    external: id => id.includes("py-slang"),
    output: [
      { file: "dist/index.cjs", format: "cjs" },
      { file: "dist/index.mjs", format: "esm" },
    ],
    plugins: [nodeResolve(), typescript(), terser()],
  },
  // new EV3 conductor worker bundle
  {
    input: "src/entry.ts",
    output: {
      file: "dist/ev3-pyslang.js",
      format: "iife", // self-contained for Web Worker
    },
    plugins: [nodeResolve(), typescript(), terser()],
  },
];
