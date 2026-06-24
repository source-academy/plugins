export const CHANNEL_ID = "py_slang_channel";
export const RUNNER_ID = "__runner_py_slang";

export type PySlangMessage =
  | { type: "run"; code: string }
  | { type: "result"; output: string | undefined }
  | { type: "error"; message: string };