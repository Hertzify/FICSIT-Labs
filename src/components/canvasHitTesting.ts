import {
  distanceFromPointToPolyline,
  doesPathIntersectNode,
  getCachedConveyorRoute,
  getEffectiveObstacleBox,
  getPortWorldPosition,
  isMacroIconZoom,
  sampleOrthogonalPath,
} from '../game/rules';
import { ConveyorConnection, MachineNode, PortSocket } from '../game/types';

export interface PortHit {
  nodeId: string;
  port: PortSocket;
  x: number;
  y: number;
}

/**
 * Checks if any visible property in the Node Inspector panel has changed since the last snapshot,
 * preventing unnecessary React DOM re-renders when integer counts, rates, and status are unchanged.
 */
export function hasInspectorSnapshotChanged(
  prev: MachineNode | null,
  next: MachineNode
): boolean {
  if (!prev) return true;
  if (
    prev.id !== next.id ||
    prev.buildingId !== next.buildingId ||
    prev.recipeId !== next.recipeId ||
    prev.status !== next.status ||
    prev.efficiency !== next.efficiency ||
    prev.maxStoredCount !== next.maxStoredCount ||
    Math.floor(prev.storedCount ?? 0) !== Math.floor(next.storedCount ?? 0) ||
    prev.inputs.length !== next.inputs.length ||
    prev.outputs.length !== next.outputs.length
  ) {
    return true;
  }

  for (let i = 0; i < next.inputs.length; i++) {
    const pA = prev.inputs[i];
    const pB = next.inputs[i];
    if (
      pA.actualRatePerMin !== pB.actualRatePerMin ||
      pA.targetRatePerMin !== pB.targetRatePerMin ||
      pA.itemName !== pB.itemName ||
      pA.label !== pB.label ||
      pA.maxBuffer !== pB.maxBuffer ||
      Math.floor(pA.bufferedCount ?? 0) !== Math.floor(pB.bufferedCount ?? 0)
    ) {
      return true;
    }
  }

  for (let i = 0; i < next.outputs.length; i++) {
    const pA = prev.outputs[i];
    const pB = next.outputs[i];
    if (
      pA.actualRatePerMin !== pB.actualRatePerMin ||
      pA.targetRatePerMin !== pB.targetRatePerMin ||
      pA.itemName !== pB.itemName ||
      pA.label !== pB.label ||
      pA.maxBuffer !== pB.maxBuffer ||
      Math.floor(pA.bufferedCount ?? 0) !== Math.floor(pB.bufferedCount ?? 0)
    ) {
      return true;
    }
  }

  return false;
}

export function hasBeltSnapshotChanged(
  prev: ConveyorConnection | null,
  next: ConveyorConnection
): boolean {
  if (!prev) return true;
  const prevPkts = prev.inFlightItems ?? [];
  const nextPkts = next.inFlightItems ?? [];
  if (
    prev.id !== next.id ||
    prev.beltTier !== next.beltTier ||
    prev.maxCapacityPerMin !== next.maxCapacityPerMin ||
    prev.ratePerMin !== next.ratePerMin ||
    prev.sourceRatePerMin !== next.sourceRatePerMin ||
    prev.itemName !== next.itemName ||
    prev.isBackedUp !== next.isBackedUp ||
    (prev.waypoints?.length ?? 0) !== (next.waypoints?.length ?? 0) ||
    Math.round(prev.lengthPx ?? 0) !== Math.round(next.lengthPx ?? 0) ||
    prevPkts.length !== nextPkts.length
  ) {
    return true;
  }
  const prevStalled = prevPkts.filter((p) => p.stalled).length;
  const nextStalled = nextPkts.filter((p) => p.stalled).length;
  return prevStalled !== nextStalled;
}

export function findPortAtWorld(
  wx: number,
  wy: number,
  nodes: MachineNode[],
  zoom: number
): PortHit | null {
  const hitRadius = isMacroIconZoom(zoom) ? 24 : 18;
  for (let nIdx = nodes.length - 1; nIdx >= 0; nIdx--) {
    const node = nodes[nIdx];
    for (let i = 0; i < node.outputs.length; i++) {
      const pt = getPortWorldPosition(node, 'output', i, node.outputs.length);
      if (Math.hypot(wx - pt.x, wy - pt.y) <= hitRadius) {
        return { nodeId: node.id, port: node.outputs[i], x: pt.x, y: pt.y };
      }
    }
    for (let i = 0; i < node.inputs.length; i++) {
      const pt = getPortWorldPosition(node, 'input', i, node.inputs.length);
      if (Math.hypot(wx - pt.x, wy - pt.y) <= hitRadius) {
        return { nodeId: node.id, port: node.inputs[i], x: pt.x, y: pt.y };
      }
    }
  }
  return null;
}

