/**
 * ============================================================================
 * MODULE INDEX: World Geometry, Collision & Base Orthogonal Routing (`src/game/geometry.ts`)
 * ============================================================================
 * [Lines 018-045] World Bounds, Zoom Thresholds & Port World Positions
 * [Lines 047-103] Polyline Distance & Segment Math (`computePolylineLength`, `distanceFromPointToPolyline`)
 * [Lines 105-204] AABB Collision & Miner-on-Deposit Validation (`doNodesOverlap`, `isMinerDirectlyOnDeposit`, `isNodePositionValid`)
 * [Lines 206-284] Box-Segment Intersection & Polyline Simplification (`doesSegmentIntersectBox`, `simplifyPolyline`)
 * [Lines 286-565] Base Orthogonal Port-to-Port Router (`computeOrthogonalConveyorPath`)
 * [Lines 567-635] Grid Snapping & World/Camera Clamping (`snapToGrid`, `clampNodeToWorld`, `clampCameraToWorld`)
 * [Lines 637-642] Re-exports from `./conveyorCurves` and `./conveyorRouting`
 * ============================================================================
 */

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

        if (!isMinerDirectlyOnDeposit(minerNode, depositNode, 4)) {
          return { valid: false, collidingNode: node, reason: 'miner_not_centered_on_deposit' };
        }

        const hasOtherMiner = nodes.some(
          (n) =>
            n.buildingId === 'miner_mk1' &&
            n.id !== minerNode.id &&
            isMinerDirectlyOnDeposit(n, depositNode, 16)
        );
        if (!hasOtherMiner) {
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

  if (Math.abs(p1.x - p2.x) < 1e-4 && Math.abs(p1.y - p2.y) < 1e-4) {
    return false;
  }

  if (Math.abs(p1.y - p2.y) < 1e-4) {
    return p1.y >= bT && p1.y <= bB && maxX > bL + 1e-3 && minX < bR - 1e-3;
  }
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

  if (srcNode && dstNode) {
    if (srcNode.y > dstNode.y + dstNode.height) {
      candidateMidYs.unshift(((dstNode.y + dstNode.height) + srcNode.y) * 0.5);
    } else if (dstNode.y > srcNode.y + srcNode.height) {
      candidateMidYs.unshift(((srcNode.y + srcNode.height) + dstNode.y) * 0.5);
    }
  }

  const margin = CLEARANCE + 8;
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
  const safeZoom = Number.isFinite(cam.zoom) ? cam.zoom : 0.74;
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, safeZoom));
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

  const safeX = Number.isFinite(cam.x) ? cam.x : minX;
  const safeY = Number.isFinite(cam.y) ? cam.y : minY;

  return {
    x: Math.min(maxX, Math.max(minX, safeX)),
    y: Math.min(maxY, Math.max(minY, safeY)),
    zoom,
  };
}

export * from './conveyorCurves';
export * from './conveyorRouting';
