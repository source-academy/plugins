export interface SyntaxHighlightRequest {
  type: "request";
}
export interface SyntaxHighlightResponse {
  type: "response";
  data: SyntaxHighlightData;
}
export interface SyntaxHighlightAck {
  type: "ack";
}

export type SyntaxHighlightMessage =
  | SyntaxHighlightRequest
  | SyntaxHighlightResponse
  | SyntaxHighlightAck;

/**
 * The `SyntaxHighlightData` interface defines the structure of the syntax highlighting information that the runner plugin sends to the web plugin.\
 * This data includes rules for tokenizing code, folding rules for code blocks, and other information necessary for the web plugin to perform syntax highlighting in the editor.\
 *
 * Right now, the `SyntaxHighlightData` uses functions from other pre-existing Ace Editor modes (the `hookFrom` properties) to determine how to perform syntax highlighting, folding, indentation, and outdenting.\
 * This design allows the plugin to use existing Ace Editor modes, at the cost of some flexibility. If more flexibility is needed in the future, it should be extended.
 */
export interface SyntaxHighlightData {
  highlightRules: AceRules;
  foldingRules: {
    hookFrom: string;
    args: string[];
  };
  /** The start of a line comment */
  lineCommentStart: string;
  /** The regular expressions which have to precede a quote for pairing to occur */
  pairQuotesAfter: Record<string, RegExp>;
  /** The indentation rules */
  indents: {
    hookFrom: string;
  };
  /** The outdentation rules */
  outdents: {
    hookFrom: string;
  };
  /** The auto-outdentation rules */
  autoOutdent: {
    hookFrom: string;
  };
  /** The unique identifier for the syntax highlighting rules (ensure it doesn't conflict with other syntax highlighting rules, such as `java` or `python`) */
  id: string;
  /** The unique identifier for the snippet file associated with the syntax highlighting rules */
  snippetFileId?: string;
}

/**
 * The `KeywordMapperArgs` interface defines the structure of the arguments for a keyword mapper, which is a function that maps keywords to token types based on a provided mapping.\
 * It directly corresponds to the `createKeywordMapper` function in Ace Editor, which is used to create a keyword mapper for syntax highlighting, i.e. `this.createKeywordMapper(map, defaultToken)`.
 */
export interface KeywordMapperArgs {
  map: Record<string, string>;
  defaultToken: string;
}

export interface TokenizerRule {
  token: string | string[] | KeywordMapperArgs;
  regex: string;
  next?: string;
  push?: string;
}

export interface IncludeRule {
  include: string;
}

export interface DefaultTokenRule {
  defaultToken: string;
}

/**
 * The `AceRule` type defines the structure of a syntax highlighting rule for the Ace Editor.\
 * It can be a `TokenizerRule`, which specifies how to tokenize code; an `IncludeRule`, which includes rules from another state; or a `DefaultTokenRule`, which specifies a default token type for unmatched text.\
 * These rules are used by Ace Editor to perform syntax highlighting based on the provided `SyntaxHighlightData`.
 */
export type AceRule = TokenizerRule | IncludeRule | DefaultTokenRule;

export type AceRules = {
  [state: string]: AceRule[];
};
