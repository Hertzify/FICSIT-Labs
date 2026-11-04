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
 * Computes the shortest Euclidean distance from a point (px, py) to a line segment (x1, y1)-(x2, y2).
 */
export function distanceFromPointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-8) {
    return Math.hypot(px - x1, py - y1);
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Computes the shortest Euclidean distance from a point (px, py) to a multi-segment polyline.
 */
export function distanceFromPointToPolyline(
  px: number,
  py: number,
  pts: { x: number; y: number }[]
): number {
  if (pts.length === 0) return Infinity;
  if (pts.length === 1) return Math.hypot(px - pts[0].x, py - pts[0].y);
  let minDist = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const d = distanceFromPointToSegment(
      px,
      py,
      pts[i - 1].x,
      pts[i - 1].y,
      pts[i].x,
      pts[i].y
    );
    if (d < minDist) {
      minDist = d;
    }
  }
  return minDist;
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
 * In Satisfactory, a Miner Mk.1 mounts directly and concentrically on top of a Resource Deposit (1:1 footprint).
 * It cannot slide off-center or hover partially on bare terrain.
 */
export function isMinerDirectlyOnDeposit(
  miner: { x: number; y: number; width: number; height: number },
  deposit: { x: number; y: number; width: number; height: number },
  tolerancePx = 4
): boolean {
  const expectedX = deposit.x + Math.round((deposit.width - miner.width) * 0.5);
  const expectedY = deposit.y + Math.round((deposit.height - miner.height) * 0.5);
  return (
    Math.abs(miner.x - expectedX) <= tolerancePx &&
    Math.abs(miner.y - expectedY) <= tolerancePx
  );
}

/**
 * Validates whether a candidate node position is free of overlap with any existing nodes.
 */
export function isNodePositionValid(
  nodes: MachineNode[],
  candidate: { x: number; y: number; width: number; height: number; id?: string; buildingId?: string },
  padding = 0
): { valid: boolean; collidingNode?: MachineNode; reason?: string } {
  const hasWorldDeposits = nodes.some((n) => n.buildingId === 'resource_deposit');

  // Rule 1: In Satisfactory, a Miner Mk.1 MUST be positioned directly on top of an unoccupied Resource Deposit!
  if (candidate.buildingId === 'miner_mk1' && hasWorldDeposits) {
    const directDeposit = nodes.find(
      (n) => n.buildingId === 'resource_deposit' && isMinerDirectlyOnDeposit(candidate, n, 4)
    );
    if (!directDeposit) {
      return { valid: false, reason: 'not_directly_on_deposit' };
    }

    // A deposit should only hold 1 miner!
    const hasOtherMiner = nodes.some(
      (other) =>
        other.buildingId === 'miner_mk1' &&
        other.id !== candidate.id &&
        isMinerDirectlyOnDeposit(other, directDeposit, 16)
    );
    if (hasOtherMiner) {
      return { valid: false, collidingNode: directDeposit, reason: 'deposit_already_occupied' };
    }
  }

  for (const node of nodes) {
    if (candidate.id && node.id === candidate.id) continue;
    if (doNodesOverlap(candidate, node, padding)) {
      // In Satisfactory, Miners are built directly ON TOP of natural Resource Deposits!
      const isMinerOnDeposit =
        (candidate.buildingId === 'miner_mk1' && node.buildingId === 'resource_deposit') ||
        (candidate.buildingId === 'resource_deposit' && node.buildingId === 'miner_mk1');

      if (isMinerOnDeposit) {
        const depositNode = candidate.buildingId === 'resource_deposit' ? candidate : node;
        const minerNode = candidate.buildingId === 'miner_mk1' ? candidate : node;

        // Verify the miner is directly on top of the deposit (not offset)
        if (!isMinerDirectlyOnDeposit(minerNode, depositNode, 4)) {
          return { valid: false, collidingNode: node, reason: 'miner_not_centered_on_deposit' };
        }

        // Verify that NO other miner is already placed on this deposit (only 1 miner per deposit)
        const hasOtherMiner = nodes.some(
          (n) =>
            n.buildingId === 'miner_mk1' &&
            n.id !== minerNode.id &&
            isMinerDirectlyOnDeposit(n, depositNode, 16)
        );
        if (!hasOtherMiner) {
          // Valid placement: exactly 1 miner mounts directly on the resource deposit!
          continue;
        }
      }

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

  // Infer source and destination machines if not explicitly provided.
  // Prefer actual factory buildings/miners over ground resource deposits.
  const srcNode =
    fromNode ??
    obstacles.find(
      (n) =>
        n.buildingId !== 'resource_deposit' &&
        Math.abs(x1 - (n.x + n.width)) <= 8 &&
        y1 >= n.y - 10 &&
        y1 <= n.y + n.height + 10
    ) ??
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
        n.buildingId !== 'resource_deposit' &&
        Math.abs(x2 - n.x) <= 8 &&
        y2 >= n.y - 10 &&
        y2 <= n.y + n.height + 10
    ) ??
    obstacles.find(
      (n) =>
        Math.abs(x2 - n.x) <= 8 &&
        y2 >= n.y - 10 &&
        y2 <= n.y + n.height + 10
    );

  // When a Miner Mk.1 is built directly on a Resource Deposit, that underlying deposit hosts the miner.
  // We exempt the host deposit from being an external obstacle (treating it with 1px clearance like the miner),
  // while ALL OTHER natural resource deposits are physical obstacles with standard clearance (12px),
  // so belts route cleanly around resource deposits instead of passing underneath them.
  const srcDeposit =
    srcNode?.buildingId === 'miner_mk1'
      ? obstacles.find(
          (n) => n.buildingId === 'resource_deposit' && isMinerDirectlyOnDeposit(srcNode, n, 8)
        )
      : srcNode?.buildingId === 'resource_deposit'
      ? srcNode
      : undefined;

  const dstDeposit =
    dstNode?.buildingId === 'miner_mk1'
      ? obstacles.find(
          (n) => n.buildingId === 'resource_deposit' && isMinerDirectlyOnDeposit(dstNode, n, 8)
        )
      : dstNode?.buildingId === 'resource_deposit'
      ? dstNode
      : undefined;

  const ignoredObstacleIds = new Set<string>();
  if (srcNode) ignoredObstacleIds.add(srcNode.id);
  if (dstNode) ignoredObstacleIds.add(dstNode.id);
  if (srcDeposit) ignoredObstacleIds.add(srcDeposit.id);
  if (dstDeposit) ignoredObstacleIds.add(dstDeposit.id);

  // Third-party obstacles (including other resource deposits) require full 12px clearance,
  // while srcNode and dstNode (and their hosting deposit) use 1px clearance so belts can exit cleanly.
  // Spatially filter to local corridor around the two ports to avoid scanning distant world deposits.
  const cullMinX = Math.min(x1, x2) - 480;
  const cullMaxX = Math.max(x1, x2) + 480;
  const cullMinY = Math.min(y1, y2) - 480;
  const cullMaxY = Math.max(y1, y2) + 480;
  const otherObstacles = obstacles.filter(
    (n) =>
      !ignoredObstacleIds.has(n.id) &&
      n.x + n.width >= cullMinX &&
      n.x <= cullMaxX &&
      n.y + n.height >= cullMinY &&
      n.y <= cullMaxY
  );
  const allObstacles: { x: number; y: number; width: number; height: number; id?: string }[] = [
    ...otherObstacles,
  ];
  if (srcNode) allObstacles.push(srcNode);
  if (dstNode) allObstacles.push(dstNode);
  if (srcDeposit && !allObstacles.some((o) => o.id === srcDeposit.id)) allObstacles.push(srcDeposit);
  if (dstDeposit && !allObstacles.some((o) => o.id === dstDeposit.id)) allObstacles.push(dstDeposit);

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
    if (srcDeposit && doesSegmentIntersectBox(pA, pB, srcDeposit, 1)) {
      return true;
    }
    if (dstDeposit && doesSegmentIntersectBox(pA, pB, dstDeposit, 1)) {
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

  // Include candidate exit and enter X positions around nearby obstacles that overlap the stub lines
  const minStubX = Math.min(x1, x2) - 60;
  const maxStubX = Math.max(x1, x2) + 60;
  for (const obs of otherObstacles) {
    if (obs.x + obs.width >= minStubX && obs.x <= maxStubX) {
      const leftX = obs.x - CLEARANCE - 6;
      const rightX = obs.x + obs.width + CLEARANCE + 6;
      if (leftX > x1 + 2) exitXs.push(leftX);
      if (rightX > x1 + 2) exitXs.push(rightX);
      if (rightX < x2 - 2) enterXs.push(rightX);
      if (leftX < x2 - 2) enterXs.push(leftX);
    }
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

export interface CachedConveyorRoute {
  pts: { x: number; y: number }[];
  polyLen: number;
  lengthPx: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  filletedPath?: FilletedConveyorPath;
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

/**
 * Clears all cached conveyor routes and geometry signatures.
 */
export function invalidateAllConveyorCaches(): void {
  cachedGeometrySignature = '';
  cachedRoutesByEndpoints.clear();
}

export function simplifyPolylinePreservingWaypoints(
  pts: { x: number; y: number }[],
  protectedPoints: { x: number; y: number }[] = []
): { x: number; y: number }[] {
  if (pts.length <= 2) return pts;
  const isProtected = (pt: { x: number; y: number }) =>
    protectedPoints.some(
      (p) => Math.abs(p.x - pt.x) < 0.5 && Math.abs(p.y - pt.y) < 0.5
    );

  // Pass 1: Remove duplicate points and merge same-direction collinear segments (preserving protected corner points unless they form a 180-degree spike)
  const result: { x: number; y: number }[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const curr = pts[i];
    const prev = result[result.length - 1];
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
        const isReversalH =
          isColinearH && (prev.x - pPrev.x) * (curr.x - prev.x) < -1e-3;
        const isReversalV =
          isColinearV && (prev.y - pPrev.y) * (curr.y - prev.y) < -1e-3;
        // Always collapse 180-degree spikes or non-protected collinear points
        if (isReversalH || isReversalV || !isProtected(prev)) {
          result[result.length - 1] = curr;
          if (
            result.length >= 2 &&
            Math.abs(result[result.length - 1].x - result[result.length - 2].x) < 0.1 &&
            Math.abs(result[result.length - 1].y - result[result.length - 2].y) < 0.1
          ) {
            result.pop();
          }
          continue;
        }
      }
    }
    result.push(curr);
  }
  return result;
}

/**
 * Returns the effective visual & physical bounding box of a node, accounting for
 * planetary resource deposit rock rims (+12px) and bottom survey pedestal tabs (+22px).
 */
export function getEffectiveObstacleBox(obs: MachineNode): {
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
} {
  if (obs.buildingId === 'resource_deposit') {
    const rimPad = 10;
    const bottomTabPad = 22;
    return {
      id: obs.id,
      x: obs.x - rimPad,
      y: obs.y - rimPad,
      width: obs.width + rimPad * 2,
      height: obs.height + rimPad + bottomTabPad,
    };
  }
  return {
    id: obs.id,
    x: obs.x,
    y: obs.y,
    width: obs.width,
    height: obs.height,
  };
}

/**
 * Checks whether a world coordinate point (x, y) lies inside any obstacle node (with clearance padding).
 */
export function isPointInsideObstacle(
  x: number,
  y: number,
  obstacles: MachineNode[],
  pad = 12,
  ignoreNodeIds?: Set<string>
): boolean {
  for (const obs of obstacles) {
    if (ignoreNodeIds && ignoreNodeIds.has(obs.id)) continue;
    const box = getEffectiveObstacleBox(obs);
    if (
      x >= box.x - pad &&
      x <= box.x + box.width + pad &&
      y >= box.y - pad &&
      y <= box.y + box.height + pad
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Computes an orthogonal conveyor path that routes sequentially through user-defined waypoints.
 * Every waypoint is guaranteed to be a 90-degree corner (perpendicular incoming and outgoing segments),
 * with zero 180-degree spikes, and every segment routes cleanly around buildings and resource deposits.
 */
export function computeConveyorPathWithWaypoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obstaclesOrWaypoints: MachineNode[] | { x: number; y: number }[] = [],
  fromNode?: MachineNode,
  toNode?: MachineNode,
  explicitWaypoints: { x: number; y: number }[] = []
): { x: number; y: number }[] {
  let obstacles: MachineNode[] = [];
  let waypoints: { x: number; y: number }[] = [];

  if (Array.isArray(obstaclesOrWaypoints)) {
    if (
      obstaclesOrWaypoints.length > 0 &&
      'x' in obstaclesOrWaypoints[0] &&
      !('buildingId' in obstaclesOrWaypoints[0])
    ) {
      waypoints = obstaclesOrWaypoints as { x: number; y: number }[];
    } else {
      obstacles = obstaclesOrWaypoints as MachineNode[];
    }
  }
  if (explicitWaypoints && explicitWaypoints.length > 0) {
    waypoints = explicitWaypoints;
  }

  if (!waypoints || waypoints.length === 0) {
    return computeOrthogonalConveyorPath(x1, y1, x2, y2, obstacles, fromNode, toNode);
  }

  const CLEARANCE = 12;

  const srcNode =
    fromNode ??
    obstacles.find(
      (n) =>
        n.buildingId !== 'resource_deposit' &&
        Math.abs(x1 - (n.x + n.width)) <= 8 &&
        y1 >= n.y - 10 &&
        y1 <= n.y + n.height + 10
    ) ??
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
        n.buildingId !== 'resource_deposit' &&
        Math.abs(x2 - n.x) <= 8 &&
        y2 >= n.y - 10 &&
        y2 <= n.y + n.height + 10
    ) ??
    obstacles.find(
      (n) =>
        Math.abs(x2 - n.x) <= 8 &&
        y2 >= n.y - 10 &&
        y2 <= n.y + n.height + 10
    );

  const srcDeposit =
    srcNode?.buildingId === 'miner_mk1'
      ? obstacles.find(
          (n) => n.buildingId === 'resource_deposit' && isMinerDirectlyOnDeposit(srcNode, n, 8)
        )
      : srcNode?.buildingId === 'resource_deposit'
      ? srcNode
      : undefined;

  const dstDeposit =
    dstNode?.buildingId === 'miner_mk1'
      ? obstacles.find(
          (n) => n.buildingId === 'resource_deposit' && isMinerDirectlyOnDeposit(dstNode, n, 8)
        )
      : dstNode?.buildingId === 'resource_deposit'
      ? dstNode
      : undefined;

  const ignoredObstacleIds = new Set<string>();
  if (srcNode) ignoredObstacleIds.add(srcNode.id);
  if (dstNode) ignoredObstacleIds.add(dstNode.id);
  if (srcDeposit) ignoredObstacleIds.add(srcDeposit.id);
  if (dstDeposit) ignoredObstacleIds.add(dstDeposit.id);

  let routeMinX = Math.min(x1, x2);
  let routeMaxX = Math.max(x1, x2);
  let routeMinY = Math.min(y1, y2);
  let routeMaxY = Math.max(y1, y2);
  for (const wp of waypoints) {
    if (wp.x < routeMinX) routeMinX = wp.x;
    if (wp.x > routeMaxX) routeMaxX = wp.x;
    if (wp.y < routeMinY) routeMinY = wp.y;
    if (wp.y > routeMaxY) routeMaxY = wp.y;
  }
  routeMinX -= 480;
  routeMaxX += 480;
  routeMinY -= 480;
  routeMaxY += 480;

  const otherObstacles = obstacles.filter(
    (n) =>
      !ignoredObstacleIds.has(n.id) &&
      n.x + n.width >= routeMinX &&
      n.x <= routeMaxX &&
      n.y + n.height >= routeMinY &&
      n.y <= routeMaxY
  );
  const rawAllObstacles: MachineNode[] = [...otherObstacles];
  if (srcNode) rawAllObstacles.push(srcNode);
  if (dstNode) rawAllObstacles.push(dstNode);
  if (srcDeposit && !rawAllObstacles.some((o) => o.id === srcDeposit.id)) {
    rawAllObstacles.push(srcDeposit);
  }
  if (dstDeposit && !rawAllObstacles.some((o) => o.id === dstDeposit.id)) {
    rawAllObstacles.push(dstDeposit);
  }

  const allObstacleBoxes = rawAllObstacles.map((obs) => ({
    ...getEffectiveObstacleBox(obs),
    isEndpoint: ignoredObstacleIds.has(obs.id),
  }));

  // Compute startStubX and endStubX so they clear the source/destination buildings AND any mounted deposit rim
  const srcRightEdge = Math.max(
    x1,
    srcNode ? srcNode.x + srcNode.width : x1,
    srcDeposit ? getEffectiveObstacleBox(srcDeposit).x + getEffectiveObstacleBox(srcDeposit).width : x1
  );
  const dstLeftEdge = Math.min(
    x2,
    dstNode ? dstNode.x : x2,
    dstDeposit ? getEffectiveObstacleBox(dstDeposit).x : x2
  );

  const startStubX = Math.max(x1 + 22, srcRightEdge + 14);
  const endStubX = Math.min(x2 - 22, dstLeftEdge - 14);

  // Every segment between startStub and endStub must stay completely outside ALL buildings and deposits!
  const isSegBlocked = (pA: { x: number; y: number }, pB: { x: number; y: number }) => {
    for (const box of allObstacleBoxes) {
      const pad = box.isEndpoint ? 10 : CLEARANCE;
      if (doesSegmentIntersectBox(pA, pB, box, pad)) {
        return true;
      }
    }
    return false;
  };

  const isChainClear = (chain: { x: number; y: number }[]) => {
    for (let i = 1; i < chain.length; i++) {
      if (isSegBlocked(chain[i - 1], chain[i])) return false;
    }
    return true;
  };

  // Push any waypoint that falls inside an obstacle box out to the nearest clear boundary
  const safeWaypoints = waypoints.map((rawWp) => {
    let wx = rawWp.x;
    let wy = rawWp.y;
    for (let pass = 0; pass < 2; pass++) {
      for (const box of allObstacleBoxes) {
        const pad = box.isEndpoint ? 14 : CLEARANCE + 4;
        const bL = box.x - pad;
        const bR = box.x + box.width + pad;
        const bT = box.y - pad;
        const bB = box.y + box.height + pad;
        if (wx > bL && wx < bR && wy > bT && wy < bB) {
          const dL = Math.abs(wx - bL);
          const dR = Math.abs(bR - wx);
          const dT = Math.abs(wy - bT);
          const dB = Math.abs(bB - wy);
          const minD = Math.min(dL, dR, dT, dB);
          if (minD === dT) wy = bT;
          else if (minD === dB) wy = bB;
          else if (minD === dL) wx = bL;
          else wx = bR;
        }
      }
    }
    return { x: wx, y: wy };
  });

  // Precompute global candidate X and Y routing corridors around all obstacles and gap midpoints
  const baseMargin = CLEARANCE + 8;
  const globalCandidateXs: number[] = [startStubX, endStubX];
  const globalCandidateYs: number[] = [y1, y2];

  for (const box of allObstacleBoxes) {
    const m = box.isEndpoint ? 16 : baseMargin;
    globalCandidateXs.push(box.x - m, box.x + box.width + m);
    globalCandidateYs.push(box.y - m, box.y + box.height + m);
  }

  // Include pairwise gap midpoints between nearby obstacles so belts can thread cleanly between Miner & Smelter
  for (let i = 0; i < allObstacleBoxes.length; i++) {
    for (let j = i + 1; j < allObstacleBoxes.length; j++) {
      const a = allObstacleBoxes[i];
      const b = allObstacleBoxes[j];
      if (a.y + a.height < b.y && b.y - (a.y + a.height) >= 22) {
        globalCandidateYs.push((a.y + a.height + b.y) * 0.5);
      } else if (b.y + b.height < a.y && a.y - (b.y + b.height) >= 22) {
        globalCandidateYs.push((b.y + b.height + a.y) * 0.5);
      }
      if (a.x + a.width < b.x && b.x - (a.x + a.width) >= 22) {
        globalCandidateXs.push((a.x + a.width + b.x) * 0.5);
      } else if (b.x + b.width < a.x && a.x - (b.x + b.width) >= 22) {
        globalCandidateXs.push((b.x + b.width + a.x) * 0.5);
      }
    }
  }

  interface BridgeResult {
    pts: { x: number; y: number }[];
    startDir: 'H' | 'V';
    endDir: 'H' | 'V';
    len: number;
    blocked: boolean;
  }

  const evaluateCandidateLeg = (
    rawPts: { x: number; y: number }[],
    reqStartDir?: 'H' | 'V',
    reqEndDir?: 'H' | 'V',
    forbidStartLeft?: boolean,
    forbidEndRight?: boolean
  ): BridgeResult | null => {
    // 1. Strip zero-length steps and merge same-direction collinear segments, rejecting any 180° reversals
    const cleaned: { x: number; y: number }[] = [rawPts[0]];
    for (let i = 1; i < rawPts.length; i++) {
      const curr = rawPts[i];
      const prev = cleaned[cleaned.length - 1];
      if (Math.abs(curr.x - prev.x) < 0.5 && Math.abs(curr.y - prev.y) < 0.5) {
        continue;
      }
      if (cleaned.length >= 2) {
        const pPrev = cleaned[cleaned.length - 2];
        const isH1 = Math.abs(prev.y - pPrev.y) < 0.5;
        const isH2 = Math.abs(curr.y - prev.y) < 0.5;
        const isV1 = Math.abs(prev.x - pPrev.x) < 0.5;
        const isV2 = Math.abs(curr.x - prev.x) < 0.5;
        if (isH1 && isH2) {
          const dx1 = prev.x - pPrev.x;
          const dx2 = curr.x - prev.x;
          if (dx1 * dx2 < 0) return null; // Reject 180-degree horizontal reversal spike!
          cleaned[cleaned.length - 1] = curr;
          continue;
        }
        if (isV1 && isV2) {
          const dy1 = prev.y - pPrev.y;
          const dy2 = curr.y - prev.y;
          if (dy1 * dy2 < 0) return null; // Reject 180-degree vertical reversal spike!
          cleaned[cleaned.length - 1] = curr;
          continue;
        }
      }
      cleaned.push(curr);
    }

    if (cleaned.length < 2) return null;

    const firstDx = cleaned[1].x - cleaned[0].x;
    const firstDy = cleaned[1].y - cleaned[0].y;
    const firstLen = Math.hypot(firstDx, firstDy);
    const startDir: 'H' | 'V' = Math.abs(firstDx) >= Math.abs(firstDy) ? 'H' : 'V';

    const n = cleaned.length;
    const lastDx = cleaned[n - 1].x - cleaned[n - 2].x;
    const lastDy = cleaned[n - 1].y - cleaned[n - 2].y;
    const lastLen = Math.hypot(lastDx, lastDy);
    const endDir: 'H' | 'V' = Math.abs(lastDx) >= Math.abs(lastDy) ? 'H' : 'V';

    if (reqStartDir && startDir !== reqStartDir) return null;
    if (reqEndDir && endDir !== reqEndDir) return null;

    // Prevent tiny invisible kinks at corners
    if (reqStartDir && firstLen < 12) return null;
    if (reqEndDir && lastLen < 12) return null;

    // Never reverse 180° back into the start port exit stub or end port entry stub
    if (forbidStartLeft && startDir === 'H' && firstDx < -0.5) return null;
    if (forbidEndRight && endDir === 'H' && lastDx < -0.5) return null;

    const blocked = !isChainClear(cleaned);
    const len = computePolylineLength(cleaned) + cleaned.length * 4;
    return { pts: cleaned, startDir, endDir, len, blocked };
  };

  // Finds the shortest obstacle-free orthogonal bridge from (ax, ay) to (bx, by) matching reqStartDir and reqEndDir
  const findCleanOrthogonalBridge = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    reqStartDir?: 'H' | 'V',
    reqEndDir?: 'H' | 'V',
    forbidStartLeft?: boolean,
    forbidEndRight?: boolean
  ): BridgeResult | null => {
    const pA = { x: ax, y: ay };
    const pB = { x: bx, y: by };

    const candidateXs = Array.from(
      new Set([
        (ax + bx) * 0.5,
        ax,
        bx,
        ax - 32,
        ax + 32,
        bx - 32,
        bx + 32,
        ...globalCandidateXs,
      ])
    );
    const candidateYs = Array.from(
      new Set([
        (ay + by) * 0.5,
        ay,
        by,
        ay - 32,
        ay + 32,
        by - 32,
        by + 32,
        ...globalCandidateYs,
      ])
    );

    let bestClear: BridgeResult | null = null;
    let bestFallback: BridgeResult | null = null;

    const consider = (rawPts: { x: number; y: number }[]) => {
      const res = evaluateCandidateLeg(
        rawPts,
        reqStartDir,
        reqEndDir,
        forbidStartLeft,
        forbidEndRight
      );
      if (!res) return;
      if (!res.blocked) {
        if (!bestClear || res.len < bestClear.len) {
          bestClear = res;
        }
      } else {
        if (!bestFallback || res.len < bestFallback.len) {
          bestFallback = res;
        }
      }
    };

    // 1. Direct straight line (if aligned) and 2-segment L-bends
    if (Math.abs(ax - bx) < 0.5 || Math.abs(ay - by) < 0.5) {
      consider([pA, pB]);
    }
    consider([pA, { x: bx, y: ay }, pB]);
    consider([pA, { x: ax, y: by }, pB]);

    if (bestClear) return bestClear;

    // 2. 3-segment Z/U-bends (H-V-H and V-H-V)
    for (const midX of candidateXs) {
      consider([pA, { x: midX, y: ay }, { x: midX, y: by }, pB]);
    }
    for (const midY of candidateYs) {
      consider([pA, { x: ax, y: midY }, { x: bx, y: midY }, pB]);
    }

    if (bestClear) return bestClear;

    // 3. 4-segment obstacle bypasses (H-V-H-V and V-H-V-H)
    for (const midX of candidateXs) {
      for (const midY of candidateYs) {
        consider([pA, { x: midX, y: ay }, { x: midX, y: midY }, { x: bx, y: midY }, pB]);
        consider([pA, { x: ax, y: midY }, { x: midX, y: midY }, { x: midX, y: by }, pB]);
      }
    }

    if (bestClear) return bestClear;

    // 4. 5-segment obstacle-wrap bypasses (V-H-V-H-V and H-V-H-V-H) when both endpoints require same axis across an obstacle
    const stepYs = [ay - 28, ay + 28, ...globalCandidateYs];
    const endYs = [by - 28, by + 28, ...globalCandidateYs];
    for (const yA of stepYs) {
      for (const midX of candidateXs) {
        for (const yB of endYs) {
          consider([
            pA,
            { x: ax, y: yA },
            { x: midX, y: yA },
            { x: midX, y: yB },
            { x: bx, y: yB },
            pB,
          ]);
        }
      }
    }

    const stepXs = [ax - 28, ax + 28, ...globalCandidateXs];
    const endXs = [bx - 28, bx + 28, ...globalCandidateXs];
    for (const xA of stepXs) {
      for (const midY of candidateYs) {
        for (const xB of endXs) {
          consider([
            pA,
            { x: xA, y: ay },
            { x: xA, y: midY },
            { x: xB, y: midY },
            { x: xB, y: by },
            pB,
          ]);
        }
      }
    }

    return bestClear ?? bestFallback;
  };

  // Use 2-state Dynamic Programming over all waypoints so each waypoint chooses the optimal 90° corner orientation:
  // - State 'H': arrives at wp[i] horizontally (endDir = 'H') and leaves wp[i] vertically (nextStartDir = 'V')
  // - State 'V': arrives at wp[i] vertically (endDir = 'V') and leaves wp[i] horizontally (nextStartDir = 'H')
  interface DPState {
    pts: { x: number; y: number }[];
    cost: number;
  }

  let dpStates: Record<'H' | 'V', DPState | null> = { H: null, V: null };

  const wp0 = safeWaypoints[0];
  for (const endDir of ['H', 'V'] as const) {
    const leg = findCleanOrthogonalBridge(
      startStubX,
      y1,
      wp0.x,
      wp0.y,
      undefined,
      endDir,
      true,
      false
    );
    if (leg) {
      const initialPts: { x: number; y: number }[] = [{ x: x1, y: y1 }];
      for (let k = 0; k < leg.pts.length; k++) {
        initialPts.push(leg.pts[k]);
      }
      dpStates[endDir] = {
        pts: initialPts,
        cost: leg.len + (leg.blocked ? 100000 : 0),
      };
    }
  }

  for (let i = 1; i < safeWaypoints.length; i++) {
    const prevWp = safeWaypoints[i - 1];
    const currWp = safeWaypoints[i];
    const nextDp: Record<'H' | 'V', DPState | null> = { H: null, V: null };

    for (const prevEndDir of ['H', 'V'] as const) {
      const prevState = dpStates[prevEndDir];
      if (!prevState) continue;
      // Perpendicular 90° corner rule at prevWp!
      const reqStartDir: 'H' | 'V' = prevEndDir === 'H' ? 'V' : 'H';

      for (const currEndDir of ['H', 'V'] as const) {
        const leg = findCleanOrthogonalBridge(
          prevWp.x,
          prevWp.y,
          currWp.x,
          currWp.y,
          reqStartDir,
          currEndDir,
          false,
          false
        );
        if (!leg) continue;
        const totalCost = prevState.cost + leg.len + (leg.blocked ? 100000 : 0);
        const existing = nextDp[currEndDir];
        if (!existing || totalCost < existing.cost) {
          const combined = [...prevState.pts];
          for (let k = 1; k < leg.pts.length; k++) {
            combined.push(leg.pts[k]);
          }
          nextDp[currEndDir] = { pts: combined, cost: totalCost };
        }
      }
    }
    dpStates = nextDp;
  }

  // Connect the last waypoint to (endStubX, y2) -> (x2, y2)
  const lastWp = safeWaypoints[safeWaypoints.length - 1];
  let bestFinalPts: { x: number; y: number }[] | null = null;
  let bestFinalCost = Infinity;

  for (const lastEndDir of ['H', 'V'] as const) {
    const prevState = dpStates[lastEndDir];
    if (!prevState) continue;
    const reqStartDir: 'H' | 'V' = lastEndDir === 'H' ? 'V' : 'H';

    const finalLeg = findCleanOrthogonalBridge(
      lastWp.x,
      lastWp.y,
      endStubX,
      y2,
      reqStartDir,
      undefined,
      false,
      true
    );
    if (!finalLeg) continue;

    const totalCost = prevState.cost + finalLeg.len + (finalLeg.blocked ? 100000 : 0);
    if (totalCost < bestFinalCost) {
      bestFinalCost = totalCost;
      const combined = [...prevState.pts];
      for (let k = 1; k < finalLeg.pts.length; k++) {
        combined.push(finalLeg.pts[k]);
      }
      combined.push({ x: x2, y: y2 });
      bestFinalPts = combined;
    }
  }

  if (!bestFinalPts) {
    return computeOrthogonalConveyorPath(x1, y1, x2, y2, obstacles, fromNode, toNode);
  }

  return simplifyPolylinePreservingWaypoints(bestFinalPts, safeWaypoints);
}

export function getCachedConveyorRoute(
  fromNode: MachineNode,
  outIdx: number,
  toNode: MachineNode,
  inIdx: number,
  obstacles: MachineNode[] = [],
  waypoints?: { x: number; y: number }[]
): CachedConveyorRoute {
  const safeOutIdx = Math.max(0, outIdx);
  const safeInIdx = Math.max(0, inIdx);
  const sig = computeNodesGeometrySignature(obstacles);
  if (sig !== cachedGeometrySignature) {
    cachedGeometrySignature = sig;
    cachedRoutesByEndpoints.clear();
  }

  const wpKey = (waypoints ?? [])
    .map((w) => `${Math.round(w.x)},${Math.round(w.y)}`)
    .join(';');
  const endpointKey = `${fromNode.id}:${safeOutIdx}:${fromNode.x},${fromNode.y}->${toNode.id}:${safeInIdx}:${toNode.x},${toNode.y}[${wpKey}]`;
  const existing = cachedRoutesByEndpoints.get(endpointKey);
  if (existing) {
    return existing;
  }

  const p1 = getPortWorldPosition(fromNode, 'output', safeOutIdx, fromNode.outputs.length);
  const p2 = getPortWorldPosition(toNode, 'input', safeInIdx, toNode.inputs.length);
  const pts = computeConveyorPathWithWaypoints(
    p1.x,
    p1.y,
    p2.x,
    p2.y,
    obstacles,
    fromNode,
    toNode,
    waypoints
  );
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
    filletedPath: computeFilletedConveyorPath(pts),
  };
  cachedRoutesByEndpoints.set(endpointKey, route);
  return route;
}

export function computeConveyorLengthPx(
  fromNode: MachineNode,
  outIdx: number,
  toNode: MachineNode,
  inIdx: number,
  obstacles: MachineNode[] = [],
  waypoints?: { x: number; y: number }[]
): number {
  return getCachedConveyorRoute(fromNode, outIdx, toNode, inIdx, obstacles, waypoints).lengthPx;
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

  const targetDist = Math.max(0, Math.min(path.totalLength, distPx));
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
        // Tangent angle in direction of travel along the arc
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
