import { CameraState, MachineNode } from './types';

// Expanded Sector 01 Map Boundaries (12000x8000 regional sector with clustered deposits)
export const WORLD_WIDTH = 12000;
export const WORLD_HEIGHT = 8000;
export const MIN_ZOOM = 0.06;
export const MAX_ZOOM = 1.85;
// Require zooming out past 0.25x before switching to Macro Icon Box / Map Pin view
export const LOD_ICON_BOX_ZOOM_THRESHOLD = 0.25;
export const WORLD_PADDING = 24;

export function isMacroIconZoom(zoom: number): boolean {
  return zoom < LOD_ICON_BOX_ZOOM_THRESHOLD;
}

export function getPortOffsetY(index: number, total: number): number {
  if (total <= 1) return 96; // 4 * 24px grid units
  if (total === 2) return index === 0 ? 72 : 120; // 3 * 24px and 5 * 24px grid units
  return 72 + index * 24; // 72, 96, 120 (exact 24px grid pitch)
}

export function getPortWorldPosition(
  node: { x: number; y: number; width: number; height: number },
  side: 'input' | 'output',
  index: number,
  total: number
): { x: number; y: number } {
  const py = node.y + getPortOffsetY(index, total);
  const px = side === 'input' ? node.x : node.x + node.width;
  return { x: px, y: py };
}

export function computePolylineLength(pts: { x: number; y: number }[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return total;
}

/**
 * Checks whether two machine nodes overlap (AABB collision detection).
 */
export function doNodesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  padding = 0
): boolean {
  return !(
    a.x + a.width + padding <= b.x ||
    b.x + b.width + padding <= a.x ||
    a.y + a.height + padding <= b.y ||
    b.y + b.height + padding <= a.y
  );
}

/**
 * Validates whether a candidate node position is free of overlap with any existing nodes.
 */
export function isNodePositionValid(
  nodes: MachineNode[],
  candidate: { x: number; y: number; width: number; height: number; id?: string },
  padding = 0
): { valid: boolean; collidingNode?: MachineNode } {
  for (const node of nodes) {
    if (candidate.id && node.id === candidate.id) continue;
    if (doNodesOverlap(candidate, node, padding)) {
      return { valid: false, collidingNode: node };
    }
  }
  return { valid: true };
}

/**
 * Checks if an orthogonal line segment intersects a machine node bounding box.
 */
export function doesSegmentIntersectBox(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  box: { x: number; y: number; width: number; height: number },
  pad = 12
): boolean {
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);

  const bL = box.x - pad;
  const bR = box.x + box.width + pad;
  const bT = box.y - pad;
  const bB = box.y + box.height + pad;

  // Zero-length segment
  if (Math.abs(p1.x - p2.x) < 1e-4 && Math.abs(p1.y - p2.y) < 1e-4) {
    return false;
  }

  // Horizontal segment
  if (Math.abs(p1.y - p2.y) < 1e-4) {
    return p1.y >= bT && p1.y <= bB && maxX > bL + 1e-3 && minX < bR - 1e-3;
  }
  // Vertical segment
  if (Math.abs(p1.x - p2.x) < 1e-4) {
    return p1.x >= bL && p1.x <= bR && maxY > bT + 1e-3 && minY < bB - 1e-3;
  }
  return maxX > bL + 1e-3 && minX < bR - 1e-3 && maxY > bT + 1e-3 && minY < bB - 1e-3;
}

/**
 * Checks if any segment of an orthogonal conveyor path intersects a machine node.
 */
export function doesPathIntersectNode(
  path: { x: number; y: number }[],
  node: MachineNode,
  pad = 12
): boolean {
  for (let i = 1; i < path.length; i++) {
    if (doesSegmentIntersectBox(path[i - 1], path[i], node, pad)) {
      return true;
    }
  }
  return false;
}

/**
 * Simplifies a polyline by merging consecutive collinear segments and removing zero-length steps.
 */
export function simplifyPolyline(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  if (pts.length <= 2) return pts;
  const result: { x: number; y: number }[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const curr = pts[i];
    const prev = result[result.length - 1];
    // Skip duplicate point
    if (Math.abs(curr.x - prev.x) < 0.1 && Math.abs(curr.y - prev.y) < 0.1) {
      continue;
    }
    if (result.length >= 2) {
      const pPrev = result[result.length - 2];
      const isColinearH =
        Math.abs(pPrev.y - prev.y) < 0.1 && Math.abs(prev.y - curr.y) < 0.1;
      const isColinearV =
        Math.abs(pPrev.x - prev.x) < 0.1 && Math.abs(prev.x - curr.x) < 0.1;
      if (isColinearH || isColinearV) {
        result[result.length - 1] = curr;
        continue;
      }
    }
    result.push(curr);
  }
  return result;
}

