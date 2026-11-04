import { BUILDINGS } from './catalog';
import { getPortOffsetY, getPortWorldPosition, isMinerDirectlyOnDeposit, snapToGrid } from './geometry';
import { ConveyorConnection, MachineNode } from './types';

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
 * Maximum local edge-to-edge proximity (in world pixels) for Satisfactory-style
 * magnetic Snap Mode and alignment laser guidelines (240px = 16 meters / 10 grid cells).
 * Buildings further away than this threshold will not snap or project laser lines.
 */
export const MAX_SNAP_PROXIMITY_PX = 240;

export function getBoxEdgeGap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): { hGap: number; vGap: number; isWithinLocalProximity: boolean } {
  const hGap = Math.max(0, a.x - (b.x + b.width), b.x - (a.x + a.width));
  const vGap = Math.max(0, a.y - (b.y + b.height), b.y - (a.y + a.height));
  return {
    hGap,
    vGap,
    isWithinLocalProximity:
      hGap <= MAX_SNAP_PROXIMITY_PX && vGap <= MAX_SNAP_PROXIMITY_PX,
  };
}

/**
 * Satisfactory-style Smart Snap Mode resolver (Bounded Local Range):
 * Snaps a dragged or ghost-preview building ONLY to nearby neighbors within 240px (16m):
 * 1. Connected input/output ports within local proximity (highest priority so wired belts lock 100% straight)
 * 2. Nearby compatible input/output ports within local proximity
 * 3. Nearby building centerlines / edges within local proximity
 * 4. Standard 24px blueprint world grid fallback
 * Also emits active visual laser guidelines strictly culled to the 240px neighborhood.
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

  // Priority 0: In Satisfactory, a Miner Mk.1 ALWAYS snaps directly and concentrically onto an unoccupied Resource Deposit!
  if (candidate.buildingId === 'miner_mk1') {
    const hasWorldDeposits = nodes.some((n) => n.buildingId === 'resource_deposit');
    let bestDeposit: MachineNode | null = null;
    let bestDist = Infinity;

    for (const n of nodes) {
      if (n.buildingId !== 'resource_deposit') continue;
      const isOccupied = nodes.some(
        (other) =>
          other.buildingId === 'miner_mk1' &&
          other.id !== candidate.id &&
          isMinerDirectlyOnDeposit(other, n, 16)
      );
      if (isOccupied) continue;
      const dist = Math.hypot(
        candidate.x + candidate.width * 0.5 - (n.x + n.width * 0.5),
        candidate.y + candidate.height * 0.5 - (n.y + n.height * 0.5)
      );
      if (dist <= 220 && dist < bestDist) {
        bestDist = dist;
        bestDeposit = n;
      }
    }

    if (bestDeposit) {
      const snapX = bestDeposit.x + Math.round((bestDeposit.width - candidate.width) * 0.5);
      const snapY = bestDeposit.y + Math.round((bestDeposit.height - candidate.height) * 0.5);
      return {
        x: snapX,
        y: snapY,
        snappedX: true,
        snappedY: true,
        guidelines: [
          {
            axis: 'horizontal',
            kind: 'center',
            x1: snapX - 30,
            y1: snapY + candidate.height * 0.5,
            x2: snapX + candidate.width + 30,
            y2: snapY + candidate.height * 0.5,
            color: '#10B981',
            label: 'MINER MOUNT LOCK',
          },
        ],
      };
    }

    if (hasWorldDeposits) {
      return {
        x: baseX,
        y: baseY,
        snappedX: false,
        snappedY: false,
        guidelines: [],
      };
    }
  }

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

  let finalX = baseX;
  let finalY = baseY;
  let snappedX = false;
  let snappedY = false;

  // ---------------------------------------------------------------------------
  // 1. Evaluate Y-Axis Snap (Connected Ports -> Nearby Compatible Ports -> Center Y)
  //    All candidates must lie within MAX_SNAP_PROXIMITY_PX (240px) edge-to-edge!
  // ---------------------------------------------------------------------------
  let bestYDiff = PORT_SNAP_THRESHOLD + 1;
  let bestTargetY: number | null = null;

  // Priority 1A: Connected Ports (if dragging an existing wired node within local range)
  if (candidate.id) {
    const attachedConns = connections.filter(
      (c) => c.toNodeId === candidate.id || c.fromNodeId === candidate.id
    );
    for (const conn of attachedConns) {
      if (conn.toNodeId === candidate.id) {
        const srcNode = nodes.find((n) => n.id === conn.fromNodeId);
        if (!srcNode) continue;
        const gap = getBoxEdgeGap(candidate, srcNode);
        if (!gap.isWithinLocalProximity) continue;

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
        const gap = getBoxEdgeGap(candidate, dstNode);
        if (!gap.isWithinLocalProximity) continue;

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

  // Priority 1B: Nearby Compatible Ports in Local Corridor (<= 240px)
  if (bestTargetY === null) {
    let bestHorizDist = Infinity;
    for (const other of nodes) {
      if (candidate.id && other.id === candidate.id) continue;
      const gap = getBoxEdgeGap(candidate, other);
      if (!gap.isWithinLocalProximity) continue;

      // Other node is to the left -> match other's outputs to candidate's inputs
      if (other.x + other.width <= candidate.x + 60 && inCount > 0 && other.outputs.length > 0) {
        const hDist = gap.hGap;
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

      // Other node is to the right -> match other's inputs to candidate's outputs
      if (other.x >= candidate.x + candidate.width - 60 && outCount > 0 && other.inputs.length > 0) {
        const hDist = gap.hGap;
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

  // Priority 1C: Nearby Building Center Y (<= 240px)
  if (bestTargetY === null) {
    let bestCenterDiff = CENTER_SNAP_THRESHOLD + 1;
    for (const other of nodes) {
      if (candidate.id && other.id === candidate.id) continue;
      const gap = getBoxEdgeGap(candidate, other);
      if (!gap.isWithinLocalProximity) continue;

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
  // 2. Evaluate X-Axis Snap (Vertical Column Alignment with Nearby Buildings <= 240px)
  // ---------------------------------------------------------------------------
  let bestXDiff = CENTER_SNAP_THRESHOLD + 1;
  let bestTargetX: number | null = null;
  for (const other of nodes) {
    if (candidate.id && other.id === candidate.id) continue;
    const gap = getBoxEdgeGap({ ...candidate, y: finalY }, other);
    if (!gap.isWithinLocalProximity) continue;

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
  // 3. Emit Active Visual Laser Guidelines ONLY for Local Neighbors (<= 240px)
  // ---------------------------------------------------------------------------
  const guidelines: SnapGuideline[] = [];
  const alignedNodeIdsH = new Set<string>();
  const snappedCandBox = {
    x: finalX,
    y: finalY,
    width: candidate.width,
    height: candidate.height,
  };

  for (const other of nodes) {
    if (candidate.id && other.id === candidate.id) continue;
    const gap = getBoxEdgeGap(snappedCandBox, other);
    if (!gap.isWithinLocalProximity) continue;

    const isConnectedToOther =
      Boolean(candidate.id) &&
      connections.some(
        (c) =>
          (c.fromNodeId === other.id && c.toNodeId === candidate.id) ||
          (c.fromNodeId === candidate.id && c.toNodeId === other.id)
      );

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

    // Vertical center alignment guideline
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

  return {
    x: finalX,
    y: finalY,
    snappedX,
    snappedY,
    guidelines,
  };
}
