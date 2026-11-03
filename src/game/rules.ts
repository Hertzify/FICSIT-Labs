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

export function getPortWorldPosition(
  node: MachineNode,
  side: 'input' | 'output',
  index: number,
  total: number
): { x: number; y: number } {
  const topArea = 56;
  const bottomArea = node.height - 24;
  const usableHeight = Math.max(32, bottomArea - topArea);
  const step = usableHeight / (total + 1);
  const py = node.y + topArea + step * (index + 1);
  const px = side === 'input' ? node.x : node.x + node.width;
  return { x: px, y: py };
}

export function computeConveyorLengthPx(
  fromNode: MachineNode,
  outIdx: number,
  toNode: MachineNode,
  inIdx: number
): number {
  const p1 = getPortWorldPosition(fromNode, 'output', Math.max(0, outIdx), fromNode.outputs.length);
  const p2 = getPortWorldPosition(toNode, 'input', Math.max(0, inIdx), toNode.inputs.length);
  const straightDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  return Math.max(72, Math.round(straightDist * 1.08));
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
  pad = 4
): boolean {
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);

  const bL = box.x - pad;
  const bR = box.x + box.width + pad;
  const bT = box.y - pad;
  const bB = box.y + box.height + pad;

  // Horizontal segment
  if (Math.abs(p1.y - p2.y) < 1e-4) {
    return p1.y >= bT && p1.y <= bB && maxX >= bL && minX <= bR;
  }
  // Vertical segment
  if (Math.abs(p1.x - p2.x) < 1e-4) {
    return p1.x >= bL && p1.x <= bR && maxY >= bT && minY <= bB;
  }
  return maxX >= bL && minX <= bR && maxY >= bT && minY <= bB;
}

/**
 * Checks if any segment of an orthogonal conveyor path intersects a machine node.
 */
export function doesPathIntersectNode(
  path: { x: number; y: number }[],
  node: MachineNode,
  pad = 4
): boolean {
  for (let i = 1; i < path.length; i++) {
    if (doesSegmentIntersectBox(path[i - 1], path[i], node, pad)) {
      return true;
    }
  }
  return false;
}

/**
 * Computes a clean 90-degree orthogonal conveyor belt path between ports,
 * actively routing around obstacle nodes so belts never go over machine nodes.
 */
export function computeOrthogonalConveyorPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obstacles: MachineNode[] = []
): { x: number; y: number }[] {
  const pad = 10;
  const isSegmentBlocked = (pA: { x: number; y: number }, pB: { x: number; y: number }) => {
    return obstacles.some((obs) => doesSegmentIntersectBox(pA, pB, obs, pad));
  };

  // Standard forward routing: S-bend with vertical corridor
  if (x2 >= x1 + 36) {
    const midX = x1 + (x2 - x1) * 0.5;
    const pA = { x: x1, y: y1 };
    const pB = { x: midX, y: y1 };
    const pC = { x: midX, y: y2 };
    const pD = { x: x2, y: y2 };

    if (!isSegmentBlocked(pA, pB) && !isSegmentBlocked(pB, pC) && !isSegmentBlocked(pC, pD)) {
      return [pA, pB, pC, pD];
    }

    // Try shifting midX to the left or right of colliding obstacles
    const colliding = obstacles.filter((obs) => doesSegmentIntersectBox(pB, pC, obs, pad));
    for (const obs of colliding) {
      const leftX = obs.x - 20;
      if (leftX > x1 + 16 && leftX < x2 - 16) {
        const altB = { x: leftX, y: y1 };
        const altC = { x: leftX, y: y2 };
        if (!isSegmentBlocked(pA, altB) && !isSegmentBlocked(altB, altC) && !isSegmentBlocked(altC, pD)) {
          return [pA, altB, altC, pD];
        }
      }
      const rightX = obs.x + obs.width + 20;
      if (rightX > x1 + 16 && rightX < x2 - 16) {
        const altB = { x: rightX, y: y1 };
        const altC = { x: rightX, y: y2 };
        if (!isSegmentBlocked(pA, altB) && !isSegmentBlocked(altB, altC) && !isSegmentBlocked(altC, pD)) {
          return [pA, altB, altC, pD];
        }
      }
    }

    // If still blocked, route around obstacles vertically (above or below)
    const minYObs = obstacles.length > 0 ? Math.min(...obstacles.map((o) => o.y)) - 28 : y1 - 40;
    const maxYObs = obstacles.length > 0 ? Math.max(...obstacles.map((o) => o.y + o.height)) + 28 : y2 + 40;
    const detourY = Math.abs(y1 - minYObs) < Math.abs(y1 - maxYObs) ? minYObs : maxYObs;
    return [
      { x: x1, y: y1 },
      { x: x1 + 18, y: y1 },
      { x: x1 + 18, y: detourY },
      { x: x2 - 18, y: detourY },
      { x: x2 - 18, y: y2 },
      { x: x2, y: y2 },
    ];
  }

  // Backward, vertical, or tight alignment: route around
  const detourY = y1 <= y2 ? Math.min(y1, y2) - 44 : Math.max(y1, y2) + 44;
  return [
    { x: x1, y: y1 },
    { x: x1 + 22, y: y1 },
    { x: x1 + 22, y: detourY },
    { x: x2 - 22, y: detourY },
    { x: x2 - 22, y: y2 },
    { x: x2, y: y2 },
  ];
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
          isWorldDeposit: true,
        };
      }
    }
    return n;
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
        ? computeConveyorLengthPx(fromNode, outIdx, toNode, inIdx)
        : c.lengthPx ?? 240;
    const travelTimeSec = Number((lengthPx / tierDef.speedPxPerSec).toFixed(2));

    // If a node was dragged further away, items on the belt must travel the additional distance
    const wasStretchedFurther =
      c.lengthPx !== undefined && lengthPx > c.lengthPx + 36;
    const isLegacyInstantConn =
      c.firstItemArrived === undefined && c.inFlightItems === undefined;

    let inFlightItems: BeltItemPacket[] = c.inFlightItems
      ? c.inFlightItems.map((pkt) => ({ ...pkt }))
      : [];

    let firstItemArrived = wasStretchedFurther
      ? false
      : c.firstItemArrived ?? isLegacyInstantConn;

    return {
      ...c,
      beltTier: tierDef.tier,
      maxCapacityPerMin: tierDef.capacityPerMin,
      lengthPx,
      travelTimeSec,
      spawnAccumulator: c.spawnAccumulator ?? (isLegacyInstantConn ? 0.5 : 1),
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

    const expectedSteadyCount =
      enteringRate > 0 ? Math.max(1, Math.floor(lengthPx / idealSpacingPx)) : 0;

    // Pre-populate or migrate legacy sparse belts that already settled (firstItemArrived = true)
    if (
      conn.firstItemArrived &&
      enteringRate > 0 &&
      (items.length === 0 || items.length < Math.floor(expectedSteadyCount * 0.6))
    ) {
      items.length = 0;
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
        arrivedThisTick = true;
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

    // If firstItemArrived just flipped true on this tick, immediately update destination port rate
    if (arrivedThisTick && enteringRate > 0) {
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
  const hub = createMachineNode('the_hub', baseX + 1632, baseY - 12, 'starter_hub', null);

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