/**
 * Computes a clean, shortest-path 90-degree orthogonal conveyor belt path between ports,
 * routing through the horizontal gap between vertically aligned nodes or tightly around
 * immediate obstacles without ever looping far away.
 */
export function computeOrthogonalConveyorPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obstacles: MachineNode[] = [],
  fromNode?: MachineNode,
  toNode?: MachineNode
): { x: number; y: number }[] {
  const CLEARANCE = 12;
  const STUB = 22;

  // Infer source and destination machines if not explicitly provided
  const srcNode =
    fromNode ??
    obstacles.find(
      (n) =>
        Math.abs(x1 - (n.x + n.width)) <= 8 &&
        y1 >= n.y - 10 &&
        y1 <= n.y + n.height + 10
    );
  const dstNode =
    toNode ??
    obstacles.find(
      (n) =>
        Math.abs(x2 - n.x) <= 8 &&
        y2 >= n.y - 10 &&
        y2 <= n.y + n.height + 10
    );

  // Third-party obstacles (excluding srcNode and dstNode) require full 12px clearance,
  // while srcNode and dstNode use 1px clearance so belts can route cleanly through narrow gaps when nodes are very close.
  const otherObstacles = obstacles.filter(
    (n) => n.id !== srcNode?.id && n.id !== dstNode?.id
  );
  const allObstacles: { x: number; y: number; width: number; height: number; id?: string }[] = [
    ...otherObstacles,
  ];
  if (srcNode) allObstacles.push(srcNode);
  if (dstNode) allObstacles.push(dstNode);

  const isInternalBlocked = (pA: { x: number; y: number }, pB: { x: number; y: number }) => {
    if (otherObstacles.some((obs) => doesSegmentIntersectBox(pA, pB, obs, CLEARANCE))) {
      return true;
    }
    if (srcNode && doesSegmentIntersectBox(pA, pB, srcNode, 1)) {
      return true;
    }
    if (dstNode && doesSegmentIntersectBox(pA, pB, dstNode, 1)) {
      return true;
    }
    return false;
  };

  const pStart = { x: x1, y: y1 };
  const pEnd = { x: x2, y: y2 };

  // Topology 1: Forward H-V-H routing whenever destination port is to the right of (or at) source port
  if (x2 >= x1) {
    const fStub = Math.min(STUB, Math.max(1, (x2 - x1) * 0.45));
    const fExit = { x: x1 + fStub, y: y1 };
    const fEnter = { x: x2 - fStub, y: y2 };

    if (Math.abs(y1 - y2) < 1e-4 && !isInternalBlocked(fExit, fEnter)) {
      return [pStart, pEnd];
    }

    const defaultMidX = (x1 + x2) * 0.5;
    const candidateMidXs: number[] = [defaultMidX, fExit.x, fEnter.x];

    for (const obs of otherObstacles) {
      if (obs.x + obs.width >= fExit.x && obs.x <= fEnter.x) {
        const leftX = obs.x - CLEARANCE - 6;
        const rightX = obs.x + obs.width + CLEARANCE + 6;
        if (leftX >= fExit.x && leftX <= fEnter.x) candidateMidXs.push(leftX);
        if (rightX >= fExit.x && rightX <= fEnter.x) candidateMidXs.push(rightX);
      }
    }

    // Sort by closeness to symmetric midpoint
    candidateMidXs.sort((a, b) => Math.abs(a - defaultMidX) - Math.abs(b - defaultMidX));

    for (const midX of candidateMidXs) {
      const pB = { x: midX, y: y1 };
      const pC = { x: midX, y: y2 };
      if (
        !isInternalBlocked(fExit, pB) &&
        !isInternalBlocked(pB, pC) &&
        !isInternalBlocked(pC, fEnter)
      ) {
        return simplifyPolyline([pStart, fExit, pB, pC, fEnter, pEnd]);
      }
    }
  }

  const pExit = { x: x1 + STUB, y: y1 };
  const pEnter = { x: x2 - STUB, y: y2 };

  // Topology 2: H-V-H-V-H routing (for vertically aligned nodes, backward connections, or blocked forward corridors)
  const exitXs: number[] = [pExit.x];
  if (dstNode && dstNode.x + dstNode.width + STUB > pExit.x) {
    exitXs.push(dstNode.x + dstNode.width + STUB);
  }

  const enterXs: number[] = [pEnter.x];
  if (srcNode && srcNode.x - STUB < pEnter.x) {
    enterXs.push(srcNode.x - STUB);
  }

  const candidateMidYs: number[] = [(y1 + y2) * 0.5];

  // If srcNode and dstNode have a vertical gap between them, prioritize the exact center of that gap!
  if (srcNode && dstNode) {
    if (srcNode.y > dstNode.y + dstNode.height) {
      candidateMidYs.unshift(((dstNode.y + dstNode.height) + srcNode.y) * 0.5);
    } else if (dstNode.y > srcNode.y + srcNode.height) {
      candidateMidYs.unshift(((srcNode.y + srcNode.height) + dstNode.y) * 0.5);
    }
  }

  const margin = CLEARANCE + 8; // 20px outside node top/bottom edge
  if (srcNode) {
    candidateMidYs.push(srcNode.y - margin, srcNode.y + srcNode.height + margin);
  }
  if (dstNode) {
    candidateMidYs.push(dstNode.y - margin, dstNode.y + dstNode.height + margin);
  }
  if (srcNode && dstNode) {
    candidateMidYs.push(
      Math.min(srcNode.y, dstNode.y) - margin,
      Math.max(srcNode.y + srcNode.height, dstNode.y + dstNode.height) + margin
    );
  } else {
    candidateMidYs.push(Math.min(y1, y2) - 40, Math.max(y1, y2) + 40);
  }

  // Include tight bypasses around any nearby obstacles that actually lie in the local bounding box
  const localMinX = Math.min(...exitXs, ...enterXs) - 40;
  const localMaxX = Math.max(...exitXs, ...enterXs) + 40;
  const localMinY = Math.min(y1, y2) - 220;
  const localMaxY = Math.max(y1, y2) + 220;

  for (const obs of allObstacles) {
    if (
      obs.x + obs.width >= localMinX &&
      obs.x <= localMaxX &&
      obs.y + obs.height >= localMinY &&
      obs.y <= localMaxY
    ) {
      candidateMidYs.push(obs.y - margin, obs.y + obs.height + margin);
    }
  }

  let bestPath: { x: number; y: number }[] | null = null;
  let bestLen = Infinity;

  for (const exX of exitXs) {
    for (const enX of enterXs) {
      for (const midY of candidateMidYs) {
        const p1Stub = { x: exX, y: y1 };
        const p2Turn = { x: exX, y: midY };
        const p3Turn = { x: enX, y: midY };
        const p4Stub = { x: enX, y: y2 };

        if (
          !isInternalBlocked(pExit, p1Stub) &&
          !isInternalBlocked(p1Stub, p2Turn) &&
          !isInternalBlocked(p2Turn, p3Turn) &&
          !isInternalBlocked(p3Turn, p4Stub) &&
          !isInternalBlocked(p4Stub, pEnter)
        ) {
          const cand = simplifyPolyline([pStart, p1Stub, p2Turn, p3Turn, p4Stub, pEnd]);
          const len = computePolylineLength(cand);
          if (len < bestLen) {
            bestLen = len;
            bestPath = cand;
          }
        }
      }
    }
  }

  if (bestPath) {
    return bestPath;
  }

  // Fallback tight local loop around the two ports (never goes far off-screen)
  const fallbackY =
    srcNode && dstNode
      ? Math.min(srcNode.y, dstNode.y) - margin
      : Math.min(y1, y2) - 40;
  return simplifyPolyline([
    pStart,
    pExit,
    { x: pExit.x, y: fallbackY },
    { x: pEnter.x, y: fallbackY },
    pEnter,
    pEnd,
  ]);
}

