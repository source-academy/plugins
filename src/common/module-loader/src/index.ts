export const WEB_ID = "__web_module_loader";
export const RUNNER_ID = "__runner_module_loader";

export const CHANNEL_ID = "module_config";

export enum ModuleLoaderMessageType {
  REQUEST_MODULE = "request_module",
  MODULE_RESPONSE = "module_response",
  MODULE_ERROR = "module_error",
}

export type ModuleLoaderMessage =
  | {
      type: ModuleLoaderMessageType.REQUEST_MODULE;
      moduleName: string;
    }
  | {
      type: ModuleLoaderMessageType.MODULE_RESPONSE;
      moduleURL: string;
      tabs: string[];
    }
  | {
      type: ModuleLoaderMessageType.MODULE_ERROR;
      error: string;
    };
