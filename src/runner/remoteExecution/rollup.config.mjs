import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import ts from "typescript";

const transpileNodeModulesTs = {
  name: "transpile-node-modules-ts",
  transform(code, id) {
    if (id.includes("node_modules") && (id.endsWith(".ts") || id.endsWith(".tsx"))) {
      const result = ts.transpileModule(code, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.ESNext,
          verbatimModuleSyntax: false,
        },
      });
      return { code: result.outputText, map: result.sourceMapText ?? null };
    }
  },
};

/** @type {import('rollup').RollupOptions} */
export default {
  input: "src/index.ts",
  output: [
    { file: "dist/index.cjs", format: "cjs" },
    { file: "dist/index.mjs", format: "esm" },
  ],
  plugins: [
    nodeResolve({ extensions: [".ts", ".tsx", ".js", ".jsx"] }),
    transpileNodeModulesTs,
    typescript(),
    terser(),
  ],
};
