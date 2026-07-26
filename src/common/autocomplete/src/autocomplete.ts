// Adapted from https://learn.microsoft.com/en-us/dotnet/api/microsoft.visualstudio.languageserver.protocol.completionitemkind?view=visualstudiosdk-2022
export enum CompletionItemKind {
  Text = "text",
  Method = "method",
  Function = "func",
  Constructor = "constructor",
  Field = "field",
  Variable = "var",
  Class = "class",
  Interface = "interface",
  Module = "module",
  Property = "property",
  Unit = "unit",
  Value = "value",
  Enum = "enum",
  Keyword = "keyword",
  Snippet = "snippet",
  Color = "color",
  File = "file",
  Reference = "reference",
  Folder = "folder",
  EnumMember = "enumMember",
  Constant = "constant",
  Struct = "struct",
  Event = "event",
  Operator = "operator",
  TypeParameter = "typeParameter",
}

export interface AutoCompleteRequest {
  type: "request";
  /** The current code in the editor */
  code: string;
  /** The current row of the cursor in the editor (1-indexed) */
  row: number;
  /** The current column of the cursor in the editor (1-indexed) */
  column: number;
}

export interface AutoCompleteResponse {
  type: "response";
  /** A list of autocomplete entries relevant to the current cursor position in the code */
  declarations: AutoCompleteEntry[];
}

export type AutoCompleteMessage = AutoCompleteRequest | AutoCompleteResponse;

export interface AutoCompleteEntry {
  /** The name of the autocomplete entry */
  name: string;
  /** The type of the autocomplete entry, e.g., "func", "var", etc. */
  meta: CompletionItemKind;
  /** The score of the autocomplete entry (higher score would be more relevant) */
  score?: number;
  /** The documentation string for the autocomplete entry, which can be displayed in the autocomplete tooltip */
  docHTML?: string;
}
