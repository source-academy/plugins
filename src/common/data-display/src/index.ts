/**
 * The web plugin's ID
 */
export const WEB_ID = "__web_data_display";

/**
 * The runner plugin's ID
 */
export const RUNNER_ID = "__runner_data_display";

/**
 * The data channel ID for the data display plugin
 */
export const DATA_CHANNEL_ID = "data_display_data_channel";
/**
 * The config channel ID for the data display plugin
 */
export const CONFIG_CHANNEL_ID = "data_display_config_channel";

export type StringValue = { type: "string"; value: string };
export type FunctionValue = { type: "function" };
export type ArrayValue = { type: "array"; value: Data[] };
export type EmptyListValue = { type: "null" };

export type Data = StringValue | FunctionValue | ArrayValue | EmptyListValue;

export type Config = {
  sicpTextbookName: string;
  sicpTextbookUrl: string;
  functionCallText: string;
};
