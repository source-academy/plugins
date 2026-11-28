import {
  AnchorButton,
  Button,
  ButtonGroup,
  Callout,
  Checkbox,
  Classes,
  Divider,
  Popover,
  Position,
  Slider,
  Tooltip,
} from "@blueprintjs/core";
import type { CseSnapshot, CseTraceEnd } from "@sourceacademy/common-cse-machine";
import type { IEditorService } from "@sourceacademy/common-tabs";
import {
  ClearDeadFramesAnimation,
  CseAnimation,
  CseArrowFilterMenu,
  CseMachine,
  Layout,
  computeFramesCoordChange,
  continuesRun,
  clearHostStyleSource,
  fullscreenPortalContainer,
  observeHostStyle,
  setHostStyleSource,
  snapshotWithAllFrames,
  snapshotWithDeadFrames,
} from "@sourceacademy/web-environment-diagram";
import classNames from "classnames";
import { Component, createRef, type KeyboardEvent, type ReactNode } from "react";

import { sliderLabels } from "../../stepper/src/sliderLabels";
import { injectStepperStyles } from "../../stepper/src/styles";

export interface CseMachineViewProps {
  /** The snapshots of the run that is being shown, or none if there is no run. */
  snapshots: CseSnapshot[] | null;
  /** 0-based steps where a breakpoint sits on top of the control. */
  breakpointSteps: number[];
  /** How the run ended, if the evaluator said. */
  end: CseTraceEnd | null;
  /** The host's editor, if it offers one: the line of the step is marked in it. */
  editor?: IEditorService;
}

interface State {
  visualization: ReactNode | null;
  /** The step shown (−1 before the first render). */
  value: number;
  width: number;
  height: number;
  clearDeadFrames: boolean;
  arrowFilterOpen: boolean;
  /** Changed to make the slider measure its track again (Blueprint measures at mount). */
  sliderKey: number;
}

/** Whether there is a run to show: snapshots, and at least one. */
const hasRun = (snapshots: CseSnapshot[] | null): snapshots is CseSnapshot[] =>
  snapshots !== null && snapshots.length > 0;

/** The padding around the diagram that the old tab left for the host's own chrome. */
const PADDING = 50;

/**
 * The CSE machine tab: a step slider, the view toggles, step navigation and the diagram of the
 * snapshot at the step, with the control and the stash. Ported from the frontend's
 * `SideContentCseMachine`, with everything that came from the host replaced: the snapshots arrive
 * as props (the plugin keeps them), the size is that of the element itself, the keys are handled
 * here, and the one thing it asks of the editor is `editor.highlight`.
 */
export default class CseMachineView extends Component<CseMachineViewProps, State> {
  private readonly container = createRef<HTMLDivElement>();
  private resizeObserver?: ResizeObserver;
  private stopObservingHostStyle?: () => void;

  constructor(props: CseMachineViewProps) {
    super(props);
    this.state = {
      visualization: null,
      value: -1,
      width: 600,
      height: 600,
      clearDeadFrames: false,
      arrowFilterOpen: false,
      sliderKey: 0,
    };
    CseMachine.init(
      visualization => {
        this.setState({ visualization }, () => CseAnimation.playAnimation());
      },
      this.state.width,
      this.state.height,
      // The "control" highlight (the lines of a hovered control item) has never been visible in the
      // editor, and the host contract has one highlight: the line of the step.
      () => {},
    );
  }

  private get stepsTotal(): number {
    return Math.max(0, (this.props.snapshots?.length ?? 0) - 1);
  }

