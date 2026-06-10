import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

// Shared with the host frontend (resolved at runtime via the host's import map), so they are not
// bundled: this keeps the bundle tiny and, crucially, makes the plugin use the *same* React and
// Blueprint instances as the frontend — guaranteeing a single React tree and identical styling.
const external = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "@blueprintjs/core",
];

/**
 * @type {import('rollup').RollupOptions}
 */
export default {
  input: "src/index.ts",
  output: {
    file: "dist/index.mjs",
    format: "esm",
  },
  external,
  plugins: [nodeResolve({ browser: true, preferBuiltins: false }), commonjs(), typescript(), terser()],
};
