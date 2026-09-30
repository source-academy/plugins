export interface SyntaxHighlightRequest {
  type: 'request';
}
export interface SyntaxHighlightResponse {
  type: 'response';
  data: TransferredSyntaxHighlightData;
}
export interface SyntaxHighlightAck {
  type: 'ack';
}

export type SyntaxHighlightMessage =
  | SyntaxHighlightRequest
  | SyntaxHighlightResponse
  | SyntaxHighlightAck;

/**
 * References an implementation supplied by an existing Ace mode.
 */
export interface ModeHook {
  hookFrom: string;
}

/**
 * A mode function that is executed in the runner through the syntax-channel
 * RPC connection.
 *
 * The arguments and return value must be structured-cloneable.
 */
// Ace mode extensions have different signatures, so the RPC boundary must accept arbitrary arguments.
export type ModeRpcFunction = (...args: any[]) => unknown;

/** A mode function can either reuse an Ace implementation or run remotely. */
export type ModeFunction = ModeHook | ModeRpcFunction;

/**
 * Methods exposed by the runner-side mode over the syntax channel.
 *
 * This is exported so web mode implementations can give the remote calls more
 * specific argument and result types where necessary.
 */
export interface ModeRpc {
  indents(...args: unknown[]): unknown;
  outdents(...args: unknown[]): unknown;
  autoOutdent(...args: unknown[]): unknown;
}

/** Identifies the runner method used for a mode function on the wire. */
export interface ModeRpcReference {
  rpc: keyof ModeRpc;
}

/** Structured-clone-safe representation of a mode function. */
export type TransferredModeFunction = ModeHook | ModeRpcReference;

/**
 * The `SyntaxHighlightData` interface defines the structure of the syntax highlighting information that the runner plugin sends to the web plugin.\
 * This data includes rules for tokenizing code, folding rules for code blocks, and other information necessary for the web plugin to perform syntax highlighting in the editor.\
 *
 * Right now, the `SyntaxHighlightData` uses functions from other pre-existing Ace Editor modes (the `hookFrom` properties) to determine how to perform syntax highlighting, folding, indentation, and outdenting.\
 * This design allows the plugin to use existing Ace Editor modes, at the cost of some flexibility. If more flexibility is needed in the future, it should be extended.
 */
export interface SyntaxHighlightData {
  highlightRules: AceRules;
  foldingRules: ModeHook & { args: string[] };
  /** The start of a line comment */
  lineCommentStart: string;
  /** The regular expressions which have to precede a quote for pairing to occur */
  pairQuotesAfter: Record<string, RegExp>;
  /** The indentation rules */
  indents: ModeFunction;
  /** The outdentation rules */
  outdents: ModeFunction;
  /** The auto-outdentation rules */
  autoOutdent: ModeFunction;
  /** The unique identifier for the syntax highlighting rules (ensure it doesn't conflict with other syntax highlighting rules, such as `java` or `python`) */
  id: string;
  /** The unique identifier for the snippet file associated with the syntax highlighting rules */
  snippetFileId?: string;
}

/**
 * The structured-clone-safe form sent from the runner to the web plugin.
 * Callable properties are represented by RPC method references.
 */
export type TransferredSyntaxHighlightData = Omit<
  SyntaxHighlightData,
  'indents' | 'outdents' | 'autoOutdent'
> & {
  indents: TransferredModeFunction;
  outdents: TransferredModeFunction;
  autoOutdent: TransferredModeFunction;
};

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
