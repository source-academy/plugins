import {
  Button,
  ButtonGroup,
  Card,
  Classes,
  Divider,
  Icon,
  Popover,
  Pre,
  Slider,
} from "@blueprintjs/core";
import { getHotkeyHandler, type HotkeyItem } from "@mantine/hooks";
import type {
  FunctionValueRule,
  SerializedStepperNode,
  SerializedStepperStep,
  SyntaxProfile,
  SyntaxTemplatePart,
} from "@sourceacademy/common-stepper";
import classNames from "classnames";
import { useCallback, useEffect, useState } from "react";

import { injectStepperStyles } from "./styles";

/**
 * The serialized AST nodes are plain JSON. `Record<string, any>` lets the renderer read the
 * language-specific fields (e.g. `left`, `operator`, `params`) without per-node typing, exactly as
 * the original (class-based) renderer did after casting.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- language-specific AST fields are read untyped, exactly as the original class-based renderer did after casting
type StepperNode = SerializedStepperNode & Record<string, any>;

function SubstDefaultText() {
  return (
    <div>
      <div id="substituter-default-text" className={Classes.RUNNING_TEXT}>
        Welcome to the Stepper!
        <br />
        <br />
        On this tab, the REPL will be hidden from view, so do check that your code has no errors
        before running the stepper. You may use this tool by writing your program on the left, then
        dragging the slider above to see its evaluation.
        <br />
        <br />
        On even-numbered steps, the part of the program that will be evaluated next is highlighted
        in yellow. On odd-numbered steps, the result of the evaluation is highlighted in green. You
        can change the maximum steps limit (500-5000, default 1000) in the control bar.
        <br />
        <br />
        <Divider />
        Some useful keyboard shortcuts:
        <br />
        <br />
        a: Move to the first step
        <br />
        e: Move to the last step
        <br />
        f: Move to the next step
        <br />
        b: Move to the previous step
        <br />
        <br />
        Note that these shortcuts are only active when the browser focus is on this tab (click on or
        above the explanation text).
      </div>
    </div>
  );
}

function SubstCodeDisplay(props: { content: string }) {
  return (
    <Card>
      <Pre className="result-output">{props.content}</Pre>
    </Card>
  );
}

type StepperViewProps = {
  content: SerializedStepperStep[];
  /** The active language's rendering rules; when absent, the default (Source) syntax is used. */
  profile?: SyntaxProfile;
};

/**
 * The presentational stepper: a slider + breakpoint controls over a list of serialized steps, with
 * a custom AST renderer and an explanation panel. A faithful port of the frontend's legacy
 * `SideContentSubstVisualizer`, minus its redux/i18n/js-slang couplings.
 */
