// Wraps the CommonJS rollup output into the host's external-plugin factory contract.
//
// The host loads an external web plugin with:
//   import(url).then(m => m.default(requireProvider)).then(PluginClass => registerPlugin(PluginClass, tabService))
// i.e. the module's default export must be `(require) => PluginClass`, where `require` is the host's
// dependency provider (resolves "react", "@blueprintjs/core", ...). We therefore wrap the CJS bundle
// in `export default require => { ...cjs...; return module.exports }`, shadowing `require`/`module`/
// `exports` so the bundle's external `require(...)` calls hit the provider. (Mirrors plugins #25's
// build transform.) Output is written to dist/index.mjs (the file the frontend serves & imports).
import { readFile, writeFile } from "node:fs/promises";

const cjsUrl = new URL("./dist/index.cjs", import.meta.url);
const mjsUrl = new URL("./dist/index.mjs", import.meta.url);

const cjs = await readFile(cjsUrl, "utf-8");
const wrapped = `export default require => {let module = {exports: {}}; let exports = module.exports;\n${cjs}\n; return module.exports;}`;
await writeFile(mjsUrl, wrapped);
