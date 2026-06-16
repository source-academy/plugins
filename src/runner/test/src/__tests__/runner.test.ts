import { TestPlugin } from "..";
import { CHANNEL_ID } from "@sourceacademy/common-test";
import { test, expect } from "vitest";

test("should have a valid channel id", () => {
  expect(TestPlugin.channelAttach).toEqual([CHANNEL_ID]);
});
