import {
  Button,
  ButtonGroup,
  Card,
  Classes,
  Popover,
  Pre,
  Slider,
  Switch,
} from "@blueprintjs/core";
import type {
  CseDiagramAnchorResolver,
  CseSnapshot,
  ICseDiagramService,
} from "@sourceacademy/common-cse-machine";
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
import ProgramArrows, { ENV_ATTRIBUTE, REF_ATTRIBUTE } from "./ProgramArrows";
import { injectEStepperStyles } from "./styles";

/** Width (px) from which the program and the diagram are shown side by side. */
const WIDE_LAYOUT_MIN_WIDTH = 900;
const DEFAULT_PROGRAM_HEIGHT = 240;
const MIN_PANE_HEIGHT = 80;
/** In a stacked tab: the two 8px gaps around the divider, its 6px, and its two 2px margins. */
const STACKED_DIVIDER_SPACE = 2 * 8 + 6 + 2 * 2;
/**
 * In a wide tab, the program pane's share of the width left for the two panes, and the least width
 * of either pane. That width is the tab's less the two 8px gaps around the divider and the
 * divider's own 2px (6px wide, with -2px margins; see styles.ts).
 */
const DEFAULT_PROGRAM_SHARE = 0.45;
const MIN_PANE_WIDTH = 200;
const DIVIDER_SPACE = 2 * 8 + 2;

type Props = {
  steps: EStepperStep[];
  profile?: SyntaxProfile;
  error?: string | null;
  /** The host's CSE machine visualization, if it lends one (see `ICseDiagramService`). */
  cseDiagram?: ICseDiagramService;
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
      environment diagram below the program. Hover over a reference to find its object, and over a
      bracketed body to find its frame.
      <br />
      <br />
      Keyboard shortcuts (click on the explanation first): f / b for the next / previous step, a / e
      for the first / last step.
    </div>
  );
}

/**
 * The explanation and error cards take the height of their text. The host's side content styles
 * its own cards to fill it (the Source Academy frontend: `.workspace .side-content .bp6-card {
 * display: flex; height: 100% }`), and these are inside the side content too; now that the tab has
 * a height, that would make the explanation as tall as the tab. Inline, so it outranks any
 * stylesheet.
 */
const CARD_STYLE: React.CSSProperties = { height: "auto", flex: "0 0 auto" };

/** The least height of the tab, and the gap it leaves below itself in the browser window. */
const MIN_TAB_HEIGHT = 400;
const BOTTOM_GAP = 16;

/**
 * What lies between the bottom of `element` and the bottom of the browser window, however the host
 * lays it out: the bottom margin, padding and border of the element and of every container around
 * it. A tab that ends short of that by less than this overflows its container, which then shows a
 * scroll bar (and so does the container around that: the host's panels nest). Without styles to
 * ask (no DOM), the fixed gap.
 */
function bottomInset(element: HTMLElement): number {
  if (typeof getComputedStyle !== "function") return BOTTOM_GAP;
  let inset = 0;
  for (let e: HTMLElement | null = element; e && e !== document.body; e = e.parentElement) {
    const style = getComputedStyle(e);
    inset +=
      (parseFloat(style.marginBottom) || 0) +
      (parseFloat(style.paddingBottom) || 0) +
      (parseFloat(style.borderBottomWidth) || 0);
  }
  return Math.max(BOTTOM_GAP, Math.ceil(inset));
}

/**
 * The height that takes `element` from where it starts down to the bottom of the browser window
 * (as the CSE Machine tab does): the side-content area the tab is in does not give it a height of
 * its own to fill. Worked out again when the window is resized, when the element comes into view
 * (a tab that is not selected is not laid out), and at every render (cheap; it changes only when
 * the result does).
 */
