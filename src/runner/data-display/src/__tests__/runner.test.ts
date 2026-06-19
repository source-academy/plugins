import { BaseDataDisplayRunnerPlugin } from "..";
import { test, expect } from "vitest";

test("should have a valid channel id", () => {
  expect(BaseDataDisplayRunnerPlugin.channelAttach).toEqual(["__channel_id"]);
});
