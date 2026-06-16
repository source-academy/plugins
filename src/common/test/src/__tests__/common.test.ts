import { CHANNEL_ID } from "..";
import { test, expect } from "vitest";

test("should have a valid channel id", () => {
  expect(CHANNEL_ID).toBe("test");
});
