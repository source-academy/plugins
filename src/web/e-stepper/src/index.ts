// The host's external-plugin loader imports the bundle and calls its default export as a factory
// (see wrap.mjs), so the entry default-exports the plugin class.
export { EStepperHostPlugin as default } from "./EStepperHostPlugin";
