import type {
  EStepperFrame,
  EStepperHeapObject,
  EStepperLookup,
} from "@sourceacademy/common-e-stepper";
import { useEffect, useMemo, useState } from "react";
import { Arrow, Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";

import { DiagramColors, frameColor } from "./colors";
import {
  type ArrowSpec,
  type FrameBox,
  layoutDiagram,
  LayoutConfig as C,
  type ObjectBox,
  valueLabel,
} from "./layout";

const FONT = "Inconsolata, Consolas, monospace";
const FONT_SIZE = 13;

interface Props {
  frames: EStepperFrame[];
  heap: EStepperHeapObject[];
  activeFrameId: string;
  lookups: EStepperLookup[];
  /** The heap object under the mouse (in either pane), or null. */
  hovered: string | null;
  onHover: (objectId: string | null) => void;
  width: number;
  height: number;
}

/**
 * The environment diagram: frames and heap objects as in the CSE machine visualization. Pannable
 * (drag) and zoomable (mouse wheel); it is fitted to the available space whenever a new run arrives.
 */
export default function EnvDiagram(props: Props) {
  const layout = useMemo(() => layoutDiagram(props.frames, props.heap), [props.frames, props.heap]);
  const fitScale = Math.min(1, props.width / layout.width, props.height / layout.height);
  const [view, setView] = useState({ scale: fitScale, x: 0, y: 0 });

  // Re-fit when the diagram grows beyond the view or the view is resized; keep the user's zoom and
  // pan otherwise, so stepping through a run does not make the drawing jump around.
  useEffect(() => {
    setView(v => (v.scale > fitScale ? { scale: fitScale, x: 0, y: 0 } : v));
  }, [fitScale]);

  const lookedUp = new Set(props.lookups.map(l => `${l.frameId}\u0000${l.name}`));

  return (
    <Stage
      width={props.width}
      height={props.height}
      draggable
      x={view.x}
      y={view.y}
      scaleX={view.scale}
      scaleY={view.scale}
      onDragEnd={e => setView(v => ({ ...v, x: e.target.x(), y: e.target.y() }))}
      onWheel={e => {
        e.evt.preventDefault();
        const stage = e.target.getStage();
        const pointer = stage?.getPointerPosition();
        if (!stage || !pointer) return;
        const factor = e.evt.deltaY > 0 ? 1 / 1.1 : 1.1;
        setView(v => {
          const scale = Math.min(3, Math.max(0.2, v.scale * factor));
          // Zoom around the mouse pointer.
          const at = { x: (pointer.x - v.x) / v.scale, y: (pointer.y - v.y) / v.scale };
          return { scale, x: pointer.x - at.x * scale, y: pointer.y - at.y * scale };
        });
      }}
    >
      <Layer>
        {layout.frames.map(box => (
          <FrameDrawing
            key={box.frame.id}
            box={box}
            active={box.frame.id === props.activeFrameId}
            lookedUp={lookedUp}
          />
        ))}
        {layout.objects.map(box => (
          <ObjectDrawing
            key={box.object.id}
            box={box}
            hovered={props.hovered === box.object.id}
            onHover={props.onHover}
          />
        ))}
        {layout.arrows.map(arrow => (
          <ArrowDrawing key={arrow.key} arrow={arrow} />
        ))}
      </Layer>
    </Stage>
  );
}

function FrameDrawing(props: { box: FrameBox; active: boolean; lookedUp: Set<string> }) {
  const { box } = props;
  const color = frameColor(box.index);
  const boxTop = box.y + C.headerHeight;
  return (
    <Group opacity={box.frame.isGarbage ? DiagramColors.garbageOpacity : 1}>
      <Text
        x={box.x}
        y={box.y + 2}
        text={box.frame.name === "global" ? box.frame.id : `${box.frame.id}  ${box.frame.name}`}
        fontFamily={FONT}
        fontSize={FONT_SIZE}
        fontStyle="bold"
        fill={color}
      />
      <Rect
        x={box.x}
        y={boxTop}
        width={box.width}
        height={box.height}
        stroke={color}
        strokeWidth={props.active ? 4 : 2}
        cornerRadius={6}
        shadowColor={props.active ? color : undefined}
        shadowBlur={props.active ? 10 : 0}
      />
      {box.rows.map(row => (
        <Group key={row.name}>
          {props.lookedUp.has(`${box.frame.id}\u0000${row.name}`) ? (
            <Rect
              x={box.x + 2}
              y={row.y - C.rowHeight / 2}
              width={box.width - 4}
              height={C.rowHeight}
              fill={DiagramColors.lookup}
              cornerRadius={3}
            />
          ) : null}
          <Text
            x={box.x + C.padding}
            y={row.y - FONT_SIZE / 2}
            text={`${row.name}:`}
            fontFamily={FONT}
            fontSize={FONT_SIZE}
            fill={DiagramColors.text}
          />
          {row.value.kind === "ref" ? (
            <Circle
              x={row.valueX + C.dotRadius}
              y={row.y}
              radius={C.dotRadius}
              fill={DiagramColors.stroke}
            />
          ) : (
            <Text
              x={row.valueX}
              y={row.y - FONT_SIZE / 2}
              text={valueLabel(row.value)}
              fontFamily={FONT}
              fontSize={FONT_SIZE}
              fill={row.value.kind === "unassigned" ? DiagramColors.dimText : DiagramColors.text}
              fontStyle={row.value.kind === "builtin" ? "italic" : "normal"}
            />
          )}
        </Group>
      ))}
    </Group>
  );
}

function ObjectDrawing(props: {
  box: ObjectBox;
  hovered: boolean;
  onHover: (objectId: string | null) => void;
}) {
  const { box } = props;
  const object = box.object;
  const stroke = props.hovered ? DiagramColors.hover : DiagramColors.stroke;
  const strokeWidth = props.hovered ? 3 : 2;
  const label =
    object.kind === "function" && object.name ? `${object.id} ${object.name}` : object.id;
  return (
    <Group
      opacity={object.isGarbage ? DiagramColors.garbageOpacity : 1}
      onMouseEnter={() => props.onHover(object.id)}
      onMouseLeave={() => props.onHover(null)}
    >
      <Text
        x={box.x}
        y={box.y - C.objectLabelHeight}
        text={label}
        fontFamily={FONT}
        fontSize={FONT_SIZE - 1}
        fill={props.hovered ? DiagramColors.hover : DiagramColors.dimText}
      />
      {object.kind === "function" ? (
        <>
          <Circle
            x={box.x + C.functionRadius}
            y={box.y + C.functionRadius}
            radius={C.functionRadius}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <Circle
            x={box.x + 3 * C.functionRadius}
            y={box.y + C.functionRadius}
            radius={C.functionRadius}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          <Circle
            x={box.x + C.functionRadius}
            y={box.y + C.functionRadius}
            radius={C.dotRadius}
            fill={stroke}
          />
          <Circle
            x={box.x + 3 * C.functionRadius}
            y={box.y + C.functionRadius}
            radius={C.dotRadius}
            fill={stroke}
          />
        </>
      ) : (
        <>
          <Rect
            x={box.x}
            y={box.y}
            width={box.width}
            height={box.height}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          {object.elements.map((element, i) =>
            i === 0 ? null : (
              <Line
                key={`sep${i}`}
                points={[
                  box.x + i * C.cellWidth,
                  box.y,
                  box.x + i * C.cellWidth,
                  box.y + box.height,
                ]}
                stroke={stroke}
                strokeWidth={strokeWidth}
              />
            ),
          )}
          {object.elements.map((element, i) =>
            element.kind === "ref" ? (
              <Circle
                key={`v${i}`}
                x={box.x + (i + 0.5) * C.cellWidth}
                y={box.y + C.cellHeight / 2}
                radius={C.dotRadius}
                fill={stroke}
              />
            ) : (
              <Text
                key={`v${i}`}
                x={box.x + i * C.cellWidth}
                y={box.y + C.cellHeight / 2 - FONT_SIZE / 2}
                width={C.cellWidth}
                align="center"
                text={valueLabel(element)}
                fontFamily={FONT}
                fontSize={FONT_SIZE}
                fill={DiagramColors.text}
                wrap="none"
                ellipsis
              />
            ),
          )}
        </>
      )}
    </Group>
  );
}

function ArrowDrawing(props: { arrow: ArrowSpec }) {
  const { arrow } = props;
  return (
    <Arrow
      points={[arrow.from.x, arrow.from.y, arrow.to.x, arrow.to.y]}
      stroke={DiagramColors.stroke}
      fill={DiagramColors.stroke}
      strokeWidth={1.5}
      pointerLength={7}
      pointerWidth={6}
      dash={arrow.kind === "parent" ? [6, 4] : undefined}
      opacity={arrow.garbage ? DiagramColors.garbageOpacity : 0.9}
      listening={false}
    />
  );
}
