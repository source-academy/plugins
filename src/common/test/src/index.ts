export const WEB_ID = "__web_test";
export const RUNNER_ID = "__runner_test";

export const CHANNEL_ID = "test";

export type TestMessage = "ping" | "pong";

export type PySlangMessage =
  | { type: "run"; code: string }
  | { type: "result"; output: string }
  | { type: "error"; message: string };