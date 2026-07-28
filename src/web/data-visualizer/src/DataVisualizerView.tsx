import { Button, Card, Classes } from '@blueprintjs/core';
import { useEffect, useState } from 'react';

import type { SerializedDataVisualizerRow } from '@sourceacademy/common-data-visualizer';
import { Config } from './Config';
import { Tree } from './tree/Tree';

// To account for overflow to the left/top due to a backward arrow — matches the old code's
// `createDrawing`'s `leftMargin`/`topMargin` exactly. This is *not* visual padding (the Card
// around each drawing already provides that via CSS); it's the minimum inset a stroked box drawn
// at x=0 needs so its own border isn't clipped by the canvas edge. `OriginalDrawer.draw()` already
// factors this same constant into the Stage's width/height — passing any other value here desyncs
// that sizing from where content actually starts, clipping the far/bottom edge of every box.
const DRAWING_MARGIN = Config.StrokeWidth / 2;

type Props = {
  rows: SerializedDataVisualizerRow[];
};

/**
 * Renders the data visualizer tab. Ported layout-for-layout from the old pre-Conductor
 * `SideContentDataVisualizer.tsx`: one `draw_data(...)` call ("step") is shown at a time, with
 * Previous/Next pagination across calls (only shown once there's more than one), and each call's
 * arguments laid out side by side as "Structure i" cards. The old version kept this state in a
 * static `DataVisualizer` singleton class plus local `useState`; here it's just local `useState`
 * over the rows already pushed through the channel — same shape (one `SerializedDataVisualizerRow`
 * per call is exactly the old code's one `Step`), no singleton needed.
 *
 * Unlike the old tool, there is no Binary Tree/General Tree view toggle — deliberately dropped for
 * this port; always draws the original box-and-pointer layout.
 */
export default function DataVisualizerView({ rows }: Props) {
  const [currentStep, setCurrentStep] = useState(0);

  // Mirrors the old code's `DataVisualizer.init(steps => { ...; setCurrentStep(0); })`: every time a
  // new set of calls arrives (a fresh Run), jump back to the first call.
  useEffect(() => {
    setCurrentStep(0);
  }, [rows]);

  // Old code scoped ArrowLeft/ArrowRight navigation to this tab via a `HotKeys` wrapper from the
  // host's own hotkey library, unavailable to a standalone plugin package. This reproduces the same
  // bindings directly, only suppressed while focus is in an editable field (e.g. the code editor)
  // elsewhere on the page, so the arrow keys still work for text editing.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const active = document.activeElement;
      const isEditable =
        active instanceof HTMLElement &&
        (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
      if (isEditable) {
        return;
      }
      if (event.key === 'ArrowLeft') {
        setCurrentStep(prev => Math.max(0, prev - 1));
      } else if (event.key === 'ArrowRight') {
        setCurrentStep(prev => Math.min(rows.length - 1, prev + 1));
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rows.length]);

  const onPrevButtonClick = () => setCurrentStep(prev => Math.max(0, prev - 1));
  const onNextButtonClick = () => setCurrentStep(prev => Math.min(rows.length - 1, prev + 1));

  const step = rows[currentStep];
  const firstStep = currentStep === 0;
  const finalStep = rows.length === 0 || currentStep === rows.length - 1;

  return (
    <div className={Classes.DARK}>
      {rows.length > 1 ? (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <Button
            style={{ position: 'absolute', left: 0 }}
            size="large"
            icon="arrow-left"
            onClick={onPrevButtonClick}
            disabled={firstStep}
          >
            Previous
          </Button>
          <h3 className={Classes.TEXT_LARGE}>
            Call {currentStep + 1}/{rows.length}
          </h3>
          <Button
            style={{ position: 'absolute', right: 0 }}
            size="large"
            icon="arrow-right"
            onClick={onNextButtonClick}
            disabled={finalStep}
          >
            Next
          </Button>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div
          key={step.length}
          style={{
            display: 'flex',
            flexDirection: 'row',
            overflowX: 'auto',
          }}
        >
          {step.map((node, i) => (
            <div key={i} style={{ margin: step.length > 1 ? 0 : '0 auto' }}>
              <Card style={{ background: '#1a2530', padding: 10 }}>
                {step.length > 1 && (
                  <h5
                    className={`${Classes.HEADING} ${Classes.MONOSPACE_TEXT}`}
                    style={{ marginTop: 0, marginBottom: 20, whiteSpace: 'nowrap' }}
                  >
                    Structure {i + 1}
                  </h5>
                )}
                {Tree.fromSerializedNode(node).draw(DRAWING_MARGIN, DRAWING_MARGIN, i)}
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <DataVisualizerDefaultText />
      )}
    </div>
  );
}

function DataVisualizerDefaultText() {
  return (
    <p id="data-visualizer-default-text" className={Classes.RUNNING_TEXT}>
      The data visualizer helps you to visualize data structures.
      <br />
      <br />
      It is activated by calling the function <code>draw_data(x1, x2, ... xn)</code>, where{' '}
      <code>xk</code> would be the k<sup>th</sup> data structure that you want to visualize and{' '}
      <code>n</code> is the number of structures.
      <br />
      <br />
      The data visualizer uses box-and-pointer diagrams, as introduced in{' '}
      <a href="https://sicp.sourceacademy.org/json_py/" target="_blank" rel="noreferrer">
        <i>Structure and Interpretation of Computer Programs, Python Edition</i>
      </a>
      .
    </p>
  );
}