export function findNodeAtWorld(
  wx: number,
  wy: number,
  nodes: MachineNode[],
  zoom: number
): MachineNode | null {
  const macro = isMacroIconZoom(zoom);
  // Pass 1: Check non-deposit factory buildings first (so a Miner Mk.1 mounted on a deposit is always hit first!)
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.buildingId === 'resource_deposit') continue;
    if (wx >= n.x && wx <= n.x + n.width && wy >= n.y && wy <= n.y + n.height) {
      return n;
    }
  }
  // Pass 2: Check natural ground resource deposits
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.buildingId !== 'resource_deposit') continue;
    if (macro) {
      const cx = n.x + n.width * 0.5;
      const cy = n.y + n.height * 0.5;
      if (Math.hypot(wx - cx, wy - cy) <= 125) {
        return n;
      }
    }
    if (wx >= n.x && wx <= n.x + n.width && wy >= n.y && wy <= n.y + n.height) {
      return n;
    }
  }
  return null;
}

export function findBeltAtWorld(
  wx: number,
  wy: number,
  nodes: MachineNode[],
  connections: ConveyorConnection[],
  zoom: number,
  showPortRates: boolean
): ConveyorConnection | null {
  const macro = isMacroIconZoom(zoom);
  const hitRadius = macro ? 22 : 13;
  const nodeById = new Map<string, MachineNode>();
  for (const n of nodes) {
    nodeById.set(n.id, n);
  }

  let bestConn: ConveyorConnection | null = null;
  let bestDist = hitRadius;

  for (let i = connections.length - 1; i >= 0; i--) {
    const conn = connections[i];
    const fn = nodeById.get(conn.fromNodeId);
    const tn = nodeById.get(conn.toNodeId);
    if (!fn || !tn) continue;
    const outIdx = fn.outputs.findIndex((p) => p.id === conn.fromPortId);
    const inIdx = tn.inputs.findIndex((p) => p.id === conn.toPortId);
    if (outIdx < 0 || inIdx < 0) continue;

    const route = getCachedConveyorRoute(fn, outIdx, tn, inIdx, nodes, conn.waypoints);
    if (!route || route.pts.length < 2) continue;

    // Fast bounding-box rejection before computing point-to-polyline distance
    if (
      wx < route.minX - 60 ||
      wx > route.maxX + 60 ||
      wy < route.minY - 60 ||
      wy > route.maxY + 60
    ) {
      continue;
    }

    // Also check the floating midpoint rate badge box
    if (!macro && showPortRates) {
      const mid = sampleOrthogonalPath(route.pts, 0.5);
      const badgeX = mid.x;
      const badgeY = mid.y - 22;
      if (Math.abs(wx - badgeX) <= 46 && Math.abs(wy - badgeY) <= 12) {
        return conn;
      }
    }

    const dist = distanceFromPointToPolyline(wx, wy, route.pts);
    if (dist <= bestDist) {
      bestDist = dist;
      bestConn = conn;
    }
  }
  return bestConn;
}

export function findWaypointAtWorld(
  wx: number,
  wy: number,
  connections: ConveyorConnection[],
  zoom: number
): { conn: ConveyorConnection; index: number; point: { x: number; y: number } } | null {
  const hitRadius = isMacroIconZoom(zoom) ? 22 : 14;
  for (let i = connections.length - 1; i >= 0; i--) {
    const conn = connections[i];
    if (!conn.waypoints) continue;
    for (let wi = 0; wi < conn.waypoints.length; wi++) {
      const wp = conn.waypoints[wi];
      if (Math.hypot(wx - wp.x, wy - wp.y) <= hitRadius) {
        return { conn, index: wi, point: wp };
      }
    }
  }
  return null;
}