export interface CachedConveyorRoute {
  pts: { x: number; y: number }[];
  polyLen: number;
  lengthPx: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

let cachedGeometrySignature = '';
const cachedRoutesByEndpoints = new Map<string, CachedConveyorRoute>();

/**
 * Computes a fast geometry revision string from all active node bounding boxes.
 * When no buildings move or change count/dimensions, belt routes are served from cache in O(1).
 */
export function computeNodesGeometrySignature(nodes: MachineNode[]): string {
  let sig = `${nodes.length}:`;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    sig += `${n.id}@${n.x},${n.y},${n.width},${n.height};`;
  }
  return sig;
}

export function getCachedConveyorRoute(
  fromNode: MachineNode,
  outIdx: number,
  toNode: MachineNode,
  inIdx: number,
  obstacles: MachineNode[] = []
): CachedConveyorRoute {
  const safeOutIdx = Math.max(0, outIdx);
  const safeInIdx = Math.max(0, inIdx);
  const sig = computeNodesGeometrySignature(obstacles);
  if (sig !== cachedGeometrySignature) {
    cachedGeometrySignature = sig;
    cachedRoutesByEndpoints.clear();
  }

  const endpointKey = `${fromNode.id}:${safeOutIdx}:${fromNode.x},${fromNode.y}->${toNode.id}:${safeInIdx}:${toNode.x},${toNode.y}`;
  const existing = cachedRoutesByEndpoints.get(endpointKey);
  if (existing) {
    return existing;
  }

  const p1 = getPortWorldPosition(fromNode, 'output', safeOutIdx, fromNode.outputs.length);
  const p2 = getPortWorldPosition(toNode, 'input', safeInIdx, toNode.inputs.length);
  const pts = computeOrthogonalConveyorPath(p1.x, p1.y, p2.x, p2.y, obstacles, fromNode, toNode);
  const polyLen = Math.max(36, computePolylineLength(pts));
  const lengthPx = Math.max(36, Math.round(polyLen));

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const pt = pts[i];
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  const route: CachedConveyorRoute = {
    pts,
    polyLen,
    lengthPx,
    minX,
    maxX,
    minY,
    maxY,
  };
  cachedRoutesByEndpoints.set(endpointKey, route);
  return route;
}

