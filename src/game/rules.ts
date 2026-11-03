import {
  BUILDINGS,
  CONVEYOR_BELT_TIERS,
  PURITY_CONFIG,
  RECIPES,
  SECTOR_01_DEPOSIT_SPECS,
} from './catalog';
import {
  BeltItemPacket,
  CameraState,
  ConveyorBeltTier,
  ConveyorBeltTierDef,
  ConveyorConnection,
  MachineNode,
  PortSocket,
  ResourcePurity,
  SaveSlot,
} from './types';

export const PIXELS_PER_METER = 15;
export const BELT_ITEM_LENGTH_METERS = 1.2;
export const BELT_ITEM_FOOTPRINT_PX = 18;

// Expanded Sector 01 Map Boundaries (12000x8000 regional sector with clustered deposits)
export const WORLD_WIDTH = 12000;
export const WORLD_HEIGHT = 8000;
export const MIN_ZOOM = 0.06;
export const MAX_ZOOM = 1.85;
// Require zooming out past 0.25x before switching to Macro Icon Box / Map Pin view
export const LOD_ICON_BOX_ZOOM_THRESHOLD = 0.25;
export const WORLD_PADDING = 24;
// Physical spacing on a full belt: 1 item every 1.2 meters (18 world pixels)
export const BELT_ITEM_SLOT_PX = BELT_ITEM_FOOTPRINT_PX;

export function isMacroIconZoom(zoom: number): boolean {
  return zoom < LOD_ICON_BOX_ZOOM_THRESHOLD;
}

