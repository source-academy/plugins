/**
 * The stepper's AST renderer (shared with the e-stepper): the built-in Source/JavaScript renderers
 * used when no syntax profile is given, the profile-driven renderer, function values, hover text,
 * redex markers, parenthesisation and host-specific node renderers.
 */
import { Popover } from "@blueprintjs/core";
import type { SerializedMarker, SyntaxProfile } from "@sourceacademy/common-stepper";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import { describe, expect, test } from "vitest";

import { CustomASTRenderer, type StepperNode } from "../render";

let ids = 0;
/** A node with a fresh nodeId. */
const n = (type: string, fields: Record<string, unknown> = {}): StepperNode => ({
  type,
  nodeId: `n${ids++}`,
  ...fields,
});
const lit = (raw: string) => n("Literal", { raw, value: raw });
const id = (name: string) => n("Identifier", { name });
const bin = (operator: string, left: StepperNode, right: StepperNode) =>
  n("BinaryExpression", { operator, left, right });

function render(
  ast: StepperNode,
  options: {
    profile?: SyntaxProfile;
    markers?: SerializedMarker[];
    nodeRenderers?: Parameters<typeof CustomASTRenderer>[0]["nodeRenderers"];
  } = {},
) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<CustomASTRenderer ast={ast} {...options} />);
  });
  return renderer;
}

/** The rendered text (popover contents excluded: they render only when opened). */
const text = (node: TestRenderer.ReactTestInstance | string): string =>
  typeof node === "string" ? node : node.children.map(text).join("");

describe("built-in (Source) renderers", () => {
  test("a whole program", () => {
    const fn = n("ArrowFunctionExpression", {
      params: [id("x")],
      body: bin("*", id("x"), id("x")),
    });
    const program = n("Program", {
      body: [
        n("VariableDeclaration", {
          kind: "const",
          declarations: [n("VariableDeclarator", { id: id("sq"), init: fn })],
        }),
        n("FunctionDeclaration", {
          id: id("f"),
          params: [id("a"), id("b")],
          body: n("BlockStatement", {
            body: [
              n("IfStatement", {
                test: n("LogicalExpression", { operator: "&&", left: id("a"), right: id("b") }),
                consequent: n("BlockStatement", {
                  body: [n("ReturnStatement", { argument: lit("1") })],
                }),
                alternate: n("BlockStatement", {
                  body: [n("ReturnStatement", { argument: null })],
                }),
              }),
            ],
          }),
        }),
        n("ExpressionStatement", {
          expression: n("CallExpression", {
            callee: fn,
            arguments: [n("UnaryExpression", { operator: "-", argument: lit("2") })],
          }),
        }),
        n("ExpressionStatement", {
          expression: n("ConditionalExpression", {
            test: id("c"),
            consequent: n("ArrayExpression", { elements: [lit("1"), lit("2"), null] }),
            alternate: n("Literal", { value: "s" }),
          }),
        }),
        n("DebuggerStatement"),
        n("ExpressionStatement", { expression: n("Literal", { value: null }) }),
        n("UnknownNode"),
      ],
    });
    const all = text(render(program).root);
    expect(all).toContain("const sq = x => x * x;");
    expect(all).toContain("function f(a, b)");
    expect(all).toContain("if (a && b)");
    expect(all).toContain("return 1;");
    expect(all).toContain(" else ");
    expect(all).toContain("(x => x * x)(-2);");
    expect(all).toContain('c ? [1, 2] : "s";');
    expect(all).toContain("debugger;");
    expect(all).toContain("null;");
    expect(all).toContain("<UnknownNode>");
  });

  test("a named function value is a mu-term with its definition in a popover", () => {
    const fn = n("ArrowFunctionExpression", {
      name: "fact",
      params: [id("n")],
      body: n("CallExpression", { callee: id("fact"), arguments: [id("n")] }),
    });
    const view = render(n("ExpressionStatement", { expression: fn }));
    expect(text(view.root)).toBe("fact;");
    expect(view.root.findAllByType(Popover).length).toBeGreaterThan(0);
  });

  test("parentheses follow precedence and associativity", () => {
    const sum = bin("+", lit("1"), lit("2"));
    expect(text(render(bin("*", sum, lit("3"))).root)).toBe("(1 + 2) * 3");
    expect(text(render(bin("-", lit("1"), bin("-", lit("2"), lit("3")))).root)).toBe("1 - (2 - 3)");
    expect(text(render(bin("**", bin("**", lit("2"), lit("3")), lit("4"))).root)).toBe(
      "(2 ** 3) ** 4",
    );
    expect(text(render(bin("**", lit("2"), bin("**", lit("3"), lit("4")))).root)).toBe(
      "2 ** 3 ** 4",
    );
    expect(
      text(
        render(
          n("LogicalExpression", {
            operator: "??",
            left: n("LogicalExpression", { operator: "||", left: id("a"), right: id("b") }),
            right: id("c"),
          }),
        ).root,
      ),
    ).toBe("(a || b) ?? c");
    expect(text(render(n("UnaryExpression", { operator: "-", argument: sum })).root)).toBe(
      "-(1 + 2)",
    );
  });

  test("redex markers wrap the marked node", () => {
    const left = lit("1");
    const ast = bin("+", left, lit("2"));
    const view = render(ast, { markers: [{ redexId: left.nodeId, redexType: "beforeMarker" }] });
    const marked = view.root.findAll(x => x.props.className === "beforeMarker");
    expect(marked).toHaveLength(1);
    expect(text(marked[0])).toBe("1");
  });
});

