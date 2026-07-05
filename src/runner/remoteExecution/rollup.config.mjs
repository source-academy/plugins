import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import esbuild from "rollup-plugin-esbuild";

export default [
  // existing build (npm package output) — unchanged
  {
    input: "src/index.ts",
    external: id => id.includes("py-slang"),
    output: [
      { file: "dist/index.cjs", format: "cjs" },
      { file: "dist/index.mjs", format: "esm" },
    ],
    plugins: [nodeResolve(), typescript(), terser()],
  },
  // EV3 remote runner worker bundle (used by frontend Web Worker)
  {
    input: "src/entry.ts",
    output: {
      file: "dist/ev3-remote-runner.js",
      format: "iife",
    },
    plugins: [
      nodeResolve({
        preferBuiltins: false,
        exportConditions: ["import", "require", "default"],
        extensions: [".ts", ".js"],
      }),
      commonjs(),
      esbuild({
        target: "es2020",
      }),
      terser(),
    ],
  },
];