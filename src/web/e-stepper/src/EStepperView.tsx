import { Button, ButtonGroup, Card, Classes, Pre, Slider } from "@blueprintjs/core";
import type {
  EStepperHeapObject,
  EStepperStep,
  SyntaxProfile,
} from "@sourceacademy/common-e-stepper";
import classNames from "classnames";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CustomASTRenderer, type NodeRenderers, type StepperNode } from "../../stepper/src/render";
import { injectStepperStyles } from "../../stepper/src/styles";
import { frameColor } from "./colors";
import EnvDiagram from "./EnvDiagram";
import { injectEStepperStyles } from "./styles";

/** Width (px) from which the program and the diagram are shown side by side. */
const WIDE_LAYOUT_MIN_WIDTH = 900;
const DEFAULT_PROGRAM_HEIGHT = 240;
const MIN_PANE_HEIGHT = 80;

type Props = {
  steps: EStepperStep[];
  profile?: SyntaxProfile;
  error?: string | null;
};

function DefaultText() {
  return (
    <div className={Classes.RUNNING_TEXT}>
      Welcome to the environment stepper!
      <br />
      <br />
      Run your program, then drag the slider to see it evaluate step by step. As in the stepper, the
      program is rewritten one step at a time. In addition, a function body being evaluated is
      marked with the frame it is evaluated in (a coloured bracket labelled E1, E2, ...), and lists
      and function objects are shown as references (#1, #2, ...) to the objects drawn in the
      environment diagram below the program. Hover over a reference to find its object.
      <br />
      <br />
      Keyboard shortcuts (click on the explanation first): f / b for the next / previous step, a / e
      for the first / last step.
    </div>
  );
}

/** Tracks an element's size; attach the returned callback as the element's `ref`. */
function useSize(): [(element: HTMLElement | null) => void, { width: number; height: number }] {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!element) return;
    // Measure right away, so the first render does not wait for the observer's first callback
    // (which a browser may delay, e.g. in a background tab).
    const initial = element.getBoundingClientRect();
    setSize({ width: Math.floor(initial.width), height: Math.floor(initial.height) });
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0].contentRect;
      setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, size];
}

/**
 * The e-stepper tab: the step slider and explanation on top, then the program (with the output
 * strip under it) and the environment diagram — one above the other in a narrow tab, side by side
 * in a wide one. A heap object under the mouse is highlighted in both panes.
 */