export default function StepperView(props: StepperViewProps) {
  const [stepValue, setStepValue] = useState(1);
  const lastStepValue = props.content.length;
  const hasRunCode = lastStepValue !== 0;

  useEffect(() => injectStepperStyles(), []);

  // reset stepValue when content changes
  useEffect(() => {
    setStepValue(1);
  }, [props.content]);

  const stepNextBreakpoint = useCallback(() => {
    // Search forward from current step for a DebuggerStatement redex
    for (let i = stepValue; i < props.content.length; i++) {
      const markers = props.content[i].markers;
      if (markers?.some(marker => marker.redexNodeType === "DebuggerStatement")) {
        setStepValue(i + 1); // +1 because stepValue is 1-indexed
        return;
      }
    }
    // Optional: If no next breakpoint found, go to the last step
    setStepValue(props.content.length);
  }, [stepValue, props.content]);

  const stepPreviousBreakpoint = useCallback(() => {
    // Start searching from the step BEFORE the current one
    for (let i = stepValue - 2; i >= 0; i--) {
      const markers = props.content[i].markers;
      const isDebuggerStep = markers?.some(marker => marker.redexNodeType === "DebuggerStatement");
      if (isDebuggerStep) {
        setStepValue(i + 1); // Convert back to 1-based indexing
        return;
      }
    }
    // Optional: If no previous breakpoint found, go to the first step
    setStepValue(1);
  }, [stepValue, props.content]);

  const stepPrevious = () => setStepValue(Math.max(1, stepValue - 1));
  const stepNext = () => setStepValue(Math.min(props.content.length, stepValue + 1));

  // Setup hotkey bindings
  const hotkeyBindings: HotkeyItem[] = hasRunCode
    ? [
        ["a", stepPreviousBreakpoint],
        ["f", stepNext],
        ["b", stepPrevious],
        ["e", stepNextBreakpoint],
      ]
    : [
        ["a", () => {}],
        ["f", () => {}],
        ["b", () => {}],
        ["e", () => {}],
      ];
  const hotkeyHandler = getHotkeyHandler(hotkeyBindings);

  const getExplanation = useCallback(
    (value: number): string => {
      const contIndex = value <= lastStepValue ? value - 1 : 0;
      // Right now, prioritize the first marker
      const markers = props.content[contIndex].markers;
      if (markers === undefined || markers[0] === undefined) {
        return "...";
      } else {
        return markers[0].explanation ?? "...";
      }
    },
    [lastStepValue, props.content],
  );

  const getAST = useCallback(
    (value: number): SerializedStepperStep => {
      const contIndex = value <= lastStepValue ? value - 1 : 0;
      return props.content[contIndex];
    },
    [lastStepValue, props.content],
  );

  return (
    <div
      className={classNames("sa-substituter", Classes.DARK)}
      onKeyDown={hotkeyHandler}
      tabIndex={-1} // tab index necessary to fire keydown events on div element
    >
      <Slider
        disabled={!hasRunCode}
        min={1}
        max={lastStepValue}
        onChange={setStepValue}
        value={stepValue <= lastStepValue ? stepValue : 1}
      />
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <ButtonGroup>
          <Button
            disabled={!hasRunCode}
            icon="double-chevron-left"
            onClick={stepPreviousBreakpoint}
          />
          <Button disabled={!hasRunCode} icon="chevron-left" onClick={stepPrevious} />
          <Button disabled={!hasRunCode} icon="chevron-right" onClick={stepNext} />
          <Button disabled={!hasRunCode} icon="double-chevron-right" onClick={stepNextBreakpoint} />
        </ButtonGroup>
      </div>{" "}
      <br />
      {hasRunCode ? (
        <CustomASTRenderer {...getAST(stepValue)} profile={props.profile} />
      ) : (
        <SubstDefaultText />
      )}
      {hasRunCode ? <SubstCodeDisplay content={getExplanation(stepValue)} /> : null}
    </div>
  );
}

/*
  Custom AST renderer for Stepper (Inspired by astring library)
  This custom AST renderer utilizes the recursive approach of handling rendering of various
  StepperNodes by using nested <div> and <span>. Unlike React-ace, using our own renderer makes our
  stepper more customizable. For example, we can add a code component that is hoverable using a
  blueprint tooltip.
*/

interface RenderContext {
  parentNode?: StepperNode;
  isRight?: boolean; // specified for binary expression
  styleWrapper: StyleWrapper;
  popoverDepth?: number;
  /**
   * The active language's rendering rules. When present, nodes are rendered generically from their
   * template (see {@link renderNode}); when absent, the built-in Source/JavaScript renderers are
   * used. Threaded so a whole tree renders in one language.
   */
  profile?: SyntaxProfile;
  /**
   * Forces a named function value to render its full body (its template) rather than collapsing to a
   * mu-term. Set only when rendering the contents of a function-definition popover, so the popover
   * shows the body while every other occurrence stays collapsed. See {@link SyntaxProfile.functionValues}.
   */
  expandFunctionValue?: boolean;
}

/** Maps a profile token class to the stepper's CSS colour class. */
const TOKEN_CLASS: Record<string, string> = {
  operator: "stepper-operator",
  identifier: "stepper-identifier",
  literal: "stepper-literal",
  conditional: "stepper-conditional-operator",
};

/** Reads a node property by a (possibly dotted, e.g. `"id.name"`) path, for profile `prop` parts. */
function readNodeProp(node: StepperNode, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) => (value == null ? value : (value as Record<string, unknown>)[key]),
      node,
    );
}

type StyleWrapper = (node: StepperNode) => (preformatted: React.ReactNode) => React.ReactNode;

