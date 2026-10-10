import { Button, ButtonGroup, Card, Classes, Divider, Pre, Slider } from "@blueprintjs/core";
import { getHotkeyHandler, type HotkeyItem } from "@mantine/hooks";
import type { SerializedStepperStep, SyntaxProfile } from "@sourceacademy/common-stepper";
import classNames from "classnames";
import { useCallback, useEffect, useState } from "react";

import { CustomASTRenderer } from "./render";
import { sliderLabels } from "./sliderLabels";
import { injectStepperStyles } from "./styles";

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
        On odd-numbered steps, the part of the program that will be evaluated next is highlighted in
        yellow. On even-numbered steps, the result of the evaluation is highlighted in green (step 0
        is the start). You can change the maximum steps limit (500-5000, default 1000) in the
        control bar.
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

/** The program-output panel: same card/formatting as the explanation box above, but its text is the
 * orange used for printed output in the main workspace's REPL (`.log-output`, #dd8c60). Shows the run's
 * cumulative output up to the current step (see {@link SerializedStepperStep.output}).
 *
 * The colour is set inline, not via the injected `.stepper-output` rule, on purpose: when the Host runs
 * inside the main frontend, that app's own (legacy substituter) stylesheet carries an id-scoped
 * `#…workspace … .sa-substituter pre` colour rule whose specificity outranks the injected
 * class selector, so a stylesheet colour would be silently overridden to the default (white). An inline
 * style beats any external selector, guaranteeing the orange regardless of the embedding app's CSS. The
 * `stepper-output` class still supplies the (non-colour) formatting that matches the explanation box. */
function SubstOutputDisplay(props: { content: string }) {
  if (!props.content) {
    return null;
  }
  return (
    <Card>
      <Pre className="stepper-output" style={{ color: "#dd8c60" }}>
        {props.content}
      </Pre>
    </Card>
  );
}

type StepperViewProps = {
  content: SerializedStepperStep[];
  /** The active language's rendering rules; when absent, the default (Source) syntax is used. */
  profile?: SyntaxProfile;
};

/**
 * Tracks an element's width; attach the returned callback as the element's `ref`. Blueprint's
 * slider measures its track only when it mounts, and converts a click to a step with that width, so
 * the slider is keyed by this width to measure again after a resize.
 */
function useWidth(): [(element: HTMLElement | null) => void, number] {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!element) return;
    setWidth(Math.floor(element.getBoundingClientRect().width));
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries =>
      setWidth(Math.floor(entries[0].contentRect.width)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, width];
}

/**
 * The presentational stepper: a slider + breakpoint controls over a list of serialized steps, with
 * a custom AST renderer and an explanation panel. A faithful port of the frontend's legacy
 * `SideContentSubstVisualizer`, minus its redux/i18n/js-slang couplings.
 */
export default function StepperView(props: StepperViewProps) {
  const [stepValue, setStepValue] = useState(1);
  const [rootRef, width] = useWidth();
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

  const getOutput = useCallback(
    (value: number): string => {
      const contIndex = value <= lastStepValue ? value - 1 : 0;
      return props.content[contIndex]?.output ?? "";
    },
    [lastStepValue, props.content],
  );

  return (
    <div
      ref={rootRef}
      className={classNames("sa-substituter", Classes.DARK)}
      onKeyDown={hotkeyHandler}
      tabIndex={-1} // tab index necessary to fire keydown events on div element
    >
      {/* The slider counts the steps taken: 0 is the start, the last is the total number. A run of
          one step has nothing to slide between: a valid range, disabled. */}
      <Slider
        key={width}
        disabled={lastStepValue < 2}
        min={0}
        max={Math.max(1, lastStepValue - 1)}
        labelValues={sliderLabels(Math.max(1, lastStepValue - 1))}
        onChange={value => setStepValue(value + 1)}
        value={(stepValue <= lastStepValue ? stepValue : 1) - 1}
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
      {/* Output panel, directly below the explanation box; always shown once code has run (empty until
          the program prints). Shows cumulative output up to the current step. */}
      {hasRunCode ? <SubstOutputDisplay content={getOutput(stepValue)} /> : null}
    </div>
  );
}
