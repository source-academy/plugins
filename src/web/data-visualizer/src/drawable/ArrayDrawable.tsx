import { PureComponent } from "react";
import { Group, Line, Rect, Text } from "react-konva";

import { Config } from "../Config";
import { formatLeaf } from "../format";
import { DataTreeNode, TreeNode } from "../tree/TreeNode";
import { NullDrawable } from "./Drawable";

type ArrayProps = {
  nodes: TreeNode[];
  x: number;
  y: number;
  color: string;
};

/**
 *  Represents an array in a tree.
 */
class ArrayDrawable extends PureComponent<ArrayProps> {
  render() {
    const createChildText = (node: DataTreeNode, index: number) => {
      if (node.isEmpty) {
        const props = {
          x: index * Config.BoxWidth,
          y: 0,
        };
        return <NullDrawable key={index} {...props} />;
      }
      const textToDisplay = formatLeaf(node.displayValue!, node.label!);
      return (
        <Text
          key={"" + node.displayValue + index}
          text={textToDisplay}
          align="center"
          width={Config.BoxWidth}
          x={Config.BoxWidth * index}
          y={Math.floor((Config.BoxHeight - 1.2 * 12) / 2)}
          fontStyle="normal"
          fill="white"
          preventDefault={false}
        />
      );
    };

    return (
      <Group x={this.props.x} y={this.props.y}>
        {/* Outer rectangle */}
        <Rect
          width={Math.max(Config.BoxWidth * this.props.nodes.length, Config.BoxMinWidth)}
          height={Config.BoxHeight}
          strokeWidth={Config.StrokeWidth}
          stroke={Config.Stroke}
          fill={this.props.color}
          preventDefault={false}
        />
        {/* Vertical lines in the box */}
        {this.props.nodes.length > 1 &&
          Array.from(Array(this.props.nodes.length - 1), (e, i) => {
            return (
              <Line
                key={"line" + i}
                points={[Config.BoxWidth * (i + 1), 0, Config.BoxWidth * (i + 1), Config.BoxHeight]}
                strokeWidth={Config.StrokeWidth}
                stroke={Config.Stroke}
                preventDefault={false}
              />
            );
          })}
        {this.props.nodes.map(
          (child, index) => child instanceof DataTreeNode && createChildText(child, index),
        )}
      </Group>
    );
  }
}

export default ArrayDrawable;