describe("profile-driven rendering", () => {
  const profile: SyntaxProfile = {
    templates: {
      Program: [{ lines: "body" }],
      Def: [
        { token: "def ", cls: "identifier" },
        { prop: "id.name", cls: "identifier" },
        "(",
        { list: "params", sep: ", " },
        "):",
        { block: "body" },
      ],
      Return: [{ token: "return ", cls: "operator" }, { child: "argument" }],
      Call: [{ child: "callee" }, "(", { list: "arguments", sep: ", ", prefix: "" }, ")"],
      If: [
        { token: "if ", cls: "identifier" },
        { child: "test" },
        ":",
        { block: "body" },
        { when: "orelse", parts: [{ token: "else:", cls: "identifier" }, { block: "orelse" }] },
        { unless: "orelse", parts: ["# no else"] },
      ],
      Bin: [
        { child: "left" },
        " ",
        { prop: "operator", cls: "operator" },
        " ",
        { child: "right", isRight: true },
      ],
      Id: [{ prop: "name" }],
      Num: [{ prop: "raw", cls: "literal" }],
      Builtin: [{ prop: "name" }],
      Img: [
        { image: "src", altProp: "label" },
        { unless: "src", parts: ["<", { prop: "label" }, ">"] },
      ],
    },
    operatorPrecedence: { "+": 11, "*": 12 },
    expressionPrecedence: { Id: 20, Num: 18, Call: 18, Bin: 14 },
    functionValues: [{ type: "Def", nameProp: "name" }],
    hoverText: [{ type: "Builtin", textProp: "hoverText" }],
  };
  const pid = (name: string) => n("Id", { name });
  const num = (raw: string) => n("Num", { raw });
  const pbin = (operator: string, left: StepperNode, right: StepperNode) =>
    n("Bin", { operator, left, right });

  test("templates: tokens, props, children, lists, blocks, lines, when/unless", () => {
    const program = n("Program", {
      body: [
        n("Def", {
          id: { name: "f" },
          params: [pid("x")],
          body: [n("Return", { argument: pbin("*", pbin("+", pid("x"), num("1")), num("2")) })],
        }),
        n("If", {
          test: pid("c"),
          body: [n("Call", { callee: pid("g"), arguments: [] })],
          orelse: [num("0")],
        }),
        n("If", { test: pid("d"), body: [num("1")], orelse: null }),
        n("Unmapped"),
      ],
    });
    const all = text(render(program, { profile }).root);
    expect(all).toContain("def f(x):");
    expect(all).toContain("return (x + 1) * 2");
    expect(all).toContain("if c:g()else:0");
    expect(all).toContain("if d:1# no else");
    expect(all).toContain("<Unmapped>");
  });

  test("a named function value collapses to its name with a popover", () => {
    const def = n("Def", { name: "f", id: { name: "f" }, params: [], body: [] });
    const view = render(n("Call", { callee: def, arguments: [] }), { profile });
    expect(text(view.root)).toBe("f()");
    expect(view.root.findAllByType(Popover).length).toBeGreaterThan(0);
  });

  test("hover text and inline images", () => {
    const builtin = n("Builtin", { name: "print", hoverText: "built-in function print" });
    const view = render(
      n("Call", {
        callee: builtin,
        arguments: [n("Img", { src: "data:image/png;base64,AAAA", label: "Rune" })],
      }),
      { profile },
    );
    expect(view.root.findAllByType(Popover).length).toBe(2);
    expect(view.root.findAllByType("img")).toHaveLength(1);
    // Only data: URLs are shown as images; anything else falls back to the label.
    const fallback = render(n("Img", { src: "https://example.com/x.png", label: "Rune" }), {
      profile,
    });
    expect(fallback.root.findAllByType("img")).toHaveLength(0);
    expect(text(render(n("Img", { label: "Rune" }), { profile }).root)).toBe("<Rune>");
  });

  test("host-specific node renderers take precedence and render children in context", () => {
    const view = render(n("Block", { body: pbin("+", pid("a"), num("1")) }), {
      profile,
      nodeRenderers: {
        Block: (node, renderChild) => (
          <span className="host-block">{renderChild(node.body as StepperNode)}</span>
        ),
      },
    });
    const block = view.root.find(x => x.props.className === "host-block");
    expect(text(block)).toBe("a + 1");
  });
});

