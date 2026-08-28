import { Button } from '@blueprintjs/core';
import type { SerializedDataVisualizerRow } from '@sourceacademy/common-data-visualizer';
import { act } from 'react';
import TestRenderer from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import DataVisualizerView from '../DataVisualizerView';
import { Tree } from '../tree/Tree';

// Same rationale as the other __tests__ files: avoid Konva's Node-environment build requiring the
// optional `canvas` package. DataVisualizerView pulls this in transitively via Tree/the drawers.
vi.mock(
  import('konva'),
  () =>
    ({
      default: {
        Text: class {
          width() {
            return 40;
          }
          height() {
            return 25;
          }
        },
      },
    }) as any,
);

vi.mock(import('react-konva'), () => {
  const stub = (name: string) => {
    const fn = () => null;
    Object.defineProperty(fn, 'name', { value: name });
    return fn;
  };
  return {
    Stage: stub('Stage'),
    Layer: stub('Layer'),
    Text: stub('Text'),
    Group: stub('Group'),
    Line: stub('Line'),
    Rect: stub('Rect'),
    Circle: stub('Circle'),
    Arrow: stub('Arrow'),
  } as any;
});

// React 19 warns ("The current testing environment is not configured to support act(...)")
// unless this is set - the standard flag for a hand-rolled (non testing-library) React test setup.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// DataVisualizerView reads document.activeElement (to suppress arrow-key nav while the user is
// typing elsewhere on the page) and window.addEventListener/removeEventListener (to bind that same
// nav) directly - real browser APIs vitest's default Node test environment doesn't provide. Rather
// than pull in jsdom (no precedent for it anywhere in this monorepo - see classify/treeViews tests'
// equally deliberate choice to hand-mock konva instead of requiring `canvas`), stub just enough by
// hand: a fake HTMLElement class so `instanceof` checks don't throw, a mutable activeElement, and a
// fake window that captures the keydown handler so tests can invoke it directly instead of needing
// a real event-dispatch system.
class FakeHTMLElement {
  isContentEditable = false;
  tagName = '';
}

let keydownHandler: ((event: KeyboardEvent) => void) | undefined;
const fakeDocument = { activeElement: null as FakeHTMLElement | null };
const fakeWindow = {
  addEventListener: (type: string, handler: EventListenerOrEventListenerObject) => {
    if (type === 'keydown') {
      keydownHandler = handler as (event: KeyboardEvent) => void;
    }
  },
  removeEventListener: (type: string, handler: EventListenerOrEventListenerObject) => {
    if (type === 'keydown' && keydownHandler === handler) {
      keydownHandler = undefined;
    }
  },
};

beforeEach(() => {
  keydownHandler = undefined;
  fakeDocument.activeElement = null;
  vi.stubGlobal('HTMLElement', FakeHTMLElement);
  vi.stubGlobal('document', fakeDocument);
  vi.stubGlobal('window', fakeWindow);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const leaf = (n: number): SerializedDataVisualizerRow[number] => ({
  type: 'leaf',
  displayValue: String(n),
  label: 'number',
});

const pressArrowKey = (key: 'ArrowLeft' | 'ArrowRight') => {
  act(() => {
    keydownHandler?.({ key } as KeyboardEvent);
  });
};

// React 19 requires the initial mount itself to run inside act(), not just later interactions -
// without this, effects (including the window.addEventListener call this file depends on to
// capture keydownHandler) aren't guaranteed to have run yet by the time the renderer is returned.
const renderView = (rows: SerializedDataVisualizerRow[]): TestRenderer.ReactTestRenderer => {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<DataVisualizerView rows={rows} />);
  });
  return renderer;
};