export function computeConveyorLengthPx(
  fromNode: MachineNode,
  outIdx: number,
  toNode: MachineNode,
  inIdx: number,
  obstacles: MachineNode[] = []
): number {
  return getCachedConveyorRoute(fromNode, outIdx, toNode, inIdx, obstacles).lengthPx;
}

/**
 * Samples a continuous progress t [0..1] along an orthogonal polyline.
 * Returns the exact (x, y) world coordinates and direction angle.
 */
export function sampleOrthogonalPath(
  pts: { x: number; y: number }[],
  t: number
): { x: number; y: number; angle: number } {
  if (pts.length === 0) return { x: 0, y: 0, angle: 0 };
  if (pts.length === 1) return { x: pts[0].x, y: pts[0].y, angle: 0 };
  const segLens: number[] = [];
  let totalLen = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    segLens.push(len);
    totalLen += len;
  }
  if (totalLen <= 0) return { x: pts[0].x, y: pts[0].y, angle: 0 };
  const targetDist = Math.max(0, Math.min(totalLen, t * totalLen));
  let acc = 0;
  for (let i = 0; i < segLens.length; i++) {
    const len = segLens[i];
    if (acc + len >= targetDist || i === segLens.length - 1) {
      const segT = len > 0 ? (targetDist - acc) / len : 0;
      const p1 = pts[i];
      const p2 = pts[i + 1];
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

export interface ConveyorCrossing {
  x: number;
  y: number;
  overConnId: string;
  underConnId: string;
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

export function snapToGrid(value: number, gridSize: number, enabled: boolean): number {
  if (!enabled || gridSize <= 0) return Math.round(value);
  return Math.round(value / gridSize) * gridSize;
}

export function clampNodeToWorld(
  x: number,
  y: number,
  width: number,
  height: number,
  worldWidth = WORLD_WIDTH,
  worldHeight = WORLD_HEIGHT
): { x: number; y: number } {
  const minX = WORLD_PADDING;
  const minY = WORLD_PADDING;
  const maxX = Math.max(minX, worldWidth - width - WORLD_PADDING);
  const maxY = Math.max(minY, worldHeight - height - WORLD_PADDING);
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
}

export function clampCameraToWorld(
  cam: CameraState,
  viewportWidth: number,
  viewportHeight: number,
  worldWidth = WORLD_WIDTH,
  worldHeight = WORLD_HEIGHT
): CameraState {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom));
  const marginX = Math.min(280, viewportWidth * 0.25);
  const marginY = Math.min(200, viewportHeight * 0.25);

  const scaledWorldW = worldWidth * zoom;
  const scaledWorldH = worldHeight * zoom;

  let minX: number;
  let maxX: number;
  if (scaledWorldW + marginX * 2 <= viewportWidth) {
    minX = (viewportWidth - scaledWorldW) / 2;
    maxX = minX;
  } else {
    minX = viewportWidth - scaledWorldW - marginX;
    maxX = marginX;
  }

  let minY: number;
  let maxY: number;
  if (scaledWorldH + marginY * 2 <= viewportHeight) {
    minY = (viewportHeight - scaledWorldH) / 2;
    maxY = minY;
  } else {
    minY = viewportHeight - scaledWorldH - marginY;
    maxY = marginY;
  }

  return {
    x: Math.min(maxX, Math.max(minX, cam.x)),
    y: Math.min(maxY, Math.max(minY, cam.y)),
    zoom,
  };
}
