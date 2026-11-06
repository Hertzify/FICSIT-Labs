/**
 * ============================================================================
 * MODULE INDEX: Conveyor Fillet Arcs & Overpass Crossings (`src/game/conveyorCurves.ts`)
 * ============================================================================
 * [Lines 018-042] CurvedSegment, FilletedConveyorPath, ConveyorCrossing
 * [Lines 044-079] sampleOrthogonalPath       - Zero-allocation continuous [0..1] polyline sampler
 * [Lines 081-249] computeFilletedConveyorPath - Converts 90° bends into circular fillet corner arcs
 * [Lines 251-308] sampleFilletedPath         - Continuous position & tangent angle along fillet path
 * [Lines 310-362] findConveyorCrossings      - Detects perpendicular belt intersections for bridges
 * ============================================================================
 */

export type CurvedSegment =
  | {
      type: 'line';
      p1: { x: number; y: number };
      p2: { x: number; y: number };
      length: number;
      angle: number;
    }
  | {
      type: 'arc';
      center: { x: number; y: number };
      radius: number;
      startAngle: number;
      sweepAngle: number;
      length: number;
    };

export interface FilletedConveyorPath {
  segments: CurvedSegment[];
  totalLength: number;
}

export interface ConveyorCrossing {
  x: number;
  y: number;
  overConnId: string;
  underConnId: string;
}

/**
 * Samples a continuous progress t [0..1] along an orthogonal polyline without array allocations.
 * Returns the exact (x, y) world coordinates and direction angle.
 */
export function sampleOrthogonalPath(
  pts: { x: number; y: number }[],
  t: number
): { x: number; y: number; angle: number } {
  if (pts.length === 0) return { x: 0, y: 0, angle: 0 };
  if (pts.length === 1) return { x: pts[0].x, y: pts[0].y, angle: 0 };

  let totalLen = 0;
  for (let i = 1; i < pts.length; i++) {
    totalLen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  if (totalLen <= 0) return { x: pts[0].x, y: pts[0].y, angle: 0 };

  const clampedT = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0;
  const targetDist = clampedT * totalLen;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (acc + len >= targetDist || i === pts.length - 1) {
      const segT = len > 0 ? Math.max(0, Math.min(1, (targetDist - acc) / len)) : 0;
      return {
        x: p1.x + (p2.x - p1.x) * segT,
        y: p1.y + (p2.y - p1.y) * segT,
        angle: Math.atan2(p2.y - p1.y, p2.x - p1.x),
      };
    }
    acc += len;
  }
  return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, angle: 0 };
}

/**
 * Converts an orthogonal right-angled polyline into a smooth conveyor path
 * with rounded circular fillet corner arcs at every 90-degree bend.
 */
