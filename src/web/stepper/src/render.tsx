import { Classes, Icon, Popover } from "@blueprintjs/core";
import type {
  FunctionValueRule,
  SerializedStepperNode,
  SerializedStepperStep,
  SyntaxProfile,
  SyntaxTemplatePart,
} from "@sourceacademy/common-stepper";
import classNames from "classnames";
import { useCallback } from "react";

/**
 * The serialized AST nodes are plain JSON. `Record<string, any>` lets the renderer read the
 * language-specific fields (e.g. `left`, `operator`, `params`) without per-node typing, exactly as
 * the original (class-based) renderer did after casting.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- language-specific AST fields are read untyped, exactly as the original class-based renderer did after casting
export type StepperNode = SerializedStepperNode & Record<string, any>;

/**
 * Host-specific renderers for node types a language profile does not cover (e.g. the e-stepper's
 * `EnvBlock` and `Ref`). Consulted before the profile; `renderChild` renders a child node in the
 * same context (profile, markers, renderers).
 */
export type NodeRenderers = Record<
  string,
  (
    node: StepperNode,
    renderChild: (child: StepperNode | null | undefined) => React.ReactNode,
  ) => React.ReactNode
>;

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
  /** Host-specific renderers for node types outside the profile — see {@link NodeRenderers}. */
  nodeRenderers?: NodeRenderers;
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
  renderNode: typeof renderNode;
  renderFunctionArguments: (
    nodes: StepperNode[] | undefined,
    renderNodeFn: typeof renderNode,
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
 * The popover body for a {@link HoverTextRule}: a single already-formatted line the language
 * computed ahead of time (e.g. `"built-in function print"`), unlike
 * {@link ProfileFunctionDefinitionPopover}'s expanded function body — there is no body to render here,
 * just the text, inside the same chrome the function-definition popover uses.
 */
function ProfileHoverTextPopover({ text }: { text: string }) {
  return (
    <div className={classNames("stepper-popover", Classes.DARK)}>
      <div className="stepper-display">
        <Icon icon="info-sign" />
        <span>{` ${text}`}</span>
      </div>
    </div>
  );
}

/** Popover body for an `image` part: the inline opaque-value thumbnail, enlarged to be legible. */
function EnlargedThumbnailPopover({ src, alt }: { src: string; alt?: string }) {
  return (
    <div className={classNames("stepper-popover", Classes.DARK)}>
      <div className="stepper-display">
        {alt ? (
          <>
            <Icon icon="media" />
            <span>{` ${alt}`}</span>
          </>
        ) : null}
        <img className="stepper-opaque-thumbnail-large" src={src} alt={alt ?? ""} />
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
      nodeRenderers: renderContext.nodeRenderers,
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
      if ("unless" in part) {
        return node[part.unless] ? null : (
          <span key={key}>{part.parts.map((p, i) => renderPart(p, i))}</span>
        );
      }
      if ("image" in part) {
        const src = readNodeProp(node, part.image);
        if (typeof src !== "string" || !src.startsWith("data:")) return null;
        const alt = part.altProp === undefined ? undefined : readNodeProp(node, part.altProp);
        const altText = alt == null ? "" : String(alt);
        return (
          <Popover
            key={key}
            interactionKind="hover"
            placement="bottom"
            usePortal={popoverDepth === 0}
            lazy
            popoverClassName="stepper-popover"
            content={<EnlargedThumbnailPopover src={src} alt={altText} />}
          >
            <img
              className={classNames("stepper-opaque-thumbnail", cls(part.cls))}
              src={src}
              alt={altText}
            />
          </Popover>
        );
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
  const hostRenderer = renderContext.nodeRenderers?.[currentNode.type];
  if (hostRenderer) {
    result = hostRenderer(currentNode, child =>
      renderNode(child, {
        styleWrapper,
        popoverDepth,
        profile,
        nodeRenderers: renderContext.nodeRenderers,
      }),
    );
  } else if (profile) {
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

    // A fixed-text hover popover (e.g. a builtin's `<built-in function print>`) is independent of the
    // function-value mu-term collapse above and applies regardless of which branch produced `result` —
    // a node type can be listed in both `functionValues` and `hoverText` and get both behaviours, not
    // just whichever branch happened to run first. See SyntaxProfile.hoverText.
    const hoverRule = profile.hoverText?.find(rule => rule.type === currentNode.type);
    const hoverText = hoverRule ? readNodeProp(currentNode, hoverRule.textProp) : undefined;
    if (typeof hoverText === "string" && hoverText !== "") {
      const content = result;
      result = (
        <Popover
          interactionKind="hover"
          placement="bottom"
          usePortal={popoverDepth === 0}
          lazy
          popoverClassName="stepper-popover"
          content={<ProfileHoverTextPopover text={hoverText} />}
        >
          {content}
        </Popover>
      );
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
export function CustomASTRenderer(
  props: SerializedStepperStep & { profile?: SyntaxProfile; nodeRenderers?: NodeRenderers },
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
      nodeRenderers: props.nodeRenderers,
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
    number | undefined;
  if (nodePrecedence === NEEDS_PARENTHESES) {
    return true;
  }
  const parentNodePrecedence = exprPrecedence[parentNode.type as keyof typeof exprPrecedence] as
    number | undefined;
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