// composeStyleWrapper takes two style wrappers and merges their effect together.
function composeStyleWrapper(
  first: StyleWrapper | undefined,
  second: StyleWrapper | undefined,
): StyleWrapper | undefined {
  return first === undefined && second === undefined
    ? undefined
    : first === undefined
      ? second
      : second === undefined
        ? first
        : (node: StepperNode) => (preformatted: React.ReactNode) => {
            const afterFirstStyle = first(node)(preformatted);
            return second(node)(afterFirstStyle);
          };
}

interface FunctionDefinitionPopoverContentProps {
  node: StepperNode;
  styleWrapper: StyleWrapper | undefined;
  popoverDepth: number;
  renderNode: (node: StepperNode, context: RenderContext) => React.ReactNode;
  renderFunctionArguments: (
    nodes: StepperNode[],
    renderNodeFn: (node: StepperNode, context: RenderContext) => React.ReactNode,
    styleWrapper: StyleWrapper | undefined,
    popoverDepth: number,
  ) => React.ReactNode;
}

function FunctionDefinitionPopoverContent({
  node,
  styleWrapper,
  popoverDepth,
  renderNode,
  renderFunctionArguments,
}: FunctionDefinitionPopoverContentProps) {
  return (
    <div className={classNames("stepper-popover", Classes.DARK)}>
      <div className="stepper-display">
        <Icon icon="code" />
        <span>{" Function definition"}</span>
        <pre className={Classes.CODE_BLOCK}>
          <code>
            {renderFunctionArguments(node.params, renderNode, styleWrapper, popoverDepth)}
            <span className="stepper-identifier">{" => "}</span>
            {renderNode(node.body, {
              styleWrapper: styleWrapper ?? (_node => p => p),
              popoverDepth: popoverDepth + 1,
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}

interface ProfileFunctionDefinitionPopoverProps {
  node: StepperNode;
  wrapper: StyleWrapper | undefined;
  popoverDepth: number;
  profile?: SyntaxProfile;
}

/**
 * The popover body for a profile-rendered (e.g. Python) function value: the function's full
 * definition, rendered from its own template (forced-expanded), inside the same chrome the built-in
 * popover uses. This is a **component** (not an eagerly-computed node) so React renders it lazily —
 * only when the popover actually opens — which keeps a *recursive* function's nested popovers from
 * expanding forever at render time (each level renders on hover, exactly like the built-in popover).
 */
function ProfileFunctionDefinitionPopover({
  node,
  wrapper,
  popoverDepth,
  profile,
}: ProfileFunctionDefinitionPopoverProps) {
  return (
    <div className={classNames("stepper-popover", Classes.DARK)}>
      <div className="stepper-display">
        <Icon icon="code" />
        <span>{" Function definition"}</span>
        <pre className={Classes.CODE_BLOCK}>
          <code>
            {renderNode(node, {
              styleWrapper: wrapper ?? (_n => p => p),
              popoverDepth: popoverDepth + 1,
              profile,
              expandFunctionValue: true,
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}

/**
 * renderNode renders a serialized Stepper AST node to a React ReactNode.
 */
function renderNode(
  currentNode: StepperNode | null | undefined,
  renderContext: RenderContext,
): React.ReactNode {
  if (currentNode == null) return null;
  const styleWrapper = renderContext.styleWrapper;
  const popoverDepth = renderContext.popoverDepth ?? 0;
  const renderers = {
    Literal(node: StepperNode) {
      const stringifyLiteralValue = (value: unknown) =>
        typeof value === "string" ? '"' + value + '"' : value !== null ? String(value) : "null";
      return (
        <span className="stepper-literal">
          {node.raw ? node.raw : stringifyLiteralValue(node.value)}
        </span>
      );
    },
    Identifier(node: StepperNode) {
      return <span>{node.name}</span>;
    },
    // Expressions
    UnaryExpression(node: StepperNode) {
      return (
        <span>
          <span className="stepper-operator">{`${node.operator}`}</span>
          {renderNode(node.argument, {
            parentNode: node,
            styleWrapper: styleWrapper,
            popoverDepth: popoverDepth,
          })}
        </span>
      );
    },
    BinaryExpression(node: StepperNode) {
      return (
        <span>
          {renderNode(node.left, {
            parentNode: node,
            isRight: false,
            styleWrapper: styleWrapper,
            popoverDepth: popoverDepth,
          })}
          <span className="stepper-operator">{` ${node.operator} `}</span>
          {renderNode(node.right, {
            parentNode: node,
            isRight: true,
            styleWrapper: styleWrapper,
            popoverDepth: popoverDepth,
          })}
        </span>
      );
    },
    LogicalExpression(node: StepperNode) {
      return (
        <span>
          {renderNode(node.left, {
            parentNode: node,
            isRight: false,
            styleWrapper: styleWrapper,
            popoverDepth: popoverDepth,
          })}
          <span className="stepper-operator">{` ${node.operator} `}</span>
          {renderNode(node.right, {
            parentNode: node,
            isRight: true,
            styleWrapper: styleWrapper,
            popoverDepth: popoverDepth,
          })}
        </span>
      );
    },
    ConditionalExpression(node: StepperNode) {
      return (
        <span>
          {renderNode(node.test, { styleWrapper: styleWrapper, popoverDepth: popoverDepth })}
          <span className="stepper-conditional-operator">{` ? `}</span>
          {renderNode(node.consequent, { styleWrapper: styleWrapper, popoverDepth: popoverDepth })}
          <span className="stepper-conditional-operator">{` : `}</span>
          {renderNode(node.alternate, { styleWrapper: styleWrapper, popoverDepth: popoverDepth })}
        </span>
      );
    },
    ArrayExpression(node: StepperNode) {
      // Render all arguments inside an array
      const args: React.ReactNode[] = node.elements
        .filter((arg: StepperNode | null) => arg !== null)
        .map((arg: StepperNode) =>
          renderNode(arg, { styleWrapper: styleWrapper, popoverDepth: popoverDepth }),
        );

      const renderedArguments = args.slice(1).reduce(
        (result, item) => (
          <span>
            {result}
            {", "}
            {item}
          </span>
        ),
        args[0],
      );
      return (
        <span>
          {"["}
          {renderedArguments}
          {"]"}
        </span>
      );
    },
    ArrowFunctionExpression(node: StepperNode) {
      /**
       * Add hovering effect to children nodes only if it is an identifier with the name
       * corresponding to the name of lambda expression
       */
      function muTermStyleWrapper(targetNode: StepperNode) {
        if (targetNode.type === "Identifier" && targetNode.name === node.name) {
          function addHovering(preprocessed: React.ReactNode): React.ReactNode {
            return (
              <span className="stepper-mu-term">
                <Popover
                  interactionKind="hover"
                  placement="bottom"
                  usePortal={popoverDepth === 0}
                  lazy
                  popoverClassName="stepper-popover"
                  content={
                    <FunctionDefinitionPopoverContent
                      node={node}
                      styleWrapper={composeStyleWrapper(styleWrapper, muTermStyleWrapper)}
                      popoverDepth={popoverDepth}
                      renderNode={renderNode}
                      renderFunctionArguments={renderFunctionArguments}
                    />
                  }
                >
                  {preprocessed}
                </Popover>
              </span>
            );
          }
          return addHovering;
        } else {
          // Do nothing
          return (preprocessed: React.ReactNode) => preprocessed;
        }
      }

      // If the name is specified, render the name and add hovering for the body.
      return node.name ? (
        <span className="stepper-mu-term">
          <Popover
            interactionKind="hover"
            placement="bottom"
            usePortal={popoverDepth === 0}
            lazy
            content={
              <FunctionDefinitionPopoverContent
                node={node}
                styleWrapper={composeStyleWrapper(styleWrapper, muTermStyleWrapper)}
                popoverDepth={popoverDepth}
                renderNode={renderNode}
                renderFunctionArguments={renderFunctionArguments}
              />
            }
          >
            {node.name}
          </Popover>
        </span>
      ) : (
        <span>
          {renderFunctionArguments(node.params, renderNode, styleWrapper, popoverDepth)}
          <span className="stepper-identifier">{" => "}</span>
          {renderNode(node.body, {
            styleWrapper: composeStyleWrapper(styleWrapper, muTermStyleWrapper)!,
            popoverDepth: popoverDepth,
          })}
        </span>
      );
    },
    CallExpression(node: StepperNode) {
      let renderedCallee = renderNode(node.callee, {
        styleWrapper: styleWrapper,
        popoverDepth: popoverDepth,
      });
      if (node.callee.type === "ArrowFunctionExpression" && node.callee.name === undefined) {
        renderedCallee = (
          <span>
            {"("}
            {renderedCallee}
            {")"}
          </span>
        );
      }
      return (
        <span>
          {renderedCallee}
          {renderArguments(node.arguments)}
        </span>
      );
    },
    Program(node: StepperNode) {
      return (
        <span>
          {node.body.map((ast: StepperNode, index: number) => (
            <div key={index}>
              {renderNode(ast, { styleWrapper: styleWrapper, popoverDepth: popoverDepth })}
            </div>
          ))}
        </span>
      );
    },
    IfStatement(node: StepperNode) {
      return (
        <span>
          <span>
            <span className="stepper-identifier">{"if "}</span>
            {"("}
            <span>
              {renderNode(node.test, { styleWrapper: styleWrapper, popoverDepth: popoverDepth })}
            </span>
            {") "}
          </span>
          <span>
            {renderNode(node.consequent, {
              styleWrapper: styleWrapper,
              popoverDepth: popoverDepth,
            })}
          </span>
          {node.alternate && (
            <span>
              <span className="stepper-identifier">{" else "}</span>
              {renderNode(node.alternate, {
                styleWrapper: styleWrapper,
                popoverDepth: popoverDepth,
              })}
            </span>
          )}
        </span>
      );
    },
    ReturnStatement(node: StepperNode) {
      return (
        <span>
          <span className="stepper-operator">{"return "}</span>
          {node.argument &&
            renderNode(node.argument, { styleWrapper: styleWrapper, popoverDepth: popoverDepth })}
          {";"}
        </span>
      );
    },
    BlockStatement(node: StepperNode) {
      return (
        <span>
          {"{"}
          {node.body.map((ast: StepperNode, index: number) => (
            <div key={index} style={{ marginLeft: "15px" }}>
              {renderNode(ast, { styleWrapper, popoverDepth: popoverDepth })}
            </div>
          ))}
          {"}"}
        </span>
      );
    },
    ExpressionStatement(node: StepperNode) {
      return (
        <span>
          {renderNode(node.expression, { styleWrapper: styleWrapper, popoverDepth: popoverDepth })}
          {";"}
        </span>
      );
    },
    FunctionDeclaration(node: StepperNode) {
      return (
        <span>
          <span className="stepper-identifier">{`function ${node.id.name}`}</span>
          <span>{renderArguments(node.params)}</span>
          <span>
            {" "}
            {renderNode(node.body, { styleWrapper: styleWrapper, popoverDepth: popoverDepth })}
          </span>
        </span>
      );
    },
    VariableDeclaration(node: StepperNode) {
      return (
        <span>
          <span className="stepper-identifier">{node.kind} </span>
          {node.declarations.map((ast: StepperNode, idx: number) => (
            <span key={idx}>
              {idx !== 0 && ", "}
              {renderNode(ast, { styleWrapper: styleWrapper, popoverDepth: popoverDepth })}
            </span>
          ))}
          {";"}
        </span>
      );
    },
    VariableDeclarator(node: StepperNode) {
      return (
        <span>
          {renderNode(node.id, { styleWrapper: styleWrapper, popoverDepth: popoverDepth })}
          {" = "}
          {node.init
            ? renderNode(node.init, { styleWrapper: styleWrapper, popoverDepth: popoverDepth })
            : "undefined"}
        </span>
      );
    },
    DebuggerStatement(_node: StepperNode) {
      return <span className="stepper-operator">debugger;</span>;
    },
  };

  // Additional renderers
  const renderFunctionArguments = (
    nodes: StepperNode[] | undefined,
    renderNodeFn: typeof renderNode,
    styleWrapper: StyleWrapper | undefined,
    popoverDepth: number,
  ) => {
    if (!nodes) return "()";
    const args: React.ReactNode[] = nodes.map(arg =>
      renderNodeFn(arg, {
        styleWrapper: styleWrapper ?? (_node => p => p),
        popoverDepth: popoverDepth,
      }),
    );
    let renderedArguments = args.slice(1).reduce(
      (result, item) => (
        <span>
          {result}
          {", "}
          {item}
        </span>
      ),
      args[0],
    );
    if (args.length !== 1) {
      renderedArguments = (
        <span>
          {"("}
          {renderedArguments}
          {")"}
        </span>
      );
    }
    return renderedArguments;
  };

  const renderArguments = (nodes: StepperNode[] | undefined) => {
    if (!nodes) return "()";
    const args: React.ReactNode[] = nodes.map(arg =>
      renderNode(arg, { styleWrapper: styleWrapper, popoverDepth: popoverDepth }),
    );
    let renderedArguments = args.slice(1).reduce(
      (result, item) => (
        <span>
          {result}
          {", "}
          {item}
        </span>
      ),
      args[0],
    );
    renderedArguments = (
      <span>
        {"("}
        {renderedArguments}
        {")"}
      </span>
    );
    return renderedArguments;
  };

  // Renders a node generically from a language profile's template (see SyntaxProfile). The host
  // knows no grammar: each part emits literal text or recurses into a child (itself rendered via the
  // profile), so any language renders with zero host-side, language-specific code. Only `child`
  // parts establish a parenthesisation context; list/block/line items intentionally do not.
  const renderTemplate = (node: StepperNode, template: SyntaxTemplatePart[]): React.ReactNode => {
    const childContext = (extra: Partial<RenderContext>): RenderContext => ({
      styleWrapper,
      popoverDepth,
      profile: renderContext.profile,
      ...extra,
    });
    const cls = (c?: string) => (c ? TOKEN_CLASS[c] : undefined);
    const renderPart = (part: SyntaxTemplatePart, key: number): React.ReactNode => {
      if (typeof part === "string") return <span key={key}>{part}</span>;
      if ("token" in part)
        return (
          <span key={key} className={cls(part.cls)}>
            {part.token}
          </span>
        );
      if ("prop" in part) {
        const value = readNodeProp(node, part.prop);
        return (
          <span key={key} className={cls(part.cls)}>
            {value == null ? "" : String(value)}
          </span>
        );
      }
      if ("child" in part) {
        const child = node[part.child] as StepperNode | null | undefined;
        return (
          <span key={key}>
            {renderNode(child, childContext({ parentNode: node, isRight: part.isRight }))}
          </span>
        );
      }
      if ("list" in part) {
        const items = (node[part.list] as StepperNode[] | undefined) ?? [];
        if (items.length === 0) return null;
        return (
          <span key={key}>
            {part.prefix}
            {items.map((item, i) => (
              <span key={i}>
                {i !== 0 ? part.sep : null}
                {renderNode(item, childContext({}))}
              </span>
            ))}
          </span>
        );
      }
      if ("block" in part) {
        const items = (node[part.block] as StepperNode[] | undefined) ?? [];
        return (
          <span key={key}>
            {items.map((item, i) => (
              <div key={i} style={{ marginLeft: "15px" }}>
                {renderNode(item, childContext({}))}
              </div>
            ))}
          </span>
        );
      }
      if ("lines" in part) {
        const items = (node[part.lines] as StepperNode[] | undefined) ?? [];
        return (
          <span key={key}>
            {items.map((item, i) => (
              <div key={i}>{renderNode(item, childContext({}))}</div>
            ))}
          </span>
        );
      }
      if ("when" in part) {
        return node[part.when] ? (
          <span key={key}>{part.parts.map((p, i) => renderPart(p, i))}</span>
        ) : null;
      }
      return null;
    };
    return <span>{template.map((part, i) => renderPart(part, i))}</span>;
  };

  // Profile-driven function *values* (mu-term + popover), mirroring the built-in
  // ArrowFunctionExpression behaviour for any language that declares its function-value node types
  // (see SyntaxProfile.functionValues). A named function value collapses to its name with a hover
  // popover showing its full definition; an anonymous one renders inline from its template.
  const functionValueRuleFor = (type: string): FunctionValueRule | undefined =>
    renderContext.profile?.functionValues?.find(rule => rule.type === type);

  // Renders a named function value collapsed as its name, with a hover popover showing its body. The
  // popover content is a component element (lazily rendered), never an eagerly-computed node, so a
  // recursive function's nested popovers do not expand forever at render time.
  const renderProfileFunctionValue = (funcNode: StepperNode, funcName: string): React.ReactNode => {
    // Recursive hovering: identifiers in the body that refer back to this function (by name) are
    // themselves wrapped in the same popover, so a recursive definition stays explorable.
    const muTermWrapper: StyleWrapper = (targetNode: StepperNode) =>
      targetNode.type === "Identifier" && targetNode.name === funcName
        ? (preprocessed: React.ReactNode) => (
            <span className="stepper-mu-term">
              <Popover
                interactionKind="hover"
                placement="bottom"
                usePortal={popoverDepth === 0}
                lazy
                popoverClassName="stepper-popover"
                content={
                  <ProfileFunctionDefinitionPopover
                    node={funcNode}
                    wrapper={composeStyleWrapper(styleWrapper, muTermWrapper)}
                    popoverDepth={popoverDepth}
                    profile={renderContext.profile}
                  />
                }
              >
                {preprocessed}
              </Popover>
            </span>
          )
        : (preprocessed: React.ReactNode) => preprocessed;

    return (
      <span className="stepper-mu-term">
        <Popover
          interactionKind="hover"
          placement="bottom"
          usePortal={popoverDepth === 0}
          lazy
          content={
            <ProfileFunctionDefinitionPopover
              node={funcNode}
              wrapper={composeStyleWrapper(styleWrapper, muTermWrapper)}
              popoverDepth={popoverDepth}
              profile={renderContext.profile}
            />
          }
        >
          {funcName}
        </Popover>
      </span>
    );
  };

  // Entry point of rendering. With a language profile, render the node generically from its template
  // (collapsing a named function value to a mu-term); otherwise fall back to the built-in
  // Source/JavaScript renderers above.
  const profile = renderContext.profile;
  let isParenthesis = expressionNeedsParenthesis(
    currentNode,
    renderContext.parentNode,
    renderContext.isRight,
    profile,
  );
  let result: React.ReactNode;
  if (profile) {
    const functionRule = functionValueRuleFor(currentNode.type);
    const funcName = functionRule ? readNodeProp(currentNode, functionRule.nameProp) : undefined;
    if (functionRule && funcName != null && funcName !== "" && !renderContext.expandFunctionValue) {
      // A named function value: collapse to a mu-term. It is atomic, so never parenthesised.
      result = renderProfileFunctionValue(currentNode, String(funcName));
      isParenthesis = false;
    } else {
      // A profile is authoritative: never fall back to JS syntax for an unmapped node type.
      const template = profile.templates[currentNode.type];
      result = template ? renderTemplate(currentNode, template) : `<${currentNode.type}>`;
    }
  } else {
    const renderer = (
      renderers as unknown as Record<string, (node: StepperNode) => React.ReactNode>
    )[currentNode.type];
    result = renderer ? renderer(currentNode) : `<${currentNode.type}>`; // For debugging in case some AST renderer has not been implemented yet
  }
  if (isParenthesis) {
    result = (
      <span>
        {"("}
        {result}
        {")"}
      </span>
    );
  }
  // custom wrapper style
  if (styleWrapper) {
    result = styleWrapper(currentNode)(result);
  }
  return result;
}
/////////////////////////////////// Custom AST Renderer for Stepper //////////////////////////////////

/**
 * A React component that handles rendering of a single step's AST + markers.
 */
function CustomASTRenderer(
  props: SerializedStepperStep & { profile?: SyntaxProfile },
): React.ReactNode {
  const getDisplayedNode = useCallback((): React.ReactNode => {
    function markerStyleWrapper(node: StepperNode) {
      return (rendered: React.ReactNode) => {
        if (props.markers === undefined) {
          return rendered;
        }
        // highlight the entire function declaration body if it's a function declaration,
        // else just highlight that line
        let returnNode = <span>{rendered}</span>;
        props.markers.forEach(marker => {
          // Match by stable node id rather than object identity, which does not survive
          // serialization across the runner/host channel.
          if (marker.redexId !== undefined && marker.redexId === node.nodeId) {
            const Wrapper = node.type === "FunctionDeclaration" ? "div" : "span";
            returnNode = <Wrapper className={marker.redexType}>{returnNode}</Wrapper>;
          }
        });
        return returnNode;
      };
    }
    return renderNode(props.ast, {
      styleWrapper: markerStyleWrapper,
      popoverDepth: 0,
      profile: props.profile,
    });
  }, [props]);
  return <div className="stepper-display">{getDisplayedNode()}</div>;
}

/**
 * expressionNeedsParenthesis
 * checks whether there should be parentheses wrapped around the node or not
 */
function expressionNeedsParenthesis(
  node: StepperNode,
  parentNode?: StepperNode,
  isRightHand?: boolean,
  profile?: SyntaxProfile,
) {
  if (parentNode === undefined) {
    return false;
  }

  // A profile supplies its language's precedence; otherwise use the built-in JavaScript tables.
  const exprPrecedence = profile?.expressionPrecedence ?? EXPRESSIONS_PRECEDENCE;
  const opPrecedence = profile?.operatorPrecedence ?? OPERATOR_PRECEDENCE;

  const nodePrecedence = exprPrecedence[node.type as keyof typeof exprPrecedence] as
    | number
    | undefined;
  if (nodePrecedence === NEEDS_PARENTHESES) {
    return true;
  }
  const parentNodePrecedence = exprPrecedence[parentNode.type as keyof typeof exprPrecedence] as
    | number
    | undefined;
  if (nodePrecedence === undefined || parentNodePrecedence === undefined) {
    return false;
  }

  if (nodePrecedence !== parentNodePrecedence) {
    return (
      (!isRightHand && nodePrecedence === 15 && parentNodePrecedence === 14) ||
      nodePrecedence < parentNodePrecedence
    );
  }

  if (!("operator" in node) || !("operator" in parentNode)) {
    return false;
  }

  if (nodePrecedence !== 13 && nodePrecedence !== 14) {
    // Not a `LogicalExpression` or `BinaryExpression`
    return false;
  }
  if (node.operator === "**" && parentNode.operator === "**") {
    // Exponentiation operator has right-to-left associativity
    return !isRightHand;
  }
  if (
    nodePrecedence === 13 &&
    parentNodePrecedence === 13 &&
    (node.operator === "??" || parentNode.operator === "??")
  ) {
    return true;
  }

  const nodeOperatorPrecedence = opPrecedence[node.operator as keyof typeof opPrecedence];
  const parentNodeOperatorPrecedence =
    opPrecedence[parentNode.operator as keyof typeof opPrecedence];
  return isRightHand
    ? nodeOperatorPrecedence <= parentNodeOperatorPrecedence
    : nodeOperatorPrecedence <= parentNodeOperatorPrecedence;
}
const OPERATOR_PRECEDENCE = {
  "||": 2,
  "??": 3,
  "&&": 4,
  "|": 5,
  "^": 6,
  "&": 7,
  "==": 8,
  "!=": 8,
  "===": 8,
  "!==": 8,
  "<": 9,
  ">": 9,
  "<=": 9,
  ">=": 9,
  in: 9,
  instanceof: 9,
  "<<": 10,
  ">>": 10,
  ">>>": 10,
  "+": 11,
  "-": 11,
  "*": 12,
  "%": 12,
  "/": 12,
  "**": 13,
};
const NEEDS_PARENTHESES = 17;
const EXPRESSIONS_PRECEDENCE = {
  // Definitions
  ArrayExpression: 20,
  TaggedTemplateExpression: 20,
  ThisExpression: 20,
  Identifier: 20,
  PrivateIdentifier: 20,
  Literal: 18,
  TemplateLiteral: 20,
  Super: 20,
  SequenceExpression: 20,
  // Operations
  MemberExpression: 19,
  ChainExpression: 19,
  CallExpression: 19,
  NewExpression: 19,
  // Other definitions
  ArrowFunctionExpression: NEEDS_PARENTHESES,
  ClassExpression: NEEDS_PARENTHESES,
  FunctionExpression: NEEDS_PARENTHESES,
  ObjectExpression: NEEDS_PARENTHESES,
  // Other operations
  UpdateExpression: 16,
  UnaryExpression: 15,
  AwaitExpression: 15,
  BinaryExpression: 14,
  LogicalExpression: 13,
  ConditionalExpression: 4,
  AssignmentExpression: 3,
  YieldExpression: 2,
  RestElement: 1,
};