  componentDidMount() {
    // The slider's look (the margin, and only the first and last labels) is that of the Stepper's, whose
    // stylesheet defines it; the host's own CSS has it only for the tabs it knows by id.
    injectStepperStyles();
    const element = this.container.current;
    if (element && typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.measureSoon());
      this.resizeObserver.observe(element);
    }
    document.addEventListener("fullscreenchange", this.handleFullscreenChange);
    if (element) {
      // The background of the diagram is the host's, if its style sets one (see hostStyle.ts in the
      // environment-diagram library): a canvas is not coloured by CSS, so it is read from the style of
      // this element, and the diagram is drawn again when the host changes it (a mode, a theme).
      setHostStyleSource(element);
      this.stopObservingHostStyle = observeHostStyle(element, () => {
        CseMachine.clearCachedLayouts();
        requestAnimationFrame(() => CseMachine.redraw());
      });
    }
    this.measure();
    if (hasRun(this.props.snapshots)) {
      this.renderSnapshotAt(0);
      this.setState({ value: 0 });
    }
  }

  componentWillUnmount() {
    this.resizeObserver?.disconnect();
    this.stopObservingHostStyle?.();
    if (this.container.current) clearHostStyleSource(this.container.current);
    clearTimeout(this.measureTimer);
    document.removeEventListener("fullscreenchange", this.handleFullscreenChange);
    CseMachine.resetArrowOriginFilters();
    this.clearView();
  }

  /**
   * The tab owns what it puts in the host: the drawing and the editor highlight. It is called when
   * the tab goes away and when its snapshots do.
   */
  private clearView() {
    CseMachine.clearCse();
    this.props.editor?.highlight([]);
  }

  componentDidUpdate(prev: CseMachineViewProps) {
    const { snapshots } = this.props;
    if (prev.snapshots === snapshots) return;

    // The snapshots went away, or are none (a run that produced none): clear the view rather than
    // leave the previous run's diagram and step controls active.
    if (!hasRun(snapshots)) {
      this.setState({ visualization: null, value: -1 });
      this.clearView();
      return;
    }

    // The run that is going on has more snapshots: keep the user's place (and the slider as it is).
    // The frames are laid out with all of the run's frames, so the layouts of the steps may change
    // with a frame that is new: they are laid out again, and the step being shown is drawn again.
    if (continuesRun(prev.snapshots, snapshots)) {
      CseMachine.clearCachedLayouts();
      if (this.state.value >= 0) this.renderSnapshotAt(this.state.value);
      return;
    }

    // A new run's snapshots arrived: start over from the first step.
    CseMachine.clearCachedLayouts();
    CseMachine.setClearDeadFrames(false);
    this.setState({ arrowFilterOpen: false });
    this.stepTo(0);
    // Blueprint's Slider caches its track width at mount, so make it measure again once visible.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.setState(prev => ({ sliderKey: prev.sliderKey + 1 })));
    });
  }

  private measureTimer?: ReturnType<typeof setTimeout>;
  /** Measures after the size has stopped changing, as the old tab did (300 ms). */
  private measureSoon = () => {
    clearTimeout(this.measureTimer);
    this.measureTimer = setTimeout(this.measure, 300);
  };

  private measure = () => {
    const element = this.container.current;
    if (!element) return;
    const width = Math.max(100, element.clientWidth - PADDING);
    const height = Math.max(100, element.clientHeight - PADDING);
    if (width === this.state.width && height === this.state.height) return;
    this.setState({ width, height });
    CseMachine.updateDimensions(width, height);
  };

  private handleFullscreenChange = () => {
    // Twice, so that the browser has finished laying out the fullscreen element before the slider
    // measures its track again.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.setState(prev => ({ sliderKey: prev.sliderKey + 1 })));
    });
  };

  /** Renders the snapshot at the given step index, and marks its line in the editor. */
  private renderSnapshotAt(step: number) {
    const { snapshots, editor } = this.props;
    const snapshot = snapshots?.[step];
    if (!snapshots || !snapshot) return;

    CseMachine.clearLiveLayouts();
    // Laid out with all the run's frames, the frames keep their places from step to step.
    CseMachine.renderSnapshot(
      snapshotWithDeadFrames(snapshots, step),
      snapshotWithAllFrames(snapshots),
    );

    // `currentLine` is 1-based, as the host contract's lines are.
    editor?.highlight(
      snapshot.currentLine !== undefined && snapshot.currentLine > 0
        ? [[snapshot.currentLine, snapshot.currentLine]]
        : [],
    );
  }

  /** The steps at which the environments differ from the step before. */
  private getChangepointSteps(): number[] {
    const steps: number[] = [];
    let previous: string | null = null;
    (this.props.snapshots ?? []).forEach((snapshot, i) => {
      const fingerprint = JSON.stringify(snapshot?.environments ?? []);
      if (previous === null || fingerprint !== previous) steps.push(i);
      previous = fingerprint;
    });
    return steps;
  }

  private sliderShift = (value: number) => {
    if (this.state.clearDeadFrames) {
      CseMachine.setClearDeadFrames(false);
      CseMachine.clearLiveLayouts();
    }
    this.setState({ value, clearDeadFrames: false });
  };

  private sliderRelease = (value: number) => this.renderSnapshotAt(value);

  private stepTo = (value: number) => {
    this.sliderShift(value);
    this.sliderRelease(value);
  };

  private stepFirst = () => this.stepTo(0);
  private stepLast = () => this.stepTo(this.stepsTotal);
  private stepPrevious = () => {
    if (this.state.value > 0) this.stepTo(this.state.value - 1);
  };
  private stepNext = () => {
    if (this.state.value < this.stepsTotal) {
      this.stepTo(this.state.value + 1);
      CseAnimation.enableAnimations();
    }
  };

  /** The next step after the current one in `steps` (ascending), else the last step. */
  private stepForwardIn = (steps: number[]) => {
    this.stepTo(steps.find(step => step > this.state.value) ?? this.stepsTotal);
  };
  /** The nearest step before the current one in `steps` (ascending), else the first step. */
  private stepBackIn = (steps: number[]) => {
    this.stepTo([...steps].reverse().find(step => step < this.state.value) ?? 0);
  };

  private stepNextBreakpoint = () => this.stepForwardIn(this.props.breakpointSteps);
  private stepPrevBreakpoint = () => this.stepBackIn(this.props.breakpointSteps);
  private stepNextChangepoint = () => this.stepForwardIn(this.getChangepointSteps());
  private stepPrevChangepoint = () => this.stepBackIn(this.getChangepointSteps());

  private refreshArrowFilters = () => {
    CseMachine.clearRenderedLayouts();
    this.renderSnapshotAt(this.state.value);
    this.forceUpdate();
  };

  private clearUnreachable = () => {
    if (!this.state.visualization) return;
    const prevLevels = Layout.levels;
    this.setState({ clearDeadFrames: true }, () => {
      CseMachine.setClearDeadFrames(true);
      CseMachine.clearLiveLayouts();
      // Animations make Konva objects not be drawn, so the draw of this one redraw is replaced.
      const originalDraw = Layout.draw;
      Layout.draw = () => {
        try {
          const changedFramePairs = computeFramesCoordChange(prevLevels, Layout.levels);
          if (changedFramePairs.length > 0) {
            CseAnimation.animations.push(new ClearDeadFramesAnimation(changedFramePairs));
            CseAnimation.enableAnimations();
          }
          return originalDraw.apply(Layout);
        } finally {
          Layout.draw = originalDraw;
        }
      };
      CseMachine.redraw();
    });
  };

  /** The keys of the tab, active while the focus is on it: a, e, f, b. */
  private handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!this.state.visualization || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    switch (event.key) {
      case "a":
        return this.stepFirst();
      case "e":
        return this.stepLast();
      case "f":
        return this.stepNext();
      case "b":
        return this.stepPrevious();
    }
  };

  private toggle(action: () => void) {
    return () => {
      if (!this.state.visualization) return;
      action();
      CseMachine.redraw();
      this.forceUpdate();
    };
  }

  render() {
    const { visualization, value, sliderKey, clearDeadFrames, arrowFilterOpen } = this.state;
    const { end } = this.props;
    const disabled = !visualization;
    const currentStep = Math.max(0, value);
    const atFirst = currentStep < 1;
    const atLast = currentStep >= this.stepsTotal;
    const controlStash = CseMachine.getControlStash();

    const toggleButton = (
      tooltip: string,
      icon: "layers" | "minimize" | "eye-open" | "print",
      checked: boolean,
      action: () => void,
    ) => (
      <Tooltip content={tooltip} compact>
        <AnchorButton onMouseUp={this.toggle(action)} icon={icon} disabled={disabled}>
          <Checkbox checked={checked} disabled={disabled} style={{ margin: 0 }} readOnly />
        </AnchorButton>
      </Tooltip>
    );

    return (
      <div
        ref={this.container}
        tabIndex={0}
        onKeyDown={this.handleKeyDown}
        style={{
          position: "relative",
          height: "100%",
          maxHeight: "100%",
          overflow: visualization ? "hidden" : "auto",
          outline: "none",
        }}
      >
        <div className={classNames("sa-substituter", Classes.DARK)}>
          {/* As the Stepper's and the E-Stepper's: a round number of labels, always ending at the last
              step (Blueprint's default labels every step, which runs off the end for a long run), and
              a new key at each width and after a layout, because Blueprint measures its track once. */}
          <Slider
            key={`${sliderKey}-${this.state.width}`}
            disabled={disabled}
            min={0}
            max={this.stepsTotal}
            labelValues={sliderLabels(this.stepsTotal)}
            onChange={this.sliderShift}
            onRelease={this.sliderRelease}
            value={value < 0 ? 0 : value}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <ButtonGroup>
              {toggleButton("Control and Stash", "layers", controlStash, () =>
                CseMachine.toggleControlStash(),
              )}
              {toggleButton("Truncate Control", "minimize", CseMachine.getStackTruncated(), () =>
                CseMachine.toggleStackTruncated(),
              )}
              {toggleButton("Alignment", "eye-open", CseMachine.getCenterAlignment(), () =>
                CseMachine.toggleCenterAlignment(),
              )}
              <Tooltip
                content="Filter Arrows"
                compact
                portalContainer={fullscreenPortalContainer()}
              >
                <Popover
                  portalContainer={fullscreenPortalContainer()}
                  isOpen={arrowFilterOpen}
                  onInteraction={nextOpen => this.setState({ arrowFilterOpen: nextOpen })}
                  position={Position.BOTTOM_LEFT}
                  content={<CseArrowFilterMenu onChange={this.refreshArrowFilters} />}
                >
                  <AnchorButton icon="flow-branch" disabled={disabled} />
                </Popover>
              </Tooltip>
            </ButtonGroup>
            <ButtonGroup>
              <Button
                disabled={disabled || atFirst}
                icon="double-chevron-left"
                onClick={this.stepPrevBreakpoint}
              />
              <Button
                disabled={disabled || atFirst}
                icon="chevron-left"
                onClick={controlStash ? this.stepPrevious : this.stepPrevChangepoint}
              />
              <Button
                disabled={disabled || atLast}
                icon="chevron-right"
                onClick={controlStash ? this.stepNext : this.stepNextChangepoint}
              />
              <Button
                disabled={disabled || atLast}
                icon="double-chevron-right"
                onClick={this.stepNextBreakpoint}
              />
            </ButtonGroup>
            <ButtonGroup>
              <Tooltip content="Clear Unreachable Objects" compact>
                <AnchorButton
                  onMouseUp={this.clearUnreachable}
                  icon="eraser"
                  disabled={clearDeadFrames || disabled}
                />
              </Tooltip>
              {toggleButton("Print", "print", CseMachine.getPrintableMode(), () =>
                CseMachine.togglePrintableMode(),
              )}
              <Tooltip content="Save" compact>
                <AnchorButton icon="floppy-disk" disabled={disabled} onClick={Layout.exportImage} />
              </Tooltip>
            </ButtonGroup>
          </div>
        </div>
        {/* The evaluator cut the run off (its own cap): the diagram at the last step is still a
            valid state, so this is beside it, not instead of it. */}
        {end?.status === "cut-off" ? (
          <Callout
            intent="warning"
            icon="warning-sign"
            compact
            data-testid="cse-machine-cut-off"
            style={{ margin: "8px 0" }}
          >
            The steps end here, before the program finished: {end.reason}.
          </Callout>
        ) : null}
        {visualization ?? <CseMachineDefaultText />}
        <ButtonGroup vertical style={{ position: "absolute", bottom: "20px", right: "20px" }}>
          <Button
            icon="plus"
            disabled={disabled}
            onClick={() => Layout.zoomStage(true, 5)}
            style={{ marginBottom: "5px", borderRadius: "3px" }}
          />
          <Button
            icon="minus"
            disabled={disabled}
            onClick={() => Layout.zoomStage(false, 5)}
            style={{ borderRadius: "3px" }}
          />
        </ButtonGroup>
      </div>
    );
  }
}

function CseMachineDefaultText() {
  return (
    <div
      id="cse-machine-default-text"
      className={Classes.RUNNING_TEXT}
      data-testid="cse-machine-default-text"
    >
      <span>
        The CSE machine generates control, stash and environment model diagrams of a program. Run
        your program, then drag the slider above to see the state of the control, stash and
        environment at different stages in its evaluation. The fast-forward buttons (double chevron)
        take you to the next breakpoint in your program.
      </span>
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
      Note that these shortcuts are only active when the browser focus is on this tab.
    </div>
  );
}