export function computeFilletedConveyorPath(
  pts: { x: number; y: number }[],
  cornerRadius = 9.0
): FilletedConveyorPath {
  if (pts.length < 2) {
    return { segments: [], totalLength: 0 };
  }

  // 1. Simplify polyline: remove duplicate adjacent points
  const cleanPts: { x: number; y: number }[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = cleanPts[cleanPts.length - 1];
    const curr = pts[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) > 1e-3) {
      cleanPts.push(curr);
    }
  }

  // 2. Remove intermediate collinear points
  const simplified: { x: number; y: number }[] = [];
  for (let i = 0; i < cleanPts.length; i++) {
    if (i === 0 || i === cleanPts.length - 1) {
      simplified.push(cleanPts[i]);
      continue;
    }
    const pPrev = simplified[simplified.length - 1];
    const pCurr = cleanPts[i];
    const pNext = cleanPts[i + 1];

    const isCollinearH =
      Math.abs(pPrev.y - pCurr.y) < 1e-3 && Math.abs(pCurr.y - pNext.y) < 1e-3;
    const isCollinearV =
      Math.abs(pPrev.x - pCurr.x) < 1e-3 && Math.abs(pCurr.x - pNext.x) < 1e-3;

    if (!isCollinearH && !isCollinearV) {
      simplified.push(pCurr);
    }
  }

  if (simplified.length < 2) {
    return { segments: [], totalLength: 0 };
  }

  if (simplified.length === 2) {
    const p1 = simplified[0];
    const p2 = simplified[1];
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    return {
      segments: [{ type: 'line', p1, p2, length: len, angle }],
      totalLength: len,
    };
  }

  const segments: CurvedSegment[] = [];
  let totalLength = 0;

  interface CornerArc {
    A: { x: number; y: number };
    B: { x: number; y: number };
    center: { x: number; y: number };
    radius: number;
    startAngle: number;
    sweepAngle: number;
    arcLen: number;
  }
  const corners: CornerArc[] = [];

  for (let i = 1; i < simplified.length - 1; i++) {
    const pPrev = simplified[i - 1];
    const pCurr = simplified[i];
    const pNext = simplified[i + 1];

    const vInX = pCurr.x - pPrev.x;
    const vInY = pCurr.y - pPrev.y;
    const lIn = Math.hypot(vInX, vInY);
    const uInX = lIn > 0 ? vInX / lIn : 0;
    const uInY = lIn > 0 ? vInY / lIn : 0;

    const vOutX = pNext.x - pCurr.x;
    const vOutY = pNext.y - pCurr.y;
    const lOut = Math.hypot(vOutX, vOutY);
    const uOutX = lOut > 0 ? vOutX / lOut : 0;
    const uOutY = lOut > 0 ? vOutY / lOut : 0;

    // Corner radius cannot exceed 45% of incoming or outgoing segment lengths
    const maxR = Math.min(lIn * 0.45, lOut * 0.45);
    const r = Math.max(1.0, Math.min(cornerRadius, maxR));

    // Corner entrance point A and exit point B
    const Ax = pCurr.x - uInX * r;
    const Ay = pCurr.y - uInY * r;
    const Bx = pCurr.x + uOutX * r;
    const By = pCurr.y + uOutY * r;

    // Center of curvature circle: C = A + uOut * r
    const Cx = Ax + uOutX * r;
    const Cy = Ay + uOutY * r;

    const startAngle = Math.atan2(Ay - Cy, Ax - Cx);
    const endAngle = Math.atan2(By - Cy, Bx - Cx);

    let sweep = endAngle - startAngle;
    while (sweep > Math.PI) sweep -= Math.PI * 2;
    while (sweep < -Math.PI) sweep += Math.PI * 2;

    const arcLen = Math.abs(sweep) * r;

    corners.push({
      A: { x: Ax, y: Ay },
      B: { x: Bx, y: By },
      center: { x: Cx, y: Cy },
      radius: r,
      startAngle,
      sweepAngle: sweep,
      arcLen,
    });
  }

  // Assemble straight lines and fillet corner arcs
  let currentPos = simplified[0];
  for (let i = 0; i < corners.length; i++) {
    const corner = corners[i];
    const lineLen = Math.hypot(corner.A.x - currentPos.x, corner.A.y - currentPos.y);
    if (lineLen > 1e-3) {
      const angle = Math.atan2(corner.A.y - currentPos.y, corner.A.x - currentPos.x);
      segments.push({
        type: 'line',
        p1: currentPos,
        p2: corner.A,
        length: lineLen,
        angle,
      });
      totalLength += lineLen;
    }

    segments.push({
      type: 'arc',
      center: corner.center,
      radius: corner.radius,
      startAngle: corner.startAngle,
      sweepAngle: corner.sweepAngle,
      length: corner.arcLen,
    });
    totalLength += corner.arcLen;

    currentPos = corner.B;
  }

  // Final straight segment to destination
  const lastPt = simplified[simplified.length - 1];
  const finalLen = Math.hypot(lastPt.x - currentPos.x, lastPt.y - currentPos.y);
  if (finalLen > 1e-3) {
    const angle = Math.atan2(lastPt.y - currentPos.y, lastPt.x - currentPos.x);
    segments.push({
      type: 'line',
      p1: currentPos,
      p2: lastPt,
      length: finalLen,
      angle,
    });
    totalLength += finalLen;
  }

  return { segments, totalLength: Math.max(1, totalLength) };
}