export default function EStepperView({ steps, profile, error }: Props) {
  const [stepValue, setStepValue] = useState(1);
  const [hovered, setHovered] = useState<string | null>(null);
  const [programHeight, setProgramHeight] = useState(DEFAULT_PROGRAM_HEIGHT);
  const [outputOpen, setOutputOpen] = useState(true);
  const [containerRef, containerSize] = useSize();
  const [diagramRef, diagramSize] = useSize();

  useEffect(() => {
    injectStepperStyles();
    injectEStepperStyles();
  }, []);
  useEffect(() => setStepValue(1), [steps]);

  const lastStep = steps.length;
  const hasRun = lastStep > 0;
  const step = hasRun ? steps[Math.min(stepValue, lastStep) - 1] : undefined;
  const wide = containerSize.width >= WIDE_LAYOUT_MIN_WIDTH;

  const stepFirst = () => setStepValue(1);
  const stepLast = () => setStepValue(Math.max(1, lastStep));
  const stepPrevious = () => setStepValue(v => Math.max(1, v - 1));
  const stepNext = () => setStepValue(v => Math.min(lastStep, v + 1));
  const hotkeys: Record<string, () => void> = {
    a: stepFirst,
    f: stepNext,
    b: stepPrevious,
    e: stepLast,
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    const action = hasRun ? hotkeys[event.key] : undefined;
    if (action && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      action();
    }
  };

  // Frame colours by id, for the program's environment brackets (the diagram uses the same order).
  const colorOf = useMemo(() => {
    const colors = new Map((step?.frames ?? []).map((f, i) => [f.id, frameColor(i)]));
    return (frameId: string) => colors.get(frameId) ?? frameColor(1);
  }, [step]);
  const objectOf = useMemo(() => {
    const objects = new Map<string, EStepperHeapObject>((step?.heap ?? []).map(o => [o.id, o]));
    return (id: string) => objects.get(id);
  }, [step]);

  const nodeRenderers: NodeRenderers = {
    EnvBlock: (node: StepperNode, renderChild) => {
      const color = colorOf(String(node.envId));
      const body = node.body as StepperNode | StepperNode[];
      return (
        <span className="estepper-envblock" style={{ borderColor: color }}>
          <span className="estepper-envblock-label" style={{ background: color }}>
            {String(node.envId)}
          </span>
          {Array.isArray(body)
            ? body.map((statement, i) => <div key={i}>{renderChild(statement)}</div>)
            : renderChild(body)}
        </span>
      );
    },
    Ref: (node: StepperNode) => {
      const id = String(node.objectId);
      const object = objectOf(id);
      const name = object?.kind === "function" ? object.name : undefined;
      return (
        <span
          className={classNames("estepper-ref", { hovered: hovered === id })}
          onMouseEnter={() => setHovered(id)}
          onMouseLeave={() => setHovered(null)}
        >
          {name ? <span className="estepper-ref-name">{name}</span> : null}
          <span className="estepper-ref-badge">{id}</span>
        </span>
      );
    },
  };

  const startResize = useCallback(
    (event: React.PointerEvent) => {
      const startY = event.clientY;
      const startHeight = programHeight;
      const onMove = (e: PointerEvent) =>
        setProgramHeight(Math.max(MIN_PANE_HEIGHT, startHeight + e.clientY - startY));
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [programHeight],
  );

  const explanation = step?.markers?.[0]?.explanation ?? "...";
  const output = step?.output ?? "";

  return (
    <div
      ref={containerRef}
      className={classNames("sa-substituter", "sa-e-stepper", Classes.DARK)}
      onKeyDown={onKeyDown}
      tabIndex={-1}
    >
      <Slider
        disabled={!hasRun}
        min={1}
        max={Math.max(1, lastStep)}
        labelStepSize={Math.max(1, Math.ceil(lastStep / 10))}
        onChange={setStepValue}
        value={Math.min(stepValue, Math.max(1, lastStep))}
      />
      <div style={{ display: "flex", justifyContent: "center" }}>
        <ButtonGroup>
          <Button disabled={!hasRun} icon="double-chevron-left" onClick={stepFirst} />
          <Button disabled={!hasRun} icon="chevron-left" onClick={stepPrevious} />
          <Button disabled={!hasRun} icon="chevron-right" onClick={stepNext} />
          <Button disabled={!hasRun} icon="double-chevron-right" onClick={stepLast} />
        </ButtonGroup>
      </div>
      {error ? (
        <Card style={{ marginTop: 8 }}>
          <Pre className="result-output">{error}</Pre>
        </Card>
      ) : null}
      {!hasRun ? (
        error ? null : (
          <DefaultText />
        )
      ) : (
        <>
          <Card style={{ margin: "8px 0" }}>
            <Pre className="result-output">{explanation}</Pre>
          </Card>
          <div className={classNames("estepper-main", { narrow: !wide })}>
            <div
              className="estepper-left"
              style={wide ? { flex: "0 0 45%" } : { flex: `0 0 ${programHeight}px` }}
            >
              <div className="estepper-program" style={{ flex: 1 }}>
                <CustomASTRenderer {...step!} profile={profile} nodeRenderers={nodeRenderers} />
              </div>
              {output ? (
                <div style={{ marginTop: 4 }}>
                  <div className="estepper-output-toggle" onClick={() => setOutputOpen(o => !o)}>
                    {outputOpen ? "▾" : "▸"} Output
                  </div>
                  {outputOpen ? <pre className="estepper-output">{output}</pre> : null}
                </div>
              ) : null}
            </div>
            {wide ? null : <div className="estepper-divider" onPointerDown={startResize} />}
            <div className="estepper-diagram" ref={diagramRef}>
              {diagramSize.width > 0 && diagramSize.height > 0 ? (
                <EnvDiagram
                  frames={step!.frames}
                  heap={step!.heap}
                  activeFrameId={step!.activeFrameId}
                  lookups={step!.lookups ?? []}
                  hovered={hovered}
                  onHover={setHovered}
                  width={diagramSize.width}
                  height={diagramSize.height}
                />
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
