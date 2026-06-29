// The host's external-plugin loader imports the bundle and calls its default export as a factory
// (`default(requireProvider) => PluginClass`); the build wraps this CommonJS output accordingly (see
// wrap.mjs). So the entry default-exports the plugin class, which becomes the bundle's `module.exports`.
export { StepperHostPlugin as default } from "./StepperHostPlugin";