function useFillHeight(element: HTMLElement | null): number | undefined {
  const [height, setHeight] = useState<number | undefined>(undefined);
  const fit = useCallback(() => {
    if (!element || typeof window === "undefined") return;
    const top = element.getBoundingClientRect().top;
    if (!Number.isFinite(top)) return;
    setHeight(
      Math.max(MIN_TAB_HEIGHT, Math.floor(window.innerHeight - top - bottomInset(element))),
    );
  }, [element]);
  useEffect(() => {
    if (!element || typeof window === "undefined") return;
    fit();
    window.addEventListener("resize", fit);
    const observer =
      typeof IntersectionObserver === "undefined" ? undefined : new IntersectionObserver(fit);
    observer?.observe(element);
    return () => {
      window.removeEventListener("resize", fit);
      observer?.disconnect();
    };
  }, [element, fit]);
  useEffect(fit);
  return height;
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
 * in a wide one. A heap object or frame under the mouse is highlighted in both panes.
 */
export default function EStepperView({ steps, profile, error, cseDiagram }: Props) {
  const [stepValue, setStepValue] = useState(1);
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoveredFrame, setHoveredFrame] = useState<string | null>(null);
  const [programHeight, setProgramHeight] = useState(DEFAULT_PROGRAM_HEIGHT);
  const [programShare, setProgramShare] = useState(DEFAULT_PROGRAM_SHARE);
  const [outputOpen, setOutputOpen] = useState(true);
  // Display options. Program references (arrows from the program into the diagram) are off until the user asks.
  const [showArrows, setShowArrows] = useState(false);
  // "Clear dead frames" lasts until the step changes, as in the CSE machine.
  const [clearDead, setClearDead] = useState(false);
  const [anchors, setAnchors] = useState<{ resolve: CseDiagramAnchorResolver | null }>({
    resolve: null,
  });
  const onAnchors = useCallback(
    (resolve: CseDiagramAnchorResolver | null) => setAnchors({ resolve }),
    [],
  );
  const [containerRef, containerSize] = useSize();
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const fillHeight = useFillHeight(root);
  const rootRef = useCallback(
    (element: HTMLElement | null) => {
      containerRef(element);
      setRoot(element);
    },
    [containerRef],
  );
  const [diagramRef, diagramSize] = useSize();
  const [mainRef, mainSize] = useSize();

  useEffect(() => {
    injectStepperStyles();
    injectEStepperStyles();
  }, []);
  useEffect(() => setStepValue(1), [steps]);
  useEffect(() => setClearDead(false), [steps, stepValue]);

  const lastStep = steps.length;
  const hasRun = lastStep > 0;
  const stepIndex = hasRun ? Math.min(stepValue, lastStep) - 1 : 0;
  const step = hasRun ? steps[stepIndex] : undefined;
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
  const frameColors = useMemo(
    () => Object.fromEntries((step?.frames ?? []).map((f, i) => [f.id, frameColor(i)])),
    [step],
  );
  const colorOf = (frameId: string) => frameColors[frameId] ?? frameColor(1);
  const objectOf = useMemo(() => {
    const objects = new Map<string, EStepperHeapObject>((step?.heap ?? []).map(o => [o.id, o]));
    return (id: string) => objects.get(id);
  }, [step]);

  const nodeRenderers: NodeRenderers = {
    EnvBlock: (node: StepperNode, renderChild) => {
      const envId = String(node.envId);
      const color = colorOf(envId);
      const body = node.body as StepperNode | StepperNode[];
      return (
        // The whole block is hoverable; in nested blocks, the innermost one under the mouse wins
        // (`mouseover` bubbles from it, and stops there).
        <span
          className={classNames("estepper-envblock", { hovered: hoveredFrame === envId })}
          style={{ borderColor: color, ["--estepper-frame-color" as string]: color }}
          onMouseOver={event => {
            event.stopPropagation();
            setHoveredFrame(envId);
          }}
          onMouseLeave={() => setHoveredFrame(null)}
        >
          <span
            className="estepper-envblock-label"
            style={{ background: color }}
            {...{ [ENV_ATTRIBUTE]: envId }}
          >
            {envId}
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
          {...{ [REF_ATTRIBUTE]: id }}
          onMouseEnter={() => setHovered(id)}
          onMouseLeave={() => setHovered(null)}
        >
          {name ? <span className="estepper-ref-name">{name}</span> : null}
          <span className="estepper-ref-badge">{id}</span>
        </span>
      );
    },
  };

  // In a stacked tab the program pane keeps room for the divider and for the least of the diagram
  // below it, at the tab's current height, however far the divider was dragged: the divider is
  // always in view, to be dragged back.
  const maxProgramHeight =
    mainSize.height > 0
      ? Math.max(MIN_PANE_HEIGHT, mainSize.height - STACKED_DIVIDER_SPACE - MIN_PANE_HEIGHT)
      : Infinity;
  const stackedProgramHeight = Math.min(programHeight, maxProgramHeight);
  const startResize = useCallback(
    (event: React.PointerEvent) => {
      const startY = event.clientY;
      const startHeight = stackedProgramHeight;
      const onMove = (e: PointerEvent) =>
        setProgramHeight(
          Math.min(maxProgramHeight, Math.max(MIN_PANE_HEIGHT, startHeight + e.clientY - startY)),
        );
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [stackedProgramHeight, maxProgramHeight],
  );

  // In a wide tab, the divider between the panes sets the program pane's share of the width left
  // for the panes (a share, not pixels, so the split keeps its proportions when the tab is
  // resized). The pane's width is worked out at every render, so either pane keeps its least
  // width at the tab's current size, however the share was set.
  const paneSpace = Math.max(0, containerSize.width - DIVIDER_SPACE);
  const programWidthFor = (share: number) =>
    Math.round(Math.min(paneSpace - MIN_PANE_WIDTH, Math.max(MIN_PANE_WIDTH, share * paneSpace)));
  const programWidth = programWidthFor(programShare);
  const startWidthResize = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      if (paneSpace <= 2 * MIN_PANE_WIDTH) return;
      const startX = event.clientX;
      const startWidth = programWidth;
      const onMove = (e: PointerEvent) => {
        const width = Math.min(
          paneSpace - MIN_PANE_WIDTH,
          Math.max(MIN_PANE_WIDTH, startWidth + e.clientX - startX),
        );
        setProgramShare(width / paneSpace);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [paneSpace, programWidth],
  );

  // The host draws the environments when it can, from the steps' CSE snapshots (all steps, so it
  // can show frames from earlier steps as dead frames); otherwise the plugin's own diagram does.
  // The snapshots' values carry the e-stepper's object ids (`#3`) as their `objectId`, so the
  // host's diagram and the program pane share the hovered object.
  const cseSnapshots = useMemo<CseSnapshot[] | null>(
    () =>
      cseDiagram && steps.length > 0 && steps.every(s => s.cse !== undefined)
        ? steps.map(s => s.cse!)
        : null,
    [cseDiagram, steps],
  );

  const usingHostDiagram = cseDiagram !== undefined && cseSnapshots !== null;
  const explanation = step?.markers?.[0]?.explanation ?? "...";
  const output = step?.output ?? "";

  return (
    <div
      ref={rootRef}
      style={fillHeight === undefined ? undefined : { height: fillHeight }}
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
        {usingHostDiagram ? null : (
          // The host's diagram has its own toolbar for these (its arrow filters, "Clear Dead
          // Frames"); these are for the plugin's own diagram.
          <>
            <Popover
              placement="bottom-end"
              content={
                <div className="estepper-options">
                  <Switch
                    label="From program"
                    checked={showArrows}
                    onChange={e => setShowArrows(e.currentTarget.checked)}
                  />
                </div>
              }
            >
              <Button icon="settings" style={{ marginLeft: 8 }} aria-label="Display options" />
            </Popover>
            <Button
              icon="eraser"
              style={{ marginLeft: 8 }}
              text="Clear dead frames"
              disabled={
                !hasRun ||
                clearDead ||
                !(step?.frames.some(f => f.isGarbage) || step?.heap.some(o => o.isGarbage))
              }
              onClick={() => setClearDead(true)}
            />
          </>
        )}
      </div>
      {error ? (
        <Card style={{ ...CARD_STYLE, marginTop: 8 }}>
          <Pre className="result-output">{error}</Pre>
        </Card>
      ) : null}
      {!hasRun ? (
        error ? null : (
          <DefaultText />
        )
      ) : (
        <>
          <Card style={{ ...CARD_STYLE, margin: "8px 0" }}>
            <Pre className="result-output">{explanation}</Pre>
          </Card>
          <div ref={mainRef} className={classNames("estepper-main", { narrow: !wide })}>
            <div
              className="estepper-left"
              style={
                wide ? { flex: `0 0 ${programWidth}px` } : { flex: `0 0 ${stackedProgramHeight}px` }
              }
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
            {wide ? (
              <div className="estepper-divider vertical" onPointerDown={startWidthResize} />
            ) : (
              <div className="estepper-divider" onPointerDown={startResize} />
            )}
            <div className="estepper-diagram" ref={diagramRef}>
              {cseDiagram && cseSnapshots ? (
                (cseDiagram.createView({
                  snapshots: cseSnapshots,
                  step: stepIndex,
                  hovered,
                  onHover: setHovered,
                  frameColors,
                  hoveredFrame,
                  onHoverFrame: setHoveredFrame,
                  onAnchors,
                }) as React.ReactNode)
              ) : diagramSize.width > 0 && diagramSize.height > 0 ? (
                <EnvDiagram
                  frames={step!.frames}
                  heap={step!.heap}
                  activeFrameId={step!.activeFrameId}
                  lookups={step!.lookups ?? []}
                  hovered={hovered}
                  onHover={setHovered}
                  hoveredFrame={hoveredFrame}
                  onHoverFrame={setHoveredFrame}
                  width={diagramSize.width}
                  height={diagramSize.height}
                  clearDead={clearDead}
                  onAnchors={onAnchors}
                />
              ) : null}
            </div>
            {(usingHostDiagram ? anchors.resolve !== null : showArrows) ? (
              <ProgramArrows
                resolve={anchors.resolve}
                hovered={hovered}
                hoveredFrame={hoveredFrame}
                colorOfFrame={colorOf}
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