/**
 * Samples position (x, y) and continuous tangent angle along a filleted conveyor path.
 * In corners, tangent angle rotates continuously with multiple intermediate angles
 * across the circular fillet arc rather than snapping abruptly.
 */
export function sampleFilletedPath(
  path: FilletedConveyorPath,
  distPx: number
): { x: number; y: number; angle: number } {
  if (path.segments.length === 0) {
    return { x: 0, y: 0, angle: 0 };
  }

  const targetDist = Math.max(0, Math.min(path.totalLength, Number.isFinite(distPx) ? distPx : 0));
  let acc = 0;

  for (let i = 0; i < path.segments.length; i++) {
    const seg = path.segments[i];
    const segLen = seg.length;

    if (acc + segLen >= targetDist || i === path.segments.length - 1) {
      const segT = segLen > 0 ? Math.max(0, Math.min(1, (targetDist - acc) / segLen)) : 0;

      if (seg.type === 'line') {
        return {
          x: seg.p1.x + (seg.p2.x - seg.p1.x) * segT,
          y: seg.p1.y + (seg.p2.y - seg.p1.y) * segT,
          angle: seg.angle,
        };
      } else {
        const curAngle = seg.startAngle + segT * seg.sweepAngle;
        const x = seg.center.x + seg.radius * Math.cos(curAngle);
        const y = seg.center.y + seg.radius * Math.sin(curAngle);
        const dirSign = Math.sign(seg.sweepAngle) || 1;
        const tangentAngle = curAngle + dirSign * (Math.PI / 2);
        return {
          x,
          y,
          angle: tangentAngle,
        };
      }
    }
    acc += segLen;
  }

  const lastSeg = path.segments[path.segments.length - 1];
  if (lastSeg.type === 'line') {
    return { x: lastSeg.p2.x, y: lastSeg.p2.y, angle: lastSeg.angle };
  } else {
    const endA = lastSeg.startAngle + lastSeg.sweepAngle;
    const dirSign = Math.sign(lastSeg.sweepAngle) || 1;
    return {
      x: lastSeg.center.x + lastSeg.radius * Math.cos(endA),
      y: lastSeg.center.y + lastSeg.radius * Math.sin(endA),
      angle: endA + dirSign * (Math.PI / 2),
    };
  }
}

/**
 * Detects all points where orthogonal conveyor belts cross each other,
 * enabling elevated overpass bridge rendering ("belts can go over other belts").
 */
export function findConveyorCrossings(
  paths: { connId: string; pts: { x: number; y: number }[] }[]
): ConveyorCrossing[] {
  const crossings: ConveyorCrossing[] = [];
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      const pathA = paths[i];
      const pathB = paths[j];
      for (let a = 1; a < pathA.pts.length; a++) {
        const segA1 = pathA.pts[a - 1];
        const segA2 = pathA.pts[a];
        const isAH = Math.abs(segA1.y - segA2.y) < 1e-4;

        for (let b = 1; b < pathB.pts.length; b++) {
          const segB1 = pathB.pts[b - 1];
          const segB2 = pathB.pts[b];
          const isBH = Math.abs(segB1.y - segB2.y) < 1e-4;

          if (isAH === isBH) continue;

          const hSeg1 = isAH ? segA1 : segB1;
          const hSeg2 = isAH ? segA2 : segB2;
          const vSeg1 = isAH ? segB1 : segA1;
          const vSeg2 = isAH ? segB2 : segA2;

          const hMinX = Math.min(hSeg1.x, hSeg2.x);
          const hMaxX = Math.max(hSeg1.x, hSeg2.x);
          const vMinY = Math.min(vSeg1.y, vSeg2.y);
          const vMaxY = Math.max(vSeg1.y, vSeg2.y);

          const cx = vSeg1.x;
          const cy = hSeg1.y;

          if (cx > hMinX + 4 && cx < hMaxX - 4 && cy > vMinY + 4 && cy < vMaxY - 4) {
            crossings.push({
              x: cx,
              y: cy,
              overConnId: pathB.connId,
              underConnId: pathA.connId,
            });
          }
        }
      }
    }
  }
  return crossings;
}
