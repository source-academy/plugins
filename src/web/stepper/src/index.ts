// Conductor's external-plugin loader imports the bundle and reads its `plugin` export, so the host
// plugin class must be exported under that name.
export { StepperHostPlugin as plugin } from "./StepperHostPlugin";
export type { PluginTab } from "./StepperHostPlugin";
