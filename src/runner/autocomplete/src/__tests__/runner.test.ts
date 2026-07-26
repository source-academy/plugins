import { BaseAutoCompleteRunnerPlugin } from "..";
import { SYNTAX_CHANNEL_ID, AUTOCOMPLETE_CHANNEL_ID } from "@sourceacademy/common-autocomplete";
import { test, expect } from "vitest";

test("should have a valid channel id", () => {
  expect(BaseAutoCompleteRunnerPlugin.channelAttach).toEqual([AUTOCOMPLETE_CHANNEL_ID, SYNTAX_CHANNEL_ID]);
});
