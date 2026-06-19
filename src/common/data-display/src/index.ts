/**
 * The web plugin's ID
 */
export const WEB_ID = "__web_data_display";

/**
 * The runner plugin's ID
 */
export const RUNNER_ID = "__runner_data_display";

/**
 * The channel ID for the data display plugin
 */
export const CHANNEL_ID = "data_display_channel";

export type StringValue = { type: 'string', value: string };
export type FunctionValue = { type: 'function' };
export type ArrayValue = { type: 'array', value: Data[] };
export type EmptyListValue = { type: 'null' };

export type Data = StringValue | FunctionValue | ArrayValue | EmptyListValue;
