import { Config } from "./Config";
import { type Data } from "@sourceacademy/common-data-display";

/**
 *  Returns data in text form, fitted into the box.
 *  If not possible to fit data, return undefined. A number will be assigned and logged in the console.
 */
export function toText(data: Data, full: boolean = false): string | undefined {
  if (data.type !== "string") {
    return undefined;
  }
  if (full) {
    return data.value;
  }
  const dataString = data.value;
  const str = dataString.substring(0, Config.MaxTextLength);
  return `${str}${dataString.length > Config.MaxTextLength ? "..." : ""}`;
}
