/**
 * ============================================================================
 * MODULE INDEX: Waypoint DP Routing & Route Cache (`src/game/conveyorRouting.ts`)
 * ============================================================================
 * [Lines 023-060] CachedConveyorRoute, computeNodesGeometrySignature, invalidateAllConveyorCaches
 * [Lines 062-112] simplifyPolylinePreservingWaypoints
 * [Lines 114-169] getEffectiveObstacleBox, isPointInsideObstacle
 * [Lines 171-698] computeConveyorPathWithWaypoints - 2-state DP router with 90° corners
 * [Lines 700-776] getCachedConveyorRoute, computeConveyorLengthPx
 * ============================================================================
 */

import { computeFilletedConveyorPath, FilletedConveyorPath } from './conveyorCurves';
import {
  computeOrthogonalConveyorPath,
  computePolylineLength,
  doesSegmentIntersectBox,
  getPortWorldPosition,
  isMinerDirectlyOnDeposit,
} from './geometry';
import { MachineNode } from './types';

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

  // Pass 1: Remove duplicate points and merge same-direction collinear segments
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
 * planetary resource deposit rock rims (+10px) and bottom survey pedestal tabs (+22px).
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

  const dedupeCoords = (arr: number[], minGap = 8): number[] => {
    const sorted = arr.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    const out: number[] = [];
    for (const v of sorted) {
      if (out.length === 0 || Math.abs(v - out[out.length - 1]) >= minGap) {
        out.push(v);
      }
    }
    return out;
  };

  const baseMargin = CLEARANCE + 8;
  const rawGlobalXs: number[] = [startStubX, endStubX];
  const rawGlobalYs: number[] = [y1, y2];

  for (const box of allObstacleBoxes) {
    const m = box.isEndpoint ? 16 : baseMargin;
    rawGlobalXs.push(box.x - m, box.x + box.width + m);
    rawGlobalYs.push(box.y - m, box.y + box.height + m);
  }

  for (let i = 0; i < allObstacleBoxes.length; i++) {
    for (let j = i + 1; j < allObstacleBoxes.length; j++) {
      const a = allObstacleBoxes[i];
      const b = allObstacleBoxes[j];
      if (a.y + a.height < b.y && b.y - (a.y + a.height) >= 22 && b.y - (a.y + a.height) <= 320) {
        rawGlobalYs.push((a.y + a.height + b.y) * 0.5);
      } else if (b.y + b.height < a.y && a.y - (b.y + b.height) >= 22 && a.y - (b.y + b.height) <= 320) {
        rawGlobalYs.push((b.y + b.height + a.y) * 0.5);
      }
      if (a.x + a.width < b.x && b.x - (a.x + a.width) >= 22 && b.x - (a.x + a.width) <= 320) {
        rawGlobalXs.push((a.x + a.width + b.x) * 0.5);
      } else if (b.x + b.width < a.x && a.x - (b.x + b.width) >= 22 && a.x - (b.x + b.width) <= 320) {
        rawGlobalXs.push((b.x + b.width + a.x) * 0.5);
      }
    }
  }

  const globalCandidateXs = dedupeCoords(rawGlobalXs, 8);
  const globalCandidateYs = dedupeCoords(rawGlobalYs, 8);

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
          if (dx1 * dx2 < 0) return null;
          cleaned[cleaned.length - 1] = curr;
          continue;
        }
        if (isV1 && isV2) {
          const dy1 = prev.y - pPrev.y;
          const dy2 = curr.y - prev.y;
          if (dy1 * dy2 < 0) return null;
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
    if (reqStartDir && firstLen < 12) return null;
    if (reqEndDir && lastLen < 12) return null;
    if (forbidStartLeft && startDir === 'H' && firstDx < -0.5) return null;
    if (forbidEndRight && endDir === 'H' && lastDx < -0.5) return null;

    const blocked = !isChainClear(cleaned);
    const len = computePolylineLength(cleaned) + cleaned.length * 4;
    return { pts: cleaned, startDir, endDir, len, blocked };
  };

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
    const midTargetX = (ax + bx) * 0.5;
    const midTargetY = (ay + by) * 0.5;

    const candidateXs = dedupeCoords(
      [
        midTargetX,
        ax,
        bx,
        ax - 32,
        ax + 32,
        bx - 32,
        bx + 32,
        ...globalCandidateXs,
      ],
      8
    )
      .sort((a, b) => Math.abs(a - midTargetX) - Math.abs(b - midTargetX))
      .slice(0, 14);

    const candidateYs = dedupeCoords(
      [
        midTargetY,
        ay,
        by,
        ay - 32,
        ay + 32,
        by - 32,
        by + 32,
        ...globalCandidateYs,
      ],
      8
    )
      .sort((a, b) => Math.abs(a - midTargetY) - Math.abs(b - midTargetY))
      .slice(0, 14);

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

    if (Math.abs(ax - bx) < 0.5 || Math.abs(ay - by) < 0.5) {
      consider([pA, pB]);
    }
    consider([pA, { x: bx, y: ay }, pB]);
    consider([pA, { x: ax, y: by }, pB]);

    if (bestClear) return bestClear;

    for (const midX of candidateXs) {
      consider([pA, { x: midX, y: ay }, { x: midX, y: by }, pB]);
    }
    for (const midY of candidateYs) {
      consider([pA, { x: ax, y: midY }, { x: bx, y: midY }, pB]);
    }

    if (bestClear) return bestClear;

    for (const midX of candidateXs) {
      for (const midY of candidateYs) {
        consider([pA, { x: midX, y: ay }, { x: midX, y: midY }, { x: bx, y: midY }, pB]);
        consider([pA, { x: ax, y: midY }, { x: midX, y: midY }, { x: midX, y: by }, pB]);
      }
    }

    if (bestClear) return bestClear;

    const stepYs = [ay - 28, ay + 28, ...candidateYs.slice(0, 5)];
    const endYs = [by - 28, by + 28, ...candidateYs.slice(0, 5)];
    const topMidXs = candidateXs.slice(0, 8);
    for (const yA of stepYs) {
      for (const midX of topMidXs) {
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

    if (bestClear) return bestClear;

    const stepXs = [ax - 28, ax + 28, ...candidateXs.slice(0, 5)];
    const endXs = [bx - 28, bx + 28, ...candidateXs.slice(0, 5)];
    const topMidYs = candidateYs.slice(0, 8);
    for (const xA of stepXs) {
      for (const midY of topMidYs) {
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
