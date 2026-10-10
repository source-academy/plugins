import type { CseDiagramAnchorResolver, CseDiagramPoint } from "@sourceacademy/common-cse-machine";
import { useLayoutEffect, useRef, useState } from "react";

/** An arrow from a badge or bracket in the program pane to an object or frame in the diagram. */
export interface ProgramArrow {
  key: string;
  kind: "object" | "frame";
  /** The object's or frame's id. */
  id: string;
  /** In the overlay's coordinates (pixels from the top-left of the panes' container). */
  from: CseDiagramPoint;
  to: CseDiagramPoint;
  /** The diagram's zoom at the target: the arrowhead and line scale with it. */
  scale: number;
}

/** The marks in the program pane that arrows start from. */
export const REF_ATTRIBUTE = "data-estepper-ref";
export const ENV_ATTRIBUTE = "data-estepper-env";

const HEAD_LENGTH = 8;
const HEAD_HALF_WIDTH = 4;
const round = (n: number) => Math.round(n * 10) / 10;
const fmt = (p: CseDiagramPoint) => `${round(p.x)} ${round(p.y)}`;

/** How an arrow arrives at its target: along the axis it travelled, down onto the top of an
 * object, or from the left into the left edge of a frame. */
export type Arrival = "axis" | "above" | "left";

/**
 * The curve from `from` to `to` and its arrowhead. The curve leaves along the axis the two points
 * are further apart on (horizontally when the panes are side by side, vertically when stacked), so
 * it bends smoothly instead of looping back. How it arrives depends on `arrival`: along that axis,
 * down onto `to` (the top of an object), or from the left (into the left edge of a frame). The last
 * two hold whatever the layout, so an arrow never lands tangentially on its target.
 */
export function arrowGeometry(
  from: CseDiagramPoint,
  to: CseDiagramPoint,
  arrival: Arrival = "axis",
  scale = 1,
): { path: string; head: string } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const span = horizontal ? dx : dy;
  const reach = Math.max(20, Math.min(Math.abs(span) / 2, 120)) * (span < 0 ? -1 : 1);
  const drop = Math.max(20, Math.min(Math.abs(dy) / 2, 120));
  const lead = dx > 0 ? Math.max(24, Math.min(dx / 2, 120)) : 40;
  const c1 = horizontal ? { x: from.x + reach, y: from.y } : { x: from.x, y: from.y + reach };
  const c2 =
    arrival === "above"
      ? { x: to.x, y: to.y - drop }
      : arrival === "left"
        ? { x: to.x - lead, y: to.y }
        : horizontal
          ? { x: to.x - reach, y: to.y }
          : { x: to.x, y: to.y - reach };
  const angle = Math.atan2(to.y - c2.y, to.x - c2.x);
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  const base = { x: to.x - HEAD_LENGTH * scale * cos, y: to.y - HEAD_LENGTH * scale * sin };
  const left = {
    x: base.x - HEAD_HALF_WIDTH * scale * sin,
    y: base.y + HEAD_HALF_WIDTH * scale * cos,
  };
  const right = {
    x: base.x + HEAD_HALF_WIDTH * scale * sin,
    y: base.y - HEAD_HALF_WIDTH * scale * cos,
  };
  return {
    path: `M ${fmt(from)} C ${fmt(c1)}, ${fmt(c2)}, ${fmt(to)}`,
    head: `${fmt(to)} ${fmt(left)} ${fmt(right)}`,
  };
}

const inside = (p: CseDiagramPoint, r: DOMRect, margin = 0) =>
  p.x >= r.left - margin &&
  p.x <= r.right + margin &&
  p.y >= r.top - margin &&
  p.y <= r.bottom + margin;

/**
 * Works out the arrows from the marks in `program` (the `data-estepper-ref` badges, and the
 * `data-estepper-env` labels of environment brackets) to where `resolve` puts their targets in
 * `diagram`, in the coordinates of `container`. A mark scrolled out of the program pane, and a
 * target outside the diagram's view, get no arrow.
 */
export function computeProgramArrows(
  container: Element,
  program: Element,
  diagram: Element,
  resolve: CseDiagramAnchorResolver,
): ProgramArrow[] {
  const origin = container.getBoundingClientRect();
  const programRect = program.getBoundingClientRect();
  const diagramRect = diagram.getBoundingClientRect();
  const arrows: ProgramArrow[] = [];
  const collect = (attribute: string, kind: ProgramArrow["kind"]) => {
    program.querySelectorAll(`[${attribute}]`).forEach((mark, index) => {
      const id = mark.getAttribute(attribute)!;
      const rect = mark.getBoundingClientRect();
      // Arrows start at the centre of the tag.
      const start = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      if (!inside(start, programRect)) return;
      const target = resolve({ kind, id });
      if (!target) return;
      const end = { x: diagramRect.left + target.x, y: diagramRect.top + target.y };
      if (!inside(end, diagramRect)) return;
      arrows.push({
        key: `${kind}:${id}:${index}`,
        kind,
        id,
        from: { x: start.x - origin.left, y: start.y - origin.top },
        to: { x: end.x - origin.left, y: end.y - origin.top },
        scale: target.scale ?? 1,
      });
    });
  };
  collect(REF_ATTRIBUTE, "object");
  collect(ENV_ATTRIBUTE, "frame");
  return arrows;
}

interface Props {
  resolve: CseDiagramAnchorResolver | null;
  /** The object or frame under the mouse, whose arrows are drawn emphasized. */
  hovered: string | null;
  hoveredFrame: string | null;
  colorOfFrame: (frameId: string) => string;
}

const REF_COLOR = "#c5cbd3";

/**
 * Draws the arrows from the program pane into the diagram, over both. It is placed last inside the
 * container of the two panes (which is positioned), and finds the panes itself; it measures at
 * every render, and again when the program pane scrolls or the window is resized.
 */
export default function ProgramArrows({ resolve, hovered, hoveredFrame, colorOfFrame }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [arrows, setArrows] = useState<ProgramArrow[]>([]);
  const [, setScrolled] = useState(0);

  useLayoutEffect(() => {
    const container = svgRef.current?.parentElement;
    const program = container?.querySelector(".estepper-program");
    const diagram = container?.querySelector(".estepper-diagram");
    const next =
      resolve && container && program && diagram
        ? computeProgramArrows(container, program, diagram, resolve)
        : [];
    setArrows(previous => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
  });

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const program = svgRef.current?.parentElement?.querySelector(".estepper-program");
    const remeasure = () => setScrolled(n => n + 1);
    program?.addEventListener("scroll", remeasure);
    window.addEventListener("resize", remeasure);
    return () => {
      program?.removeEventListener("scroll", remeasure);
      window.removeEventListener("resize", remeasure);
    };
  }, []);

  return (
    <svg ref={svgRef} className="estepper-program-arrows" data-testid="estepper-program-arrows">
      {arrows.map(arrow => {
        const { path, head } = arrowGeometry(
          arrow.from,
          arrow.to,
          arrow.kind === "object" ? "above" : "left",
          arrow.scale,
        );
        const emphasized =
          arrow.kind === "object" ? hovered === arrow.id : hoveredFrame === arrow.id;
        const color = arrow.kind === "frame" ? colorOfFrame(arrow.id) : REF_COLOR;
        return (
          <g key={arrow.key} opacity={emphasized ? 1 : 0.55}>
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={(emphasized ? 2.5 : 1.5) * arrow.scale}
            />
            <polygon points={head} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}