describe("popover contents", () => {
  /** Renders the (lazily rendered) content of every popover in `view`, recursively. */
  function popoverTexts(view: TestRenderer.ReactTestRenderer, depth = 2): string[] {
    if (depth === 0) return [];
    return view.root.findAllByType(Popover).flatMap(p => {
      let inner!: TestRenderer.ReactTestRenderer;
      act(() => {
        inner = TestRenderer.create(p.props.content);
      });
      return [text(inner.root), ...popoverTexts(inner, depth - 1)];
    });
  }

  test("a Source function value shows its definition, recursively", () => {
    const fn = n("ArrowFunctionExpression", {
      name: "fact",
      params: [id("n")],
      body: n("CallExpression", { callee: id("fact"), arguments: [id("n")] }),
    });
    const texts = popoverTexts(render(n("ExpressionStatement", { expression: fn })));
    expect(texts[0]).toContain("Function definition");
    expect(texts[0]).toContain("n => fact(n)");
    // The recursive reference inside the definition is itself a mu-term with the same popover.
    expect(texts.filter(t => t.includes("n => fact(n)")).length).toBeGreaterThan(1);
  });

  test("an anonymous Source lambda refers to nothing by name, so it renders inline", () => {
    const fn = n("ArrowFunctionExpression", { params: [id("a"), id("b")], body: id("a") });
    expect(text(render(fn).root)).toBe("(a, b) => a");
  });

  test("a profile function value, hover text and an image show their popovers", () => {
    const profile: SyntaxProfile = {
      templates: {
        Def: ["def ", { prop: "id.name" }, "(): ", { child: "body" }],
        Call: [{ child: "callee" }, "(", { list: "arguments", sep: ", " }, ")"],
        Id: [{ prop: "name" }],
        Builtin: [{ prop: "name" }],
        Img: [{ image: "src", altProp: "label" }],
      },
      functionValues: [{ type: "Def", nameProp: "name" }],
      hoverText: [{ type: "Builtin", textProp: "hoverText" }],
    };
    const def = n("Def", {
      name: "f",
      id: { name: "f" },
      body: n("Call", { callee: n("Id", { name: "f" }), arguments: [] }),
    });
    const ast = n("Call", {
      callee: n("Builtin", { name: "print", hoverText: "built-in function print" }),
      arguments: [def, n("Img", { src: "data:image/png;base64,AAAA", label: "Rune" })],
    });
    const texts = popoverTexts(render(ast, { profile }));
    expect(texts).toEqual(
      expect.arrayContaining([
        " built-in function print",
        expect.stringContaining("def f(): f()"),
        " Rune",
      ]),
    );
  });
});
