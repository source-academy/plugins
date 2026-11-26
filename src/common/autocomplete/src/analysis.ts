/**
 * Editor intelligence that an evaluator can provide for the code in the editor: where a name is
 * used, where it is declared, and the scope that it is in.
 *
 * The protocol is shaped after the Language Server Protocol and does not depend on the editor that
 * shows the code: a position is 0-based (`line`, `character`), as in LSP, not the 1-based row and
 * column of the autocomplete channel. An editor adapter (Ace's hooks, Monaco's document highlight,
 * definition and rename providers) converts, and nothing else.
 */

/** A position in the code, 0-based. */
export interface AnalysisPosition {
  line: number;
  character: number;
}

/** A range of the code: from `start` up to, and not including, `end`. */
export interface AnalysisRange {
  start: AnalysisPosition;
  end: AnalysisPosition;
}

/** The requests that an evaluator can answer. */
export type AnalysisRequestKind = "occurrences" | "definition" | "scope";

/**
 * Which requests an evaluator answers. A host asks only those that it has been told of: an
 * evaluator that does not know the analysis channel never answers, and would leave the request
 * pending.
 */
export type AnalysisCapabilities = Record<AnalysisRequestKind, boolean>;

export interface AnalysisCapabilitiesRequest {
  type: "request-capabilities";
}

export interface AnalysisCapabilitiesResponse {
  type: "capabilities";
  capabilities: AnalysisCapabilities;
}

export interface AnalysisRequest {
  type: "request";
  /** Correlates this request with its response. */
  requestId: number;
  kind: AnalysisRequestKind;
  /** The code in the editor. */
  code: string;
  /** The position of the cursor, or whatever the request is about. */
  position: AnalysisPosition;
}

/**
 * The answer to an `occurrences` or a `scope` request: every occurrence of the name at the
 * position, within its scope; or the ranges of the scope that the position is in.
 */
export interface AnalysisRangesResponse {
  type: "response";
  requestId: number;
  kind: "occurrences" | "scope";
  ranges: AnalysisRange[];
}

/** The answer to a `definition` request: where the name at the position is declared, if it is. */
export interface AnalysisDefinitionResponse {
  type: "response";
  requestId: number;
  kind: "definition";
  /** `null` if the name is not declared in the code (a name of the language's library, say). */
  range: AnalysisRange | null;
}

/** The evaluator could not answer (its analysis failed, for example on code that does not parse). */
export interface AnalysisErrorResponse {
  type: "error";
  requestId: number;
  message: string;
}

export type AnalysisResponse =
  AnalysisRangesResponse | AnalysisDefinitionResponse | AnalysisErrorResponse;

export type AnalysisMessage =
  AnalysisCapabilitiesRequest | AnalysisCapabilitiesResponse | AnalysisRequest | AnalysisResponse;