export function getClosestPointOnBelt(
  wx: number,
  wy: number,
  conn: ConveyorConnection,
  nodes: MachineNode[]
): { x: number; y: number; dist: number; insertIndex: number } | null {
  const fn = nodes.find((n) => n.id === conn.fromNodeId);
  const tn = nodes.find((n) => n.id === conn.toNodeId);
  if (!fn || !tn) return null;
  const outIdx = fn.outputs.findIndex((p) => p.id === conn.fromPortId);
  const inIdx = tn.inputs.findIndex((p) => p.id === conn.toPortId);
  if (outIdx < 0 || inIdx < 0) return null;

  const route = getCachedConveyorRoute(fn, outIdx, tn, inIdx, nodes, conn.waypoints);
  if (!route || route.pts.length < 2) return null;

  const getPointProgressAlongRoute = (px: number, py: number) => {
    let minDist = Infinity;
    let bestProgress = 0;
    let bestProj = { x: px, y: py };
    let cumLen = 0;

    for (let i = 1; i < route.pts.length; i++) {
      const p1 = route.pts[i - 1];
      const p2 = route.pts[i];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const segLen = Math.hypot(dx, dy);
      const lenSq = segLen * segLen;
      let t = 0;
      let projX = p1.x;
      let projY = p1.y;
      if (lenSq > 1e-6) {
        t = Math.max(0.05, Math.min(0.95, ((px - p1.x) * dx + (py - p1.y) * dy) / lenSq));
        projX = p1.x + t * dx;
        projY = p1.y + t * dy;
      }
      const d = Math.hypot(px - projX, py - projY);
      if (d < minDist) {
        minDist = d;
        bestProj = { x: projX, y: projY };
        bestProgress = cumLen + t * segLen;
      }
      cumLen += segLen;
    }
    return { x: bestProj.x, y: bestProj.y, dist: minDist, progress: bestProgress };
  };

  const hit = getPointProgressAlongRoute(wx, wy);
  const existingWps = conn.waypoints ?? [];
  let insertIndex = existingWps.length;
  if (existingWps.length > 0) {
    let countBefore = 0;
    for (let k = 0; k < existingWps.length; k++) {
      const wpProg = getPointProgressAlongRoute(existingWps[k].x, existingWps[k].y).progress;
      if (wpProg < hit.progress) {
        countBefore = k + 1;
      }
    }
    insertIndex = countBefore;
  }

  return { x: hit.x, y: hit.y, dist: hit.dist, insertIndex };
}

/**
 * Checks whether a candidate machine node overlaps any conveyor corner dot or any active conveyor belt path.
 */
export function doesCandidateNodeOverlapBeltsOrDots(
  candNode: Pick<MachineNode, 'id' | 'buildingId' | 'x' | 'y' | 'width' | 'height'>,
  allNodesWithCand: MachineNode[],
  connections: ConveyorConnection[]
): boolean {
  const box = getEffectiveObstacleBox(candNode as MachineNode);
  // 1. Check if any corner dot lies inside the candidate node footprint
  for (const c of connections) {
    if (!c.waypoints) continue;
    for (const wp of c.waypoints) {
      if (
        wp.x >= box.x - 12 &&
        wp.x <= box.x + box.width + 12 &&
        wp.y >= box.y - 12 &&
        wp.y <= box.y + box.height + 12
      ) {
        return true;
      }
    }
  }

  // 2. Check if any conveyor belt path cuts through the candidate node
  const nodeById = new Map<string, MachineNode>();
  for (const n of allNodesWithCand) {
    nodeById.set(n.id, n);
  }

  for (const c of connections) {
    if (c.fromNodeId === candNode.id || c.toNodeId === candNode.id) continue;
    const fn = nodeById.get(c.fromNodeId);
    const tn = nodeById.get(c.toNodeId);
    if (!fn || !tn) continue;
    const outIdx = fn.outputs.findIndex((p) => p.id === c.fromPortId);
    const inIdx = tn.inputs.findIndex((p) => p.id === c.toPortId);
    if (outIdx < 0 || inIdx < 0) continue;
    const route = getCachedConveyorRoute(
      fn,
      outIdx,
      tn,
      inIdx,
      allNodesWithCand,
      c.waypoints
    );
    if (doesPathIntersectNode(route.pts, candNode as MachineNode, 8)) {
      return true;
    }
  }
  return false;
}
