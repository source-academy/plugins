import { memo } from "react";
import { Arrow } from "react-konva";

import { Config } from "../utils/Config";
import DataVisualizer from "../DataVisualizer";
import { DataVizMode } from "../DataVisualizerTypes";

type Props = {
  from: { x: number; y: number };
  to: { x: number; y: number };
};

/**
 * Represents an arrow used to connect a parent node and a child node.
 *
 * Used with ArrayDrawable and FunctionDrawable.
 */
function ArrowDrawable(props: Props) {
  if (
    DataVisualizer.getMode() === DataVizMode.BINARY_TREE ||
    DataVisualizer.getMode() === DataVizMode.GENERAL_TREE
  ) {
    // Binary Tree View and General Tree View
    return (
      <Arrow
        key={props + ""}
        points={[
          props.from.x,
          props.from.y,
          props.to.x + Config.BoxWidth / 2,
          props.to.y + Config.ArrowPointerOffsetVertical,
        ]}
        pointerWidth={Config.ArrowPointerSize}
        pointerLength={Config.ArrowPointerSize}
        fill={Config.Fill}
        stroke={Config.Stroke}
        strokeWidth={Config.StrokeWidth}
        preventDefault={false}
      />
    );
  } else {
    // OriginalView
    return (
      <Arrow
        key={props + ""}
        points={[
          props.from.x,
          props.from.y,
          props.to.x + Config.BoxWidth / 2,
          props.to.y + Config.ArrowPointerOffsetVertical,
        ]}
        pointerWidth={Config.ArrowPointerSize}
        pointerLength={Config.ArrowPointerSize}
        fill={Config.Fill}
        stroke={Config.Stroke}
        strokeWidth={Config.StrokeWidth}
        preventDefault={false}
      />
    );
  }
}

export default memo(ArrowDrawable);
