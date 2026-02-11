import React from "react";
import type { Construction, Stroke, Vec2 } from "../shape/shapeTypes";

const padding = 140;

function translatePoint(point: Vec2, offset: Vec2): Vec2 {
  return { x: point.x + offset.x, y: point.y + offset.y };
}

function distance(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

function angle(a: Vec2, b: Vec2): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function quadPoint(p0: Vec2, p1: Vec2, p2: Vec2, t: number): Vec2 {
  const inv = 1 - t;
  return {
    x: inv * inv * p0.x + 2 * inv * t * p1.x + t * t * p2.x,
    y: inv * inv * p0.y + 2 * inv * t * p1.y + t * t * p2.y
  };
}

function approxCurve(points: Vec2[], segments: number): Vec2[] {
  if (points.length < 3) {
    return points;
  }
  const [p0, p1, p2] = points;
  const result: Vec2[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    result.push(quadPoint(p0, p1, p2, t));
  }
  return result;
}

type StrokeSegment = {
  id: string;
  from: Vec2;
  to: Vec2;
  weight: number;
  order: number;
  tags: string[];
};

function strokeToSegments(stroke: Stroke, orderBase: number, offset: Vec2): StrokeSegment[] {
  const translated = stroke.points.map((point) => translatePoint(point, offset));

  if (stroke.kind === "line") {
    const [from, to] = translated;
    return [
      {
        id: stroke.id,
        from,
        to,
        weight: stroke.weight,
        order: orderBase,
        tags: stroke.tags
      }
    ];
  }

  const points = stroke.kind === "curve" ? approxCurve(translated, 10) : translated;
  const segments: StrokeSegment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    segments.push({
      id: `${stroke.id}_seg_${i}`,
      from: points[i],
      to: points[i + 1],
      weight: stroke.weight,
      order: orderBase * 20 + i,
      tags: stroke.tags
    });
  }
  return segments;
}

export function renderConstructionHtml(
  construction: Construction,
  options: { audit?: boolean } = {}
): JSX.Element {
  const { min, max } = construction.bounds;
  const width = Math.max(1, max.x - min.x + padding * 2);
  const height = Math.max(1, max.y - min.y + padding * 2);
  const offset = { x: -min.x + padding, y: -min.y + padding };

  const strokeSegments: StrokeSegment[] = [];
  construction.order.strokes.forEach((id, index) => {
    const stroke = construction.strokes[id];
    if (!stroke) {
      return;
    }
    strokeSegments.push(...strokeToSegments(stroke, index, offset));
  });

  return (
    <div className="viewport">
      <div
        className="canvas"
        style={{
          width,
          height
        }}
      >
        <div className="regions">
          {construction.order.regions.map((regionId, index) => {
            const region = construction.regions[regionId];
            if (!region) {
              return null;
            }
            const boundary = region.boundaryStrokeIds
              .map((id) => construction.strokes[id])
              .find((stroke) => stroke?.kind === "polyline");
            if (!boundary) {
              return null;
            }
            const points = boundary.points.map((point) => translatePoint(point, offset));
            const polygon = points.map((point) => `${point.x}px ${point.y}px`).join(", ");
            const isHard = region.tags.includes("HARD");
            const isSoft = region.tags.includes("SOFT");
            const fill = isHard
              ? "rgba(162, 134, 106, 0.22)"
              : isSoft
                ? "rgba(162, 134, 106, 0.08)"
                : "rgba(162, 134, 106, 0.12)";
            return (
              <div
                key={regionId}
                className="region"
                style={{
                  clipPath: `polygon(${polygon})`,
                  animationDelay: `${index * 60}ms`,
                  background: fill
                }}
              />
            );
          })}
        </div>

        <div className="strokes">
          {strokeSegments
            .filter((segment) => !segment.tags.includes("REGION_ONLY"))
            .map((segment) => {
            const length = distance(segment.from, segment.to);
            const rotation = angle(segment.from, segment.to);
            const top = segment.from.y - segment.weight / 2;
            return (
              <div
                key={segment.id}
                className="stroke line"
                style={
                  {
                    left: segment.from.x,
                    top,
                    width: length,
                    height: segment.weight,
                    animationDelay: `${segment.order * 40}ms`,
                    "--angle": `${rotation}rad`
                  } as React.CSSProperties
                }
              />
            );
          })}
        </div>

        {options.audit ? (
          <div className="anchors">
            {construction.order.anchors.map((id) => {
              const anchor = construction.anchors[id];
              if (!anchor) {
                return null;
              }
              const p = translatePoint(anchor.p, offset);
              return (
                <div key={id} className="anchor" style={{ left: p.x, top: p.y }}>
                  <span>{id}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