describe(DataVisualizerView, () => {
  test('shows the placeholder help text and no controls when there are no rows yet', () => {
    const renderer = renderView([]);
    expect(renderer.root.findByProps({ id: 'data-visualizer-default-text' })).toBeTruthy();
    expect(renderer.root.findAllByType(Button)).toHaveLength(0);
  });

  test('a single call with one argument shows the view-mode toggle but no pagination or structure headers', () => {
    const rows: SerializedDataVisualizerRow[] = [[leaf(1)]];
    const renderer = renderView(rows);

    // Classic/Binary Tree/General Tree, no Previous/Next (only shown when rows.length > 1), no
    // "Structure N" headers (only shown when a single call has more than one argument).
    const buttons = renderer.root.findAllByType(Button);
    expect(buttons.map(b => b.props.children)).toEqual(['Classic', 'Binary Tree', 'General Tree']);
    expect(() => renderer.root.findByProps({ children: 'Previous' })).toThrow();
    expect(renderer.root.findAllByType('h5')).toHaveLength(0);
  });

  test('clicking a view-mode button makes it active and passes the selected mode through to Tree.draw', () => {
    // The active-prop assertions alone can't tell a real wiring bug (e.g. the click handler
    // updating state but DataVisualizerView passing the wrong variable into Tree.draw) from a
    // correctly-wired toggle - spying on the actual draw() call closes that gap.
    const drawSpy = vi.spyOn(Tree.prototype, 'draw');
    const rows: SerializedDataVisualizerRow[] = [[leaf(1)]];
    const renderer = renderView(rows);

    const classic = renderer.root.findByProps({ children: 'Classic' });
    const binaryTree = renderer.root.findByProps({ children: 'Binary Tree' });
    expect(classic.props.active).toBe(true);
    expect(binaryTree.props.active).toBe(false);
    expect(drawSpy).toHaveBeenLastCalledWith('classic');

    act(() => binaryTree.props.onClick());

    expect(renderer.root.findByProps({ children: 'Classic' }).props.active).toBe(false);
    expect(renderer.root.findByProps({ children: 'Binary Tree' }).props.active).toBe(true);
    expect(drawSpy).toHaveBeenLastCalledWith('binaryTree');

    drawSpy.mockRestore();
  });

  test('a call with more than one argument labels each as a separate Structure', () => {
    const rows: SerializedDataVisualizerRow[] = [[leaf(1), leaf(2)]];
    const renderer = renderView(rows);

    // "Structure {i + 1}" mixes text with an expression, so JSX gives each h5 an array of children
    // (["Structure ", 1]) rather than one joined string - join before comparing.
    const headers = renderer.root
      .findAllByType('h5')
      .map(h => (h.props.children as string[]).join(''));
    expect(headers).toEqual(['Structure 1', 'Structure 2']);
  });

  test('more than one call shows Previous/Next pagination, clamped at both ends', () => {
    const rows: SerializedDataVisualizerRow[] = [[leaf(1)], [leaf(2)], [leaf(3)]];
    const renderer = renderView(rows);

    const callLabel = () => renderer.root.findByType('h3');
    expect(callLabel().children?.join('')).toBe('Call 1/3');
    const previous = () => renderer.root.findByProps({ children: 'Previous' });
    const next = () => renderer.root.findByProps({ children: 'Next' });
    expect(previous().props.disabled).toBe(true);
    expect(next().props.disabled).toBe(false);

    act(() => next().props.onClick());
    expect(callLabel().children?.join('')).toBe('Call 2/3');
    expect(previous().props.disabled).toBe(false);

    act(() => next().props.onClick());
    act(() => next().props.onClick()); // one past the end - must clamp, not go out of bounds
    expect(callLabel().children?.join('')).toBe('Call 3/3');
    expect(next().props.disabled).toBe(true);

    act(() => previous().props.onClick());
    expect(callLabel().children?.join('')).toBe('Call 2/3');
  });

  test('ArrowRight/ArrowLeft navigate calls the same way as the Next/Previous buttons', () => {
    const rows: SerializedDataVisualizerRow[] = [[leaf(1)], [leaf(2)]];
    const renderer = renderView(rows);
    const callLabel = () => renderer.root.findByType('h3');

    pressArrowKey('ArrowRight');
    expect(callLabel().children?.join('')).toBe('Call 2/2');

    pressArrowKey('ArrowRight'); // already at the last call - must clamp
    expect(callLabel().children?.join('')).toBe('Call 2/2');

    pressArrowKey('ArrowLeft');
    expect(callLabel().children?.join('')).toBe('Call 1/2');
  });

  test('arrow-key navigation is suppressed while focus is in an editable element', () => {
    const rows: SerializedDataVisualizerRow[] = [[leaf(1)], [leaf(2)]];
    const renderer = renderView(rows);
    const callLabel = () => renderer.root.findByType('h3');

    const editable = new FakeHTMLElement();
    editable.tagName = 'TEXTAREA'; // e.g. focus is in the code editor elsewhere on the page
    fakeDocument.activeElement = editable;

    pressArrowKey('ArrowRight');
    expect(callLabel().children?.join('')).toBe('Call 1/2');
  });

  test('a fresh set of rows resets back to the first call', () => {
    const rows: SerializedDataVisualizerRow[] = [[leaf(1)], [leaf(2)]];
    const renderer = renderView(rows);
    act(() => renderer.root.findByProps({ children: 'Next' }).props.onClick());
    const callLabel = () => renderer.root.findByType('h3');
    expect(callLabel().children?.join('')).toBe('Call 2/2');

    const nextRun: SerializedDataVisualizerRow[] = [[leaf(9)], [leaf(8)], [leaf(7)]];
    act(() => renderer.update(<DataVisualizerView rows={nextRun} />));

    expect(callLabel().children?.join('')).toBe('Call 1/3');
  });
});
