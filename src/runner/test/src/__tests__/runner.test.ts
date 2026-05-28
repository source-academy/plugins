import { TestPlugin } from "..";
import { CHANNEL_ID } from "@sourceacademy/common-test";
test("should have a valid channel id", () => {
  expect(TestPlugin.channelAttach).toEqual([CHANNEL_ID]);
});
