import { expect, test } from "vitest";

import { RUNNER_ID, STEPPER_CHANNEL_ID, WEB_ID } from "..";

test("runner and web ids are distinct", () => {
  expect(RUNNER_ID).not.toBe(WEB_ID);
});

test("has a stable channel id", () => {
  expect(STEPPER_CHANNEL_ID).toBe("__stepper");
});
