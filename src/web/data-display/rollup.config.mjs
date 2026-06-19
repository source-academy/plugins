import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import commonjs from "@rollup/plugin-commonjs";
import replace from "@rollup/plugin-replace";

/**
 * @type {import('rollup').RollupOptions}
 */
export default {
  input: "src/index.tsx",
  output: [
    {
      file: "dist/index.js",
      format: "cjs",
      inlineDynamicImports: true
    },
    {
      file: "dist/index.mjs",
      format: "esm",
      inlineDynamicImports: true
    },
  ],
  plugins: [replace({
    preventAssignment: true,
    "process.env.NODE_ENV": JSON.stringify("production"),
  }), nodeResolve({ preferBuiltins: false, browser: true }), commonjs(), typescript(), terser()],
  external: ["react", "react-dom", "react/jsx-runtime", "@blueprintjs/core", "@blueprintjs/icons", "react-konva", "konva"],
};
