import { Config } from "./Config";

/**
 * Formats a leaf's display value for showing inside a box: quotes and truncates strings (mirroring
 * the old `toText`'s behavior — box width is a rendering concern, not a language concern, so this
 * applies uniformly regardless of which language's adapter produced the value). Other labels are
 * passed through as-is — the adapter already produced a reasonable display string for them.
 */
export function formatLeaf(displayValue: string, label: string): string {
  if (label === "string") {
    const truncated = displayValue.substring(0, Config.MaxTextLength);
    const suffix = displayValue.length > Config.MaxTextLength ? "..." : "";
    return `"${truncated}${suffix}"`;
  }
  return displayValue;
}
