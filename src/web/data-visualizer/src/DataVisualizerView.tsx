import { Button, ButtonGroup, NonIdealState } from '@blueprintjs/core';
import { useState } from 'react';

import type { SerializedDataVisualizerRow } from '@sourceacademy/common-data-visualizer';
import { Tree, type ViewMode } from './tree/Tree';

type Props = {
  rows: SerializedDataVisualizerRow[];
};

const VIEW_MODES: { mode: ViewMode; label: string }[] = [
  { mode: 'original', label: 'Original' },
  { mode: 'binaryTree', label: 'Binary Tree' },
  { mode: 'generalTree', label: 'General Tree' },
];

/**
 * Renders every row drawn so far: each row is the arguments of one `draw_data(...)` call, laid out
 * side by side; rows stack vertically in call order. A view-mode toggle switches every row between
 * the original (box-and-pointer) view and the two specialized tree layouts — mirrors the old
 * pre-Conductor UI's three-button toggle, as local component state instead of a global singleton.
 */
export default function DataVisualizerView({ rows }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('original');

  if (rows.length === 0) {
    return (
      <NonIdealState
        title="Nothing drawn yet"
        description="Call draw_data(...) to visualize a value here."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 8 }}>
      <ButtonGroup>
        {VIEW_MODES.map(({ mode, label }) => (
          <Button key={mode} active={viewMode === mode} onClick={() => setViewMode(mode)}>
            {label}
          </Button>
        ))}
      </ButtonGroup>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} style={{ display: 'flex', flexDirection: 'row', gap: 24, flexWrap: 'wrap' }}>
          {row.map((node, nodeIndex) => {
            const drawer = Tree.fromSerializedNode(node).draw(viewMode);
            return <div key={nodeIndex}>{drawer.draw(10, 10, nodeIndex)}</div>;
          })}
        </div>
      ))}
    </div>
  );
}
