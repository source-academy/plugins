// The environment diagram, as other web plugins use it. Not a plugin: see the README.
export { default as CseEnvironmentView } from "./CseEnvironmentView";
export type { CseDiagramAnchorResolver, CseEnvironmentViewProps } from "./CseEnvironmentView";
export { default as CseMachine } from "./CseMachine";
export { snapshotWithAllFrames, snapshotWithDeadFrames } from "./cseSnapshotHistory";
export { continuesRun } from "./continuesRun";
// What the CSE machine tab (web-cse-machine) drives besides the diagram: the layout and animation
// state, the arrow-filter menu and the fullscreen portal.
export { default as CseArrowFilterMenu } from "./CseArrowFilterMenu";
export { CseAnimation } from "./CseMachineAnimation";
export { Layout } from "./CseMachineLayout";
export { computeFramesCoordChange } from "./CseMachineUtils";
export { ClearDeadFramesAnimation } from "./animationComponents/ClearDeadFramesAnimation";
export { fullscreenPortalContainer } from "./fullscreenPortalContainer";