export function getBeltTierDef(
  beltTier?: ConveyorBeltTier,
  maxCapacityPerMin?: number
): ConveyorBeltTierDef {
  if (beltTier && CONVEYOR_BELT_TIERS[beltTier]) {
    return CONVEYOR_BELT_TIERS[beltTier];
  }
  const cap = maxCapacityPerMin ?? 60;
  if (cap <= 60) return CONVEYOR_BELT_TIERS[1];
  if (cap <= 120) return CONVEYOR_BELT_TIERS[2];
  if (cap <= 270) return CONVEYOR_BELT_TIERS[3];
  if (cap <= 480) return CONVEYOR_BELT_TIERS[4];
  if (cap <= 780) return CONVEYOR_BELT_TIERS[5];
  return CONVEYOR_BELT_TIERS[6];
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

export function computeConveyorLengthPx(
  fromNode: MachineNode,
  outIdx: number,
  toNode: MachineNode,
  inIdx: number,
  obstacles: MachineNode[] = []
): number {
  const p1 = getPortWorldPosition(fromNode, 'output', Math.max(0, outIdx), fromNode.outputs.length);
  const p2 = getPortWorldPosition(toNode, 'input', Math.max(0, inIdx), toNode.inputs.length);
  const pts = computeOrthogonalConveyorPath(p1.x, p1.y, p2.x, p2.y, obstacles, fromNode, toNode);
  const polyLen = computePolylineLength(pts);
  return Math.max(36, Math.round(polyLen));
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

export function createConveyorConnection(
  fromNodeId: string,
  fromPortId: string,
  toNodeId: string,
  toPortId: string,
  beltTier: ConveyorBeltTier = 1,
  customId?: string
): ConveyorConnection {
  const tierDef = CONVEYOR_BELT_TIERS[beltTier] ?? CONVEYOR_BELT_TIERS[1];
  return {
    id: customId ?? `conn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    fromNodeId,
    fromPortId,
    toNodeId,
    toPortId,
    beltTier: tierDef.tier,
    itemName: null,
    ratePerMin: 0,
    sourceRatePerMin: 0,
    maxCapacityPerMin: tierDef.capacityPerMin,
    spawnAccumulator: 1, // Emit first resource packet immediately at output port (distancePx = 0)
    inFlightItems: [],
    firstItemArrived: false,
  };
}

export function upgradeConveyorBeltTier(
  conn: ConveyorConnection,
  newTier: ConveyorBeltTier
): ConveyorConnection {
  const tierDef = CONVEYOR_BELT_TIERS[newTier] ?? CONVEYOR_BELT_TIERS[1];
  return {
    ...conn,
    beltTier: tierDef.tier,
    maxCapacityPerMin: tierDef.capacityPerMin,
  };
}

/**
 * Computes strictly adaptive conveyor belt packet speed, density, and size down to single-digit
 * flow rates (e.g., 1/m, 2/m, 3/m, 4/m, 5/m ... up to 120/m) without a floor clamp.
 */
export function computeConveyorBeltFlowVisuals(ratePerMin: number): {
  speedMultiplier: number;
  dotCount: number;
  dotRadius: number;
  spacingRatio: number;
} {
  if (ratePerMin <= 0) {
    return { speedMultiplier: 0, dotCount: 0, dotRadius: 0, spacingRatio: 1 };
  }
  const clampedRate = Math.min(1200, Math.max(0.1, ratePerMin));
  // Un-clamped linear speed so 1/m, 2/m, 3/m, 4/m, 5/m ... each move at their exact proportional speed
  const speedMultiplier = Number((clampedRate / 60).toFixed(4));
  // Continuous packet count and spacing that scales across single digits and high throughput
  const dotCount = Math.max(1, Math.min(16, Math.ceil(clampedRate / 8)));
  const dotRadius = Number((3.2 + Math.min(120, clampedRate) * 0.015).toFixed(3));
  const spacingRatio = Number((1 / (clampedRate + 1)).toFixed(5));
  return { speedMultiplier, dotCount, dotRadius, spacingRatio };
}

export function snapToGrid(value: number, gridSize: number, enabled: boolean): number {
  if (!enabled || gridSize <= 0) return Math.round(value);
  return Math.round(value / gridSize) * gridSize;
}

export interface SnapGuideline {
  axis: 'horizontal' | 'vertical';
  kind: 'port' | 'center';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  label?: string;
}

export interface NodeSnapResult {
  x: number;
  y: number;
  snappedX: boolean;
  snappedY: boolean;
  guidelines: SnapGuideline[];
}

/**
 * Satisfactory-style Smart Snap Mode resolver:
 * Snaps a dragged or ghost-preview building to:
 * 1. Connected input/output ports (highest priority so wired belts lock 100% straight)
 * 2. Nearby compatible input/output ports within a horizontal factory corridor
 * 3. Nearby building centerlines / edges
 * 4. Standard 24px blueprint world grid fallback
 * Also emits active visual laser guidelines for canvas rendering.
 */
export function computeNodeSnapAlignment(
  candidate: {
    id?: string;
    buildingId: string;
    x: number;
    y: number;
    width: number;
    height: number;
  },
  nodes: MachineNode[],
  connections: ConveyorConnection[],
  options: { gridSnap: boolean; gridSize: number; snapMode?: boolean }
): NodeSnapResult {
  const baseX = snapToGrid(candidate.x, options.gridSize, options.gridSnap);
  const baseY = snapToGrid(candidate.y, options.gridSize, options.gridSnap);

  if (options.snapMode === false) {
    return {
      x: baseX,
      y: baseY,
      snappedX: false,
      snappedY: false,
      guidelines: [],
    };
  }

  const bDef = BUILDINGS[candidate.buildingId];
  const inCount = bDef?.inputPortCount ?? 1;
  const outCount = bDef?.outputPortCount ?? 1;
  const PORT_SNAP_THRESHOLD = 18;
  const CENTER_SNAP_THRESHOLD = 14;
  const MAX_H_CORRIDOR = 960;
  const MAX_V_CORRIDOR = 840;

  let finalX = baseX;
  let finalY = baseY;
  let snappedX = false;
  let snappedY = false;

  // ---------------------------------------------------------------------------
  // 1. Evaluate Y-Axis Snap (Connected Ports -> Nearby Compatible Ports -> Center Y)
  // ---------------------------------------------------------------------------
  let bestYDiff = PORT_SNAP_THRESHOLD + 1;
  let bestTargetY: number | null = null;

  // Priority 1A: Connected Ports (if dragging an existing wired node)
  if (candidate.id) {
    const attachedConns = connections.filter(
      (c) => c.toNodeId === candidate.id || c.fromNodeId === candidate.id
    );
    for (const conn of attachedConns) {
      if (conn.toNodeId === candidate.id) {
        const srcNode = nodes.find((n) => n.id === conn.fromNodeId);
        if (!srcNode) continue;
        const outIdx = Math.max(
          0,
          srcNode.outputs.findIndex((p) => p.id === conn.fromPortId)
        );
        const srcPt = getPortWorldPosition(
          srcNode,
          'output',
          outIdx,
          Math.max(1, srcNode.outputs.length)
        );
        const inIdx = Math.max(0, parseInt(conn.toPortId.split('_in_')[1] ?? '0', 10) || 0);
        const candOffset = getPortOffsetY(inIdx, Math.max(1, inCount));
        const idealY = srcPt.y - candOffset;
        const diff = Math.abs(candidate.y - idealY);
        if (diff < bestYDiff) {
          bestYDiff = diff;
          bestTargetY = idealY;
        }
      } else if (conn.fromNodeId === candidate.id) {
        const dstNode = nodes.find((n) => n.id === conn.toNodeId);
        if (!dstNode) continue;
        const inIdx = Math.max(
          0,
          dstNode.inputs.findIndex((p) => p.id === conn.toPortId)
        );
        const dstPt = getPortWorldPosition(
          dstNode,
          'input',
          inIdx,
          Math.max(1, dstNode.inputs.length)
        );
        const outIdx = Math.max(0, parseInt(conn.fromPortId.split('_out_')[1] ?? '0', 10) || 0);
        const candOffset = getPortOffsetY(outIdx, Math.max(1, outCount));
        const idealY = dstPt.y - candOffset;
        const diff = Math.abs(candidate.y - idealY);
        if (diff < bestYDiff) {
          bestYDiff = diff;
          bestTargetY = idealY;
        }
      }
    }
  }

  // Priority 1B: Nearby Compatible Ports in Horizontal Corridor
  if (bestTargetY === null) {
    let bestHorizDist = Infinity;
    for (const other of nodes) {
      if (candidate.id && other.id === candidate.id) continue;
      const vDist = Math.abs(
        other.y + other.height * 0.5 - (candidate.y + candidate.height * 0.5)
      );
      if (vDist > 320) continue;

      // Other node is to the left -> match other's outputs to candidate's inputs
      if (other.x + other.width <= candidate.x + 60 && inCount > 0 && other.outputs.length > 0) {
        const hDist = Math.abs(candidate.x - (other.x + other.width));
        if (hDist <= MAX_H_CORRIDOR) {
          for (let oIdx = 0; oIdx < other.outputs.length; oIdx++) {
            const otherPt = getPortWorldPosition(
              other,
              'output',
              oIdx,
              other.outputs.length
            );
            for (let iIdx = 0; iIdx < inCount; iIdx++) {
              const candOffset = getPortOffsetY(iIdx, inCount);
              const idealY = otherPt.y - candOffset;
              const diff = Math.abs(candidate.y - idealY);
              if (
                diff <= PORT_SNAP_THRESHOLD &&
                (diff < bestYDiff - 1 || (Math.abs(diff - bestYDiff) <= 1 && hDist < bestHorizDist))
              ) {
                bestYDiff = diff;
                bestHorizDist = hDist;
                bestTargetY = idealY;
              }
            }
          }
        }
      }

      // Other node is to the right -> match other's inputs to candidate's outputs
      if (other.x >= candidate.x + candidate.width - 60 && outCount > 0 && other.inputs.length > 0) {
        const hDist = Math.abs(other.x - (candidate.x + candidate.width));
        if (hDist <= MAX_H_CORRIDOR) {
          for (let iIdx = 0; iIdx < other.inputs.length; iIdx++) {
            const otherPt = getPortWorldPosition(
              other,
              'input',
              iIdx,
              other.inputs.length
            );
            for (let oIdx = 0; oIdx < outCount; oIdx++) {
              const candOffset = getPortOffsetY(oIdx, outCount);
              const idealY = otherPt.y - candOffset;
              const diff = Math.abs(candidate.y - idealY);
              if (
                diff <= PORT_SNAP_THRESHOLD &&
                (diff < bestYDiff - 1 || (Math.abs(diff - bestYDiff) <= 1 && hDist < bestHorizDist))
              ) {
                bestYDiff = diff;
                bestHorizDist = hDist;
                bestTargetY = idealY;
              }
            }
          }
        }
      }
    }
  }

  // Priority 1C: Nearby Building Center Y
  if (bestTargetY === null) {
    let bestCenterDiff = CENTER_SNAP_THRESHOLD + 1;
    for (const other of nodes) {
      if (candidate.id && other.id === candidate.id) continue;
      const hDist = Math.abs(
        other.x + other.width * 0.5 - (candidate.x + candidate.width * 0.5)
      );
      if (hDist > MAX_H_CORRIDOR) continue;
      const otherCenterY = other.y + other.height * 0.5;
      const idealY = Math.round(otherCenterY - candidate.height * 0.5);
      const diff = Math.abs(candidate.y - idealY);
      if (diff < bestCenterDiff) {
        bestCenterDiff = diff;
        bestTargetY = idealY;
      }
    }
  }

  if (bestTargetY !== null) {
    finalY = bestTargetY;
    snappedY = true;
  }

  // ---------------------------------------------------------------------------
  // 2. Evaluate X-Axis Snap (Vertical Column Alignment with Nearby Buildings)
  // ---------------------------------------------------------------------------
  let bestXDiff = CENTER_SNAP_THRESHOLD + 1;
  let bestTargetX: number | null = null;
  for (const other of nodes) {
    if (candidate.id && other.id === candidate.id) continue;
    const vDist = Math.abs(
      other.y + other.height * 0.5 - (finalY + candidate.height * 0.5)
    );
    if (vDist > MAX_V_CORRIDOR) continue;

    const otherCenterX = other.x + other.width * 0.5;
    const idealX =
      other.width === candidate.width
        ? other.x
        : Math.round(otherCenterX - candidate.width * 0.5);
    const diff = Math.abs(candidate.x - idealX);
    if (diff < bestXDiff) {
      bestXDiff = diff;
      bestTargetX = idealX;
    }
  }

  if (bestTargetX !== null) {
    finalX = bestTargetX;
    snappedX = true;
  }

  // ---------------------------------------------------------------------------
  // 3. Emit Active Visual Laser Guidelines for All Aligned Ports & Centers
  // ---------------------------------------------------------------------------
  const guidelines: SnapGuideline[] = [];
  const alignedNodeIdsH = new Set<string>();

  for (const other of nodes) {
    if (candidate.id && other.id === candidate.id) continue;
    const hCenterDist = Math.abs(
      other.x + other.width * 0.5 - (finalX + candidate.width * 0.5)
    );
    const vCenterDist = Math.abs(
      other.y + other.height * 0.5 - (finalY + candidate.height * 0.5)
    );

    const isConnectedToOther =
      Boolean(candidate.id) &&
      connections.some(
        (c) =>
          (c.fromNodeId === other.id && c.toNodeId === candidate.id) ||
          (c.fromNodeId === candidate.id && c.toNodeId === other.id)
      );

    if (hCenterDist <= MAX_H_CORRIDOR || isConnectedToOther) {
      // Check output(other) -> input(candidate)
      if (other.x + other.width <= finalX + 40 && inCount > 0) {
        for (let oIdx = 0; oIdx < other.outputs.length; oIdx++) {
          const otherPt = getPortWorldPosition(
            other,
            'output',
            oIdx,
            other.outputs.length
          );
          for (let iIdx = 0; iIdx < inCount; iIdx++) {
            const candPtY = finalY + getPortOffsetY(iIdx, inCount);
            if (Math.abs(candPtY - otherPt.y) <= 0.5) {
              guidelines.push({
                axis: 'horizontal',
                kind: 'port',
                x1: otherPt.x,
                y1: otherPt.y,
                x2: finalX,
                y2: candPtY,
                color: isConnectedToOther ? '#F59E0B' : '#38BDF8',
                label: 'PORT ALIGNED',
              });
              alignedNodeIdsH.add(other.id);
              snappedY = true;
            }
          }
        }
      }

      // Check output(candidate) -> input(other)
      if (other.x >= finalX + candidate.width - 40 && outCount > 0) {
        for (let iIdx = 0; iIdx < other.inputs.length; iIdx++) {
          const otherPt = getPortWorldPosition(
            other,
            'input',
            iIdx,
            other.inputs.length
          );
          for (let oIdx = 0; oIdx < outCount; oIdx++) {
            const candPtY = finalY + getPortOffsetY(oIdx, outCount);
            if (Math.abs(candPtY - otherPt.y) <= 0.5) {
              guidelines.push({
                axis: 'horizontal',
                kind: 'port',
                x1: finalX + candidate.width,
                y1: candPtY,
                x2: otherPt.x,
                y2: otherPt.y,
                color: isConnectedToOther ? '#F59E0B' : '#38BDF8',
                label: 'PORT ALIGNED',
              });
              alignedNodeIdsH.add(other.id);
              snappedY = true;
            }
          }
        }
      }

      // Horizontal center alignment guideline (if not already showing a port laser to this node)
      if (!alignedNodeIdsH.has(other.id)) {
        const candCenterY = finalY + candidate.height * 0.5;
        const otherCenterY = other.y + other.height * 0.5;
        if (Math.abs(candCenterY - otherCenterY) <= 0.5) {
          const minX = Math.min(finalX + candidate.width * 0.5, other.x + other.width * 0.5);
          const maxX = Math.max(finalX + candidate.width * 0.5, other.x + other.width * 0.5);
          guidelines.push({
            axis: 'horizontal',
            kind: 'center',
            x1: minX,
            y1: candCenterY,
            x2: maxX,
            y2: otherCenterY,
            color: '#38BDF888',
          });
        }
      }
    }

    // Vertical center alignment guideline
    if (vCenterDist <= MAX_V_CORRIDOR) {
      const candCenterX = finalX + candidate.width * 0.5;
      const otherCenterX = other.x + other.width * 0.5;
      if (Math.abs(candCenterX - otherCenterX) <= 0.5) {
        const minY = Math.min(finalY + candidate.height * 0.5, other.y + other.height * 0.5);
        const maxY = Math.max(finalY + candidate.height * 0.5, other.y + other.height * 0.5);
        guidelines.push({
          axis: 'vertical',
          kind: 'center',
          x1: candCenterX,
          y1: minY,
          x2: otherCenterX,
          y2: maxY,
          color: '#38BDF888',
        });
        snappedX = true;
      }
    }
  }

  return {
    x: finalX,
    y: finalY,
    snappedX,
    snappedY,
    guidelines,
  };
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

export function buildNodePorts(
  nodeId: string,
  buildingId: string,
  recipeId: string | null,
  purity?: ResourcePurity
): { inputs: PortSocket[]; outputs: PortSocket[] } {
  const bDef = BUILDINGS[buildingId];
  if (!bDef) {
    return { inputs: [], outputs: [] };
  }
  const recipe = recipeId ? RECIPES[recipeId] : null;
  const purityRate = purity ? PURITY_CONFIG[purity].ratePerMin : null;

  const inputs: PortSocket[] = [];
  for (let i = 0; i < bDef.inputPortCount; i++) {
    const ing = recipe?.inputs[i] ?? null;
    inputs.push({
      id: `${nodeId}_in_${i}`,
      index: i,
      side: 'input',
      label: ing ? ing.itemName : `IN ${i + 1}`,
      itemName: ing ? ing.itemName : null,
      targetRatePerMin: ing ? ing.ratePerMin : 60,
      actualRatePerMin: 0,
    });
  }

  const outputs: PortSocket[] = [];
  for (let i = 0; i < bDef.outputPortCount; i++) {
    const out = recipe?.outputs[i] ?? null;
    const rate =
      buildingId === 'resource_deposit' && purityRate !== null
        ? purityRate
        : out
        ? out.ratePerMin
        : 60;
    outputs.push({
      id: `${nodeId}_out_${i}`,
      index: i,
      side: 'output',
      label: out ? out.itemName : `OUT ${i + 1}`,
      itemName: out ? out.itemName : null,
      targetRatePerMin: rate,
      actualRatePerMin: 0,
    });
  }

  return { inputs, outputs };
}

export function createMachineNode(
  buildingId: string,
  x: number,
  y: number,
  customId?: string,
  customRecipeId?: string | null,
  options?: {
    purity?: ResourcePurity;
    isWorldDeposit?: boolean;
    customTitle?: string;
  }
): MachineNode {
  const bDef = BUILDINGS[buildingId] ?? BUILDINGS.smelter;
  const id = customId ?? `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const recipeId = customRecipeId !== undefined ? customRecipeId : bDef.defaultRecipeId;
  const purity =
    options?.purity ?? (buildingId === 'resource_deposit' ? 'normal' : undefined);
  const { inputs, outputs } = buildNodePorts(id, bDef.id, recipeId, purity);

  return {
    id,
    buildingId: bDef.id,
    title: options?.customTitle ?? bDef.name,
    x,
    y,
    width: bDef.width,
    height: bDef.height,
    recipeId,
    purity,
    isWorldDeposit: options?.isWorldDeposit ?? buildingId === 'resource_deposit',
    status: 'idle',
    efficiency: 0,
    progress: 0,
    storedCount: 0,
    inputs,
    outputs,
  };
}

export function createSectorWorldDeposits(): MachineNode[] {
  return SECTOR_01_DEPOSIT_SPECS.map((spec) =>
    createMachineNode('resource_deposit', spec.x, spec.y, spec.id, spec.recipeId, {
      purity: spec.purity,
      isWorldDeposit: true,
      customTitle: spec.title,
    })
  );
}

export function ensureWorldDepositsPresent(nodes: MachineNode[]): MachineNode[] {
  const validSpecIds = new Set(SECTOR_01_DEPOSIT_SPECS.map((s) => s.id));
  const filtered = nodes.filter(
    (n) => n.buildingId !== 'resource_deposit' || validSpecIds.has(n.id)
  );

  const result = filtered.map((n) => {
    const bDef = BUILDINGS[n.buildingId];
    const syncedHeight = bDef ? bDef.height : n.height;
    const syncedWidth = bDef ? bDef.width : n.width;
    if (n.buildingId === 'resource_deposit') {
      const spec = SECTOR_01_DEPOSIT_SPECS.find((s) => s.id === n.id);
      if (spec) {
        return {
          ...n,
          title: spec.title,
          recipeId: spec.recipeId,
          purity: spec.purity,
          x: spec.x,
          y: spec.y,
          width: syncedWidth,
          height: syncedHeight,
          isWorldDeposit: true,
        };
      }
    }
    // Migrate legacy starter_hub y=2772 to 2808 so its input port aligns straight with starter_constructor
    const migratedY = n.id === 'starter_hub' && n.y === 2772 ? 2808 : n.y;
    return {
      ...n,
      y: migratedY,
      width: syncedWidth,
      height: syncedHeight,
    };
  });

  const existingIds = new Set(result.map((n) => n.id));
  for (const spec of SECTOR_01_DEPOSIT_SPECS) {
    if (!existingIds.has(spec.id)) {
      result.push(
        createMachineNode('resource_deposit', spec.x, spec.y, spec.id, spec.recipeId, {
          purity: spec.purity,
          isWorldDeposit: true,
          customTitle: spec.title,
        })
      );
    }
  }
  return result;
}

export function changeNodeRecipe(node: MachineNode, newRecipeId: string | null): MachineNode {
  const { inputs, outputs } = buildNodePorts(
    node.id,
    node.buildingId,
    newRecipeId,
    node.purity
  );
  return {
    ...node,
    recipeId: newRecipeId,
    inputs,
    outputs,
    progress: 0,
  };
}

export function canConnectPorts(
  nodes: MachineNode[],
  connections: ConveyorConnection[],
  fromNodeId: string,
  fromPortId: string,
  toNodeId: string,
  toPortId: string
): { valid: boolean; reason?: string } {
  if (fromNodeId === toNodeId) {
    return { valid: false, reason: 'Cannot connect a machine node to itself.' };
  }
  const fromNode = nodes.find((n) => n.id === fromNodeId);
  const toNode = nodes.find((n) => n.id === toNodeId);
  if (!fromNode || !toNode) {
    return { valid: false, reason: 'Source or target node does not exist.' };
  }
  const outPort = fromNode.outputs.find((p) => p.id === fromPortId);
  const inPort = toNode.inputs.find((p) => p.id === toPortId);
  if (!outPort || !inPort) {
    return { valid: false, reason: 'Connections must go from an Output port to an Input port.' };
  }
  const outBusy = connections.some(
    (c) => c.fromNodeId === fromNodeId && c.fromPortId === fromPortId
  );
  if (outBusy) {
    return { valid: false, reason: 'Output port already has an active conveyor line.' };
  }
  const inBusy = connections.some(
    (c) => c.toNodeId === toNodeId && c.toPortId === toPortId
  );
  if (inBusy) {
    return { valid: false, reason: 'Input port already has an incoming conveyor line.' };
  }
  return { valid: true };
}

/**
 * Pure simulation tick:
 * - Enforces Satisfactory Conveyor Belt Tier capacities (Mk.1 = 60/m, Mk.2 = 120/m, Mk.3 = 270/m, etc.)
 * - Simulates discrete physical item packets traveling along each belt's world length (`lengthPx`)
 *   at the belt tier's physical speed (`speedPxPerSec`).
 * - When two connected nodes are far apart, destination nodes wait for the leading item packet
 *   to physically reach the input port (`distancePx >= lengthPx`) before receiving resources!
 */
export function stepSimulation(
  nodes: MachineNode[],
  connections: ConveyorConnection[],
  rawDt: number
): { nodes: MachineNode[]; connections: ConveyorConnection[] } {
  const dt = Math.min(Math.max(rawDt, 0), 1.0);

  const nextNodes: MachineNode[] = nodes.map((n) => ({
    ...n,
    inputs: n.inputs.map((p) => ({ ...p, actualRatePerMin: 0 })),
    outputs: n.outputs.map((p) => ({ ...p, actualRatePerMin: 0 })),
  }));

  const nodeMap = new Map<string, MachineNode>();
  for (const n of nextNodes) {
    nodeMap.set(n.id, n);
  }

  // Normalize connections with Belt Tier metadata & physical belt length
  const nextConns: ConveyorConnection[] = connections.map((c) => {
    const tierDef = getBeltTierDef(c.beltTier, c.maxCapacityPerMin);
    const fromNode = nodeMap.get(c.fromNodeId);
    const toNode = nodeMap.get(c.toNodeId);
    const outIdx = fromNode ? fromNode.outputs.findIndex((p) => p.id === c.fromPortId) : 0;
    const inIdx = toNode ? toNode.inputs.findIndex((p) => p.id === c.toPortId) : 0;
    const lengthPx =
      fromNode && toNode
        ? computeConveyorLengthPx(fromNode, outIdx, toNode, inIdx, nextNodes)
        : c.lengthPx ?? 240;
    const travelTimeSec = Number((lengthPx / tierDef.speedPxPerSec).toFixed(2));

    // If a node was dragged further away or belt path lengthened, items must travel the additional distance
    const wasStretchedFurther =
      c.lengthPx !== undefined && lengthPx > c.lengthPx + 0.5;
    const isPreSettledUnpopulated =
      c.inFlightItems === undefined && (c.firstItemArrived ?? true);

    const inFlightItems: BeltItemPacket[] = c.inFlightItems
      ? c.inFlightItems.map((pkt) => ({ ...pkt }))
      : [];

    const prevRate = c.sourceRatePerMin ?? c.ratePerMin ?? tierDef.capacityPerMin;
    const estSpacing =
      prevRate > 0
        ? Math.max(
            BELT_ITEM_FOOTPRINT_PX,
            (tierDef.speedPxPerSec * 60) / Math.min(tierDef.capacityPerMin, prevRate)
          )
        : BELT_ITEM_FOOTPRINT_PX;
    const maxDist =
      inFlightItems.length > 0
        ? Math.max(...inFlightItems.map((p) => p.distancePx))
        : -1;
    const gapToFrontPx =
      maxDist >= 0
        ? lengthPx - maxDist
        : lengthPx + (1 - (c.spawnAccumulator ?? 0)) * estSpacing;
    const hasFrontGap = !isPreSettledUnpopulated && gapToFrontPx > estSpacing + 6;

    const firstItemArrived =
      wasStretchedFurther || hasFrontGap
        ? false
        : c.firstItemArrived ?? isPreSettledUnpopulated;

    return {
      ...c,
      beltTier: tierDef.tier,
      maxCapacityPerMin: tierDef.capacityPerMin,
      lengthPx,
      travelTimeSec,
      spawnAccumulator: c.spawnAccumulator ?? (isPreSettledUnpopulated ? 0.5 : 1),
      inFlightItems,
      firstItemArrived,
    };
  });

  // Multi-pass flow propagation for settled belts
  const maxPasses = Math.max(5, nextNodes.length);
  for (let pass = 0; pass < maxPasses; pass++) {
    // Pass A: compute each node's output rates from its current arriving input rates
    for (const node of nextNodes) {
      const recipe = node.recipeId ? RECIPES[node.recipeId] : null;

      if (node.buildingId === 'resource_deposit') {
        const outRecipe = recipe ?? RECIPES.deposit_iron;
        const purityKey = node.purity ?? 'normal';
        const rate = PURITY_CONFIG[purityKey]?.ratePerMin ?? 60;
        const item = outRecipe.outputs[0]?.itemName ?? 'Iron Ore';
        if (node.outputs[0]) {
          node.outputs[0].actualRatePerMin = rate;
          node.outputs[0].targetRatePerMin = rate;
          node.outputs[0].itemName = item;
          node.outputs[0].label = item;
        }
        node.efficiency = 100;
        node.status = 'optimal';
      } else if (node.buildingId === 'miner_mk1') {
        const inPort = node.inputs[0];
        const outPort = node.outputs[0];
        const incomingConn =
          inPort && nextConns.find((c) => c.toNodeId === node.id && c.toPortId === inPort.id);

        if (
          inPort &&
          outPort &&
          incomingConn &&
          inPort.actualRatePerMin > 0 &&
          inPort.itemName
        ) {
          const suppliedRate = inPort.actualRatePerMin;
          const oreName = inPort.itemName;
          if (oreName.toLowerCase().includes('copper')) {
            node.recipeId = 'mine_copper';
          } else if (oreName.toLowerCase().includes('limestone')) {
            node.recipeId = 'mine_limestone';
          } else {
            node.recipeId = 'mine_iron';
          }
          inPort.label = oreName;
          inPort.targetRatePerMin = suppliedRate;

          outPort.itemName = oreName;
          outPort.label = oreName;
          outPort.targetRatePerMin = suppliedRate;
          outPort.actualRatePerMin = suppliedRate;

          node.efficiency = 100;
          node.status = 'optimal';
        } else {
          const fallbackOre = recipe?.outputs[0]?.itemName ?? 'Iron Ore';
          if (inPort) {
            inPort.label = fallbackOre;
            inPort.targetRatePerMin = 60;
          }
          if (outPort) {
            outPort.label = fallbackOre;
            outPort.itemName = fallbackOre;
            outPort.targetRatePerMin = 60;
            outPort.actualRatePerMin = 0;
          }
          node.efficiency = 0;
          const isInTransit = Boolean(
            incomingConn &&
              (incomingConn.sourceRatePerMin ?? 0) > 0 &&
              !incomingConn.firstItemArrived
          );
          node.status = isInTransit ? 'waiting' : incomingConn ? 'starved' : 'idle';
        }
      } else if (node.buildingId === 'splitter') {
        const inRate = node.inputs[0]?.actualRatePerMin ?? 0;
        const inItem = node.inputs[0]?.itemName ?? null;
        const incomingConn =
          node.inputs[0] &&
          nextConns.find(
            (c) => c.toNodeId === node.id && c.toPortId === node.inputs[0].id
          );
        if (node.inputs[0]) {
          node.inputs[0].label = inItem ?? 'IN 1';
        }
        const activeOutConns = nextConns.filter((c) => c.fromNodeId === node.id);
        const splitCount = Math.max(1, activeOutConns.length);
        const perOutRate = activeOutConns.length > 0 ? Math.round(inRate / splitCount) : 0;

        for (const outPort of node.outputs) {
          const isConnected = activeOutConns.some((c) => c.fromPortId === outPort.id);
          outPort.actualRatePerMin = isConnected ? perOutRate : 0;
          outPort.targetRatePerMin = 60;
          outPort.itemName = isConnected ? inItem : null;
          outPort.label = inItem ?? `OUT ${outPort.index + 1}`;
        }
        node.efficiency = inRate > 0 ? 100 : 0;
        const isInTransit = Boolean(
          incomingConn &&
            (incomingConn.sourceRatePerMin ?? 0) > 0 &&
            !incomingConn.firstItemArrived
        );
        node.status = inRate > 0 ? 'optimal' : isInTransit ? 'waiting' : 'idle';
      } else if (node.buildingId === 'merger') {
        let totalIn = 0;
        let dominantItem: string | null = null;
        let anyInTransit = false;
        for (const inPort of node.inputs) {
          totalIn += inPort.actualRatePerMin;
          if (inPort.itemName && !dominantItem) {
            dominantItem = inPort.itemName;
          }
          inPort.label = inPort.itemName ?? `IN ${inPort.index + 1}`;
          const c = nextConns.find(
            (conn) => conn.toNodeId === node.id && conn.toPortId === inPort.id
          );
          if (c && (c.sourceRatePerMin ?? 0) > 0 && !c.firstItemArrived) {
            anyInTransit = true;
          }
        }
        const cappedOut = Math.min(1200, totalIn);
        if (node.outputs[0]) {
          node.outputs[0].actualRatePerMin = cappedOut;
          node.outputs[0].targetRatePerMin = 60;
          node.outputs[0].itemName = dominantItem;
          node.outputs[0].label = dominantItem ?? 'OUT 1';
        }
        node.efficiency = cappedOut > 0 ? 100 : 0;
        node.status = cappedOut > 0 ? 'optimal' : anyInTransit ? 'waiting' : 'idle';
      } else if (node.buildingId === 'storage_container' || node.buildingId === 'the_hub') {
        let totalIn = 0;
        let itemLabel: string | null = null;
        let anyInTransit = false;
        for (const inPort of node.inputs) {
          totalIn += inPort.actualRatePerMin;
          if (inPort.itemName && !itemLabel) {
            itemLabel = inPort.itemName;
          }
          inPort.label = inPort.itemName ?? `IN ${inPort.index + 1}`;
          const c = nextConns.find(
            (conn) => conn.toNodeId === node.id && conn.toPortId === inPort.id
          );
          if (c && (c.sourceRatePerMin ?? 0) > 0 && !c.firstItemArrived) {
            anyInTransit = true;
          }
        }
        if (node.outputs[0]) {
          node.outputs[0].actualRatePerMin = totalIn;
          node.outputs[0].itemName = itemLabel;
          node.outputs[0].label = itemLabel ?? 'OUT 1';
        }
        node.efficiency = totalIn > 0 ? 100 : 0;
        node.status = totalIn > 0 ? 'optimal' : anyInTransit ? 'waiting' : 'idle';
      } else if (recipe) {
        let limitingRatio = 1.0;
        let anyInputConnected = false;
        let anyInputInTransit = false;

        for (let i = 0; i < recipe.inputs.length; i++) {
          const req = recipe.inputs[i];
          const port = node.inputs[i];
          if (!port) continue;
          port.targetRatePerMin = req.ratePerMin;
          port.label = req.itemName;

          const incomingConn = nextConns.find(
            (c) => c.toNodeId === node.id && c.toPortId === port.id
          );
          if (incomingConn) {
            anyInputConnected = true;
            if ((incomingConn.sourceRatePerMin ?? 0) > 0 && !incomingConn.firstItemArrived) {
              anyInputInTransit = true;
            }
          }

          const itemMatches =
            !port.itemName ||
            port.itemName.toLowerCase() === req.itemName.toLowerCase();
          const supplied = itemMatches ? port.actualRatePerMin : 0;
          const ratio = req.ratePerMin > 0 ? Math.min(1, supplied / req.ratePerMin) : 1;
          limitingRatio = Math.min(limitingRatio, ratio);
        }

        const eff = Math.round(limitingRatio * 100);
        node.efficiency = eff;

        if (eff >= 99) {
          node.status = 'optimal';
        } else if (eff > 0) {
          node.status = 'working';
        } else if (anyInputInTransit) {
          node.status = 'waiting';
        } else if (anyInputConnected) {
          node.status = 'starved';
        } else {
          node.status = 'idle';
        }

        for (let i = 0; i < recipe.outputs.length; i++) {
          const outSpec = recipe.outputs[i];
          const outPort = node.outputs[i];
          if (!outPort) continue;
          outPort.targetRatePerMin = outSpec.ratePerMin;
          outPort.itemName = outSpec.itemName;
          outPort.label = outSpec.itemName;
          outPort.actualRatePerMin = Math.round(outSpec.ratePerMin * limitingRatio);
        }
      }
    }

    // Pass B: update belt entering rates & delivered rates (only delivering if firstItemArrived is true)
    for (const conn of nextConns) {
      const fromNode = nodeMap.get(conn.fromNodeId);
      const toNode = nodeMap.get(conn.toNodeId);
      if (!fromNode || !toNode) continue;

      const outPort = fromNode.outputs.find((p) => p.id === conn.fromPortId);
      const inPort = toNode.inputs.find((p) => p.id === conn.toPortId);
      if (!outPort || !inPort) continue;

      const enteringRate = Math.min(conn.maxCapacityPerMin, outPort.actualRatePerMin);
      conn.sourceRatePerMin = enteringRate;
      if (outPort.itemName) {
        conn.itemName = outPort.itemName;
      }

      const deliveredRate = conn.firstItemArrived ? enteringRate : 0;
      conn.ratePerMin = deliveredRate;

      inPort.actualRatePerMin = deliveredRate;
      if (conn.itemName) {
        inPort.itemName = conn.itemName;
      }
    }
  }

  // Physical Belt Transit Step: advance tightly packed discrete items along each belt at exact Satisfactory m/s pace
  for (const conn of nextConns) {
    const tierDef = getBeltTierDef(conn.beltTier, conn.maxCapacityPerMin);
    const lengthPx = conn.lengthPx ?? 240;
    const enteringRate = conn.sourceRatePerMin ?? 0;
    const itemName = conn.itemName ?? 'Iron Ore';
    const items = conn.inFlightItems ? [...conn.inFlightItems] : [];

    // Ideal center-to-center spacing (18px = 1.2m when belt is at 100% capacity, e.g. 60/m on Mk.1)
    const idealSpacingPx =
      enteringRate > 0
        ? Math.max(
            BELT_ITEM_FOOTPRINT_PX,
            (tierDef.speedPxPerSec * 60) / Math.min(tierDef.capacityPerMin, enteringRate)
          )
        : BELT_ITEM_FOOTPRINT_PX;

    // Pre-populate initial starter belts that start settled with empty inFlightItems
    if (
      conn.firstItemArrived &&
      enteringRate > 0 &&
      items.length === 0
    ) {
      // Populate from destination back toward source at exact idealSpacingPx (18px on a full belt)
      for (let dist = lengthPx - idealSpacingPx * 0.5; dist >= 0; dist -= idealSpacingPx) {
        items.push({
          id: `${conn.id}_init_${Math.round(dist * 10)}`,
          itemName,
          distancePx: Number(dist.toFixed(2)),
        });
      }
      conn.spawnAccumulator = 0.5;
    }

    // Sort items from front (closest to destination lengthPx) to back (closest to source 0)
    items.sort((a, b) => b.distancePx - a.distancePx);

    // Advance all in-flight packets toward the destination port (lengthPx) at tierDef.speedPxPerSec * dt
    // while enforcing physical bumper-to-bumper collision (minimum BELT_ITEM_FOOTPRINT_PX = 18px gap)
    if (dt > 0 && items.length > 0) {
      const stepPx = tierDef.speedPxPerSec * dt;
      for (let i = 0; i < items.length; i++) {
        const pkt = items[i];
        let nextDist = pkt.distancePx + stepPx;
        if (i > 0) {
          const aheadDist = items[i - 1].distancePx;
          nextDist = Math.min(nextDist, aheadDist - BELT_ITEM_FOOTPRINT_PX);
        }
        pkt.distancePx = nextDist;
        pkt.itemName = itemName;
      }
    }

    // Check if leading packet(s) reached the destination input port (distancePx >= lengthPx)
    const remaining: BeltItemPacket[] = [];
    let arrivedThisTick = false;
    for (const pkt of items) {
      if (pkt.distancePx >= lengthPx) {
        if (dt > 0) {
          arrivedThisTick = true;
        }
      } else {
        remaining.push(pkt);
      }
    }

    if (arrivedThisTick) {
      conn.firstItemArrived = true;
    }

    // Spawn new tightly packed physical item packets at the source output port (distancePx >= 0)
    if (enteringRate > 0) {
      const itemsPerSec = enteringRate / 60;
      let acc = (conn.spawnAccumulator ?? 0) + itemsPerSec * dt;

      // Guard against huge dt jumps creating too many iterations
      let safety = 0;
      while (acc >= 1 && safety < 64) {
        safety++;
        const lastPkt = remaining[remaining.length - 1];
        // Exact fractional distance the newly emitted item has already traveled during this frame
        const overshootSec = (acc - 1) / itemsPerSec;
        const desiredDist = Math.max(0, overshootSec * tierDef.speedPxPerSec);
        const maxAllowedDist = lastPkt
          ? lastPkt.distancePx - BELT_ITEM_FOOTPRINT_PX
          : desiredDist;

        if (!lastPkt || lastPkt.distancePx >= BELT_ITEM_FOOTPRINT_PX - 0.01) {
          const spawnDist = Math.max(0, Math.min(desiredDist, maxAllowedDist));
          remaining.push({
            id: `${conn.id}_pkt_${Date.now()}_${safety}_${Math.random().toString(36).slice(2, 5)}`,
            itemName,
            distancePx: Number(spawnDist.toFixed(2)),
          });
          acc -= 1;
        } else {
          // Output port is physically blocked by the item immediately ahead of it (bumper-to-bumper)
          acc = 1;
          break;
        }
      }
      conn.spawnAccumulator = acc;
    } else if (remaining.length === 0) {
      conn.firstItemArrived = false;
      conn.spawnAccumulator = 1;
    }

    conn.inFlightItems = remaining;

    const frontDist = remaining.length > 0 ? remaining[0].distancePx : -1;
    const postGapToFrontPx =
      frontDist >= 0
        ? lengthPx - frontDist
        : lengthPx + (1 - (conn.spawnAccumulator ?? 0)) * idealSpacingPx;

    if (postGapToFrontPx > idealSpacingPx + 6) {
      conn.firstItemArrived = false;
      conn.ratePerMin = 0;
      const toNode = nodeMap.get(conn.toNodeId);
      const inPort = toNode?.inputs.find((p) => p.id === conn.toPortId);
      if (inPort) {
        inPort.actualRatePerMin = 0;
      }
    } else if (arrivedThisTick && enteringRate > 0) {
      conn.ratePerMin = enteringRate;
      const toNode = nodeMap.get(conn.toNodeId);
      const inPort = toNode?.inputs.find((p) => p.id === conn.toPortId);
      if (inPort) {
        inPort.actualRatePerMin = enteringRate;
        inPort.itemName = conn.itemName;
      }
    }
  }

  // Advance machine progress bars & storage counts using dt
  for (const node of nextNodes) {
    const recipe = node.recipeId ? RECIPES[node.recipeId] : null;
    const cycleSec = recipe?.cycleTimeSec ?? 2.0;
    if (node.efficiency > 0) {
      const speedFactor = node.efficiency / 100;
      node.progress = (node.progress + (dt * speedFactor) / cycleSec) % 1;
    } else {
      node.progress = 0;
    }

    if (node.buildingId === 'storage_container' || node.buildingId === 'the_hub') {
      const inSum = node.inputs.reduce((acc, p) => acc + p.actualRatePerMin, 0);
      if (inSum > 0) {
        node.storedCount += (inSum / 60) * dt;
      }
    }
  }

  return { nodes: nextNodes, connections: nextConns };
}

export function createStarterFactory(): {
  nodes: MachineNode[];
  connections: ConveyorConnection[];
} {
  const worldDeposits = createSectorWorldDeposits();
  const starterDeposit = worldDeposits.find((d) => d.id === 'starter_deposit')!;

  const baseX = starterDeposit.x;
  const baseY = starterDeposit.y;

  const miner = createMachineNode('miner_mk1', baseX + 408, baseY, 'starter_miner', 'mine_iron');
  const smelter = createMachineNode(
    'smelter',
    baseX + 816,
    baseY,
    'starter_smelter',
    'smelt_iron'
  );
  const constructorNode = createMachineNode(
    'constructor',
    baseX + 1224,
    baseY,
    'starter_constructor',
    'construct_iron_plate'
  );
  // Place starter_hub at baseY + 24 so its Input 1 (+72px) sits at baseY + 96px,
  // forming a 100% straight horizontal conveyor belt from starter_constructor!
  const hub = createMachineNode('the_hub', baseX + 1632, baseY + 24, 'starter_hub', null);

  const rawConns: ConveyorConnection[] = [
    {
      id: 'conn_starter_1',
      fromNodeId: starterDeposit.id,
      fromPortId: starterDeposit.outputs[0].id,
      toNodeId: miner.id,
      toPortId: miner.inputs[0].id,
      beltTier: 1,
      itemName: 'Iron Ore',
      ratePerMin: 60,
      maxCapacityPerMin: 60,
      firstItemArrived: true,
    },
    {
      id: 'conn_starter_2',
      fromNodeId: miner.id,
      fromPortId: miner.outputs[0].id,
      toNodeId: smelter.id,
      toPortId: smelter.inputs[0].id,
      beltTier: 1,
      itemName: 'Iron Ore',
      ratePerMin: 60,
      maxCapacityPerMin: 60,
      firstItemArrived: true,
    },
    {
      id: 'conn_starter_3',
      fromNodeId: smelter.id,
      fromPortId: smelter.outputs[0].id,
      toNodeId: constructorNode.id,
      toPortId: constructorNode.inputs[0].id,
      beltTier: 1,
      itemName: 'Iron Ingot',
      ratePerMin: 30,
      maxCapacityPerMin: 60,
      firstItemArrived: true,
    },
    {
      id: 'conn_starter_4',
      fromNodeId: constructorNode.id,
      fromPortId: constructorNode.outputs[0].id,
      toNodeId: hub.id,
      toPortId: hub.inputs[0].id,
      beltTier: 1,
      itemName: 'Iron Plate',
      ratePerMin: 20,
      maxCapacityPerMin: 60,
      firstItemArrived: true,
    },
  ];

  return stepSimulation(
    [...worldDeposits, miner, smelter, constructorNode, hub],
    rawConns,
    0.016
  );
}

export function serializeSaveExport(slot: SaveSlot): string {
  return JSON.stringify(slot, null, 2);
}

export function parseSaveImport(rawJson: string): { slot?: SaveSlot; error?: string } {
  try {
    const parsed = JSON.parse(rawJson.trim());
    if (!parsed || typeof parsed !== 'object') {
      return { error: 'Invalid save JSON format.' };
    }
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.connections)) {
      return { error: 'Save data is missing nodes or connections arrays.' };
    }
    const now = Date.now();
    const slot: SaveSlot = {
      id: `slot_import_${now}`,
      sessionName:
        typeof parsed.sessionName === 'string' && parsed.sessionName.trim()
          ? parsed.sessionName.trim()
          : 'Imported Pioneer Sector',
      slotName:
        typeof parsed.slotName === 'string' && parsed.slotName.trim()
          ? parsed.slotName.trim()
          : 'Imported Save',
      kind: 'manual',
      updatedAt: now,
      nodes: ensureWorldDepositsPresent(parsed.nodes),
      connections: parsed.connections,
      camera: parsed.camera ?? { x: 40, y: 80, zoom: 0.9 },
    };
    return { slot };
  } catch {
    return { error: 'Could not parse JSON string. Please check your copied save data.' };
  }
}
