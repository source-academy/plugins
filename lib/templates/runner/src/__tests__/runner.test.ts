import { PluginName } from "..";
import { test, expect } from "vitest";

test("should have a valid channel id", () => {
  expect(PluginName.channelAttach).toEqual(["__channel_id"]);
});
