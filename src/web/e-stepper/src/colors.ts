/**
 * Frame colours, shared by the environment diagram (a frame's border) and the program pane (the
 * bracket of an `EnvBlock` evaluated in that frame), so a student can match the two at a glance.
 * The global frame is neutral; the others cycle through a palette chosen to read on the dark
 * background.
 */

const GLOBAL_COLOR = "#c5cbd3";

const PALETTE = [
  "#4fc3f7", // light blue
  "#ffb74d", // orange
  "#81c784", // green
  "#f06292", // pink
  "#ba68c8", // purple
  "#fff176", // yellow
  "#4db6ac", // teal
  "#e57373", // red
];

/** The colour of the frame at `index` in a step's frame list (index 0 is the global frame). */
export function frameColor(index: number): string {
  return index <= 0 ? GLOBAL_COLOR : PALETTE[(index - 1) % PALETTE.length];
}

export const DiagramColors = {
  text: "#ffffff",
  dimText: "#8a9ba8",
  stroke: "#ffffff",
  garbageOpacity: 0.3,
  lookup: "rgba(255, 213, 79, 0.35)",
  hover: "#ffd54f",
  /** A hovered frame's background: darker, as in the host's CSE diagram. */
  frameHover: "#000000",
  background: "#1a2530",
} as const;
