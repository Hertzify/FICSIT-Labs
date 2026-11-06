/**
 * ============================================================================
 * MODULE INDEX: Discrete Item Simulation Engine (`src/game/simulation.ts`)
 * ============================================================================
 * [Lines 032-135] stepSimulation Setup & Pre-Indexing (Nodes, Mounted Miners, Belt Lengths)
 * [Lines 137-196] Starter Belt Population (Pre-settled `inFlightItems` initialization)
 * [Lines 198-496] Discrete Sub-Stepping Loop (`SUB_STEP_MAX = 0.05s`):
 *   - Step A (lines 204-322): Physical belt item movement & 18px bumper-to-bumper backpressure
 *   - Step B (lines 324-456): Machine crafting cycles & integer input/output buffer updates
 *   - Step C (lines 458-548): Pulling discrete items from node output buffer onto belt entrance
 * [Lines 550-650] Post-Tick Drain Detection, Steady-State Telemetry & Rolling Productivity Display
 * ============================================================================
 */

import {
  BELT_ITEM_FOOTPRINT_PX,
  PURITY_CONFIG,
  RECIPES,
} from './catalog';
import { computeConveyorLengthPx, isMinerDirectlyOnDeposit } from './geometry';
import {
  computeDestPortMaxAcceptRate,
  getRecipeInputCountPerCycle,
  getRecipeOutputCountPerCycle,
  isBeltPackedBackToSource,
  normalizeNodeStorageCapacities,
  propagateSteadyStateTelemetry,
} from './simulationTelemetry';
import { BeltItemPacket, ConveyorConnection, MachineNode } from './types';
import { getBeltTierDef } from './world';

let packetIdCounter = 0;

/**
 * Pure discrete-item simulation tick:
 * - Every resource icon on a conveyor belt (`BeltItemPacket`) is an actual discrete integer item:
 *   - Pulling an item onto a belt entrance (`distancePx = 0`) removes 1 discrete item (`-1`) from the
 *     source node's Output Storage (`node.storedCount`).
 *   - Moving an item into a destination port (`distancePx >= lengthPx`) adds 1 discrete item (`+1`) to
 *     the destination node's Input Storage (`inPort.bufferedCount`), ONLY if there is at least 1 free spot
 *     (`inPort.bufferedCount < inPort.maxBuffer`, e.g. `<= 99/100`).
 *   - Production machines consume discrete integer inputs and produce discrete integer outputs when
 *     each crafting cycle (`node.progress >= 1.0`) completes.
 * - Authentic Satisfactory backpressure: when a destination node's Input Storage is full (e.g. `100/100`),
 *   arriving belt items cannot enter and physically stop at `distancePx = lengthPx`, causing all trailing
 *   items on the belt to line up bumper-to-bumper (`18px` = `1.2m` spacing).
 */
export function stepSimulation(
  nodes: MachineNode[],
  connections: ConveyorConnection[],
  rawDt: number
): { nodes: MachineNode[]; connections: ConveyorConnection[] } {
  const dt = Number.isFinite(rawDt) ? Math.min(Math.max(rawDt, 0), 1.0) : 0;

  const prevNodeStateById = new Map<
    string,
    { status: MachineNode['status']; avgEfficiency?: number }
  >();
  for (const n of nodes) {
    prevNodeStateById.set(n.id, {
      status: n.status,
      avgEfficiency: n.avgEfficiency,
    });
  }

  const nextNodes: MachineNode[] = nodes.map((n) => ({
    ...n,
    inputs: n.inputs.map((p) => ({ ...p, actualRatePerMin: 0 })),
    outputs: n.outputs.map((p) => ({ ...p, actualRatePerMin: 0 })),
  }));

  const nodeMap = new Map<string, MachineNode>();
  const depositNodes: MachineNode[] = [];
  const minerNodes: MachineNode[] = [];
  for (const n of nextNodes) {
    nodeMap.set(n.id, n);
    if (n.buildingId === 'resource_deposit') {
      depositNodes.push(n);
    } else if (n.buildingId === 'miner_mk1') {
      minerNodes.push(n);
    }
  }

  // Pre-index which Miner Mk.1 is mounted on which Resource Deposit (1 miner max per deposit) in O(M * D)
  const mountedDepositByMinerId = new Map<string, MachineNode>();
  const claimedDepositIds = new Set<string>();
  for (const miner of minerNodes) {
    for (const dep of depositNodes) {
      if (!claimedDepositIds.has(dep.id) && isMinerDirectlyOnDeposit(miner, dep, 4)) {
        claimedDepositIds.add(dep.id);
        mountedDepositByMinerId.set(miner.id, dep);
        break;
      }
    }
  }

  const preSettledConnIds = new Set<string>();

  // Normalize connections with Belt Tier metadata & cached physical belt length
  const nextConns: ConveyorConnection[] = connections.map((c) => {
    const tierDef = getBeltTierDef(c.beltTier, c.maxCapacityPerMin);
    const fromNode = nodeMap.get(c.fromNodeId);
    const toNode = nodeMap.get(c.toNodeId);
    const outIdx = fromNode ? fromNode.outputs.findIndex((p) => p.id === c.fromPortId) : 0;
    const inIdx = toNode ? toNode.inputs.findIndex((p) => p.id === c.toPortId) : 0;
    const lengthPx =
      fromNode && toNode
        ? computeConveyorLengthPx(fromNode, outIdx, toNode, inIdx, nextNodes, c.waypoints)
        : c.lengthPx ?? 240;
    const travelTimeSec = Number((lengthPx / tierDef.speedPxPerSec).toFixed(2));

    const wasStretchedFurther =
      c.lengthPx !== undefined && lengthPx > c.lengthPx + 0.5;
    const isPreSettledUnpopulated =
      c.inFlightItems === undefined && (c.firstItemArrived ?? true);
    if (isPreSettledUnpopulated) {
      preSettledConnIds.add(c.id);
    }

    const inFlightItems: BeltItemPacket[] = c.inFlightItems
      ? c.inFlightItems.map((pkt) => ({ ...pkt }))
      : [];

    const firstItemArrived = wasStretchedFurther
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
      isBackedUp: wasStretchedFurther ? false : Boolean(c.isBackedUp),
    };
  });

  // Pre-index connections by port key and node ID for O(1) lookup across all simulation passes
  const incomingConnByPortKey = new Map<string, ConveyorConnection>();
  const outgoingConnByPortKey = new Map<string, ConveyorConnection>();
  const outgoingConnsByNodeId = new Map<string, ConveyorConnection[]>();

  for (const conn of nextConns) {
    incomingConnByPortKey.set(`${conn.toNodeId}:${conn.toPortId}`, conn);
    outgoingConnByPortKey.set(`${conn.fromNodeId}:${conn.fromPortId}`, conn);
    const list = outgoingConnsByNodeId.get(conn.fromNodeId);
    if (list) {
      list.push(conn);
    } else {
      outgoingConnsByNodeId.set(conn.fromNodeId, [conn]);
    }
  }

  normalizeNodeStorageCapacities(nextNodes);

  // Initial telemetry pass so pre-settled starter belts know their item names & spacing
  propagateSteadyStateTelemetry(
    nextNodes,
    nextConns,
    nodeMap,
    mountedDepositByMinerId,
    incomingConnByPortKey,
    outgoingConnByPortKey,
    outgoingConnsByNodeId
  );

  // Populate initial starter belts (`inFlightItems === undefined` with `firstItemArrived === true`)
  for (const conn of nextConns) {
    if (!preSettledConnIds.has(conn.id)) continue;
    const tierDef = getBeltTierDef(conn.beltTier, conn.maxCapacityPerMin);
    const lengthPx = conn.lengthPx ?? 240;
    const fromNode = nodeMap.get(conn.fromNodeId);
    const toNode = nodeMap.get(conn.toNodeId);
    const outPort = fromNode?.outputs.find((p) => p.id === conn.fromPortId);
    const inPort = toNode?.inputs.find((p) => p.id === conn.toPortId);

    const rawSupplyRate = outPort
      ? Math.min(conn.maxCapacityPerMin, outPort.actualRatePerMin)
      : conn.sourceRatePerMin ?? 60;
    const spacingRate = Math.max(conn.sourceRatePerMin ?? 0, rawSupplyRate, 20);
    const rawSpacing =
      (tierDef.speedPxPerSec * 60) / Math.max(1, Math.min(tierDef.capacityPerMin, spacingRate));
    const idealSpacingPx = Number.isFinite(rawSpacing)
      ? Math.max(BELT_ITEM_FOOTPRINT_PX, rawSpacing)
      : BELT_ITEM_FOOTPRINT_PX;
    const itemName = conn.itemName ?? outPort?.itemName ?? 'Iron Ore';
    const items: BeltItemPacket[] = [];

    for (
      let dist = Math.min(lengthPx, 8000) - idealSpacingPx * 0.5;
      dist >= 0 && items.length < 300;
      dist -= idealSpacingPx
    ) {
      items.push({
        id: `${conn.id}_init_${Math.round(dist * 10)}`,
        itemName,
        distancePx: Number(dist.toFixed(2)),
        stalled: false,
      });
    }
    conn.inFlightItems = items;
    conn.spawnAccumulator = 0.5;

    if (
      toNode &&
      inPort &&
      Math.round(inPort.bufferedCount ?? 0) === 0 &&
      Math.round(toNode.storedCount ?? 0) === 0
    ) {
      const recipe = toNode.recipeId ? RECIPES[toNode.recipeId] : null;
      if (recipe) {
        const inIdx = toNode.inputs.findIndex((p) => p.id === inPort.id);
        const req = recipe.inputs[Math.max(0, inIdx)];
        const reqCount = req
          ? getRecipeInputCountPerCycle(req.ratePerMin, recipe.cycleTimeSec)
          : 1;
        inPort.bufferedCount = reqCount;
        inPort.itemName = itemName;
      }
    }
    if (
      fromNode &&
      fromNode.buildingId !== 'resource_deposit' &&
      Math.round(fromNode.storedCount ?? 0) === 0
    ) {
      fromNode.storedCount = 1;
      if (outPort) outPort.bufferedCount = 1;
    }
  }

  // Run Discrete Item Sub-Stepping (<= 50ms per sub-step for exact physical belt collision & discrete crafting)
  if (dt > 0) {
    const SUB_STEP_MAX = 0.05;
    const numSubSteps = Math.max(1, Math.ceil(dt / SUB_STEP_MAX));
    const subDt = dt / numSubSteps;

    for (let stepIdx = 0; stepIdx < numSubSteps; stepIdx++) {
      // STEP A: Advance physical discrete items along each belt (`0 -> lengthPx`).
      for (const conn of nextConns) {
        const tierDef = getBeltTierDef(conn.beltTier, conn.maxCapacityPerMin);
        const lengthPx = conn.lengthPx ?? 240;
        const fromNode = nodeMap.get(conn.fromNodeId);
        const toNode = nodeMap.get(conn.toNodeId);
        const outPort = fromNode?.outputs.find((p) => p.id === conn.fromPortId);
        const inPort = toNode?.inputs.find((p) => p.id === conn.toPortId);

        const defaultItemName = conn.itemName ?? outPort?.itemName ?? 'Iron Ore';
        const items = conn.inFlightItems ?? [];
        for (let k = 1; k < items.length; k++) {
          if (items[k - 1].distancePx < items[k].distancePx) {
            items.sort((a, b) => b.distancePx - a.distancePx);
            break;
          }
        }

        const remaining: BeltItemPacket[] = [];
        let arrivedThisSubStep = false;
        let stalledAtExit = false;
        const stepPx = tierDef.speedPxPerSec * subDt;

        for (let i = 0; i < items.length; i++) {
          const pkt = items[i];
          if (!pkt.itemName) pkt.itemName = defaultItemName;
          const nextDist = pkt.distancePx + stepPx;

          if (remaining.length === 0) {
            if (nextDist >= lengthPx - 1e-4) {
              if (
                toNode &&
                inPort &&
                (toNode.buildingId === 'storage_container' ||
                  toNode.buildingId === 'the_hub' ||
                  toNode.buildingId === 'splitter' ||
                  toNode.buildingId === 'merger')
              ) {
                const maxMain = toNode.maxStoredCount ?? 100;
                let guard = 0;
                while (
                  guard++ < 250 &&
                  Math.round(inPort.bufferedCount ?? 0) >= 1 &&
                  Math.round(toNode.storedCount ?? 0) < maxMain
                ) {
                  inPort.bufferedCount = Math.round(inPort.bufferedCount ?? 0) - 1;
                  toNode.storedCount = Math.round(toNode.storedCount ?? 0) + 1;
                }
                for (const op of toNode.outputs) {
                  op.bufferedCount = toNode.storedCount;
                }
              }

              const portMax = inPort?.maxBuffer ?? 100;
              const curIn = Math.round(inPort?.bufferedCount ?? 0);
              const hasFreeSpot = !toNode || !inPort ? true : curIn + 1 <= portMax;

              if (hasFreeSpot) {
                arrivedThisSubStep = true;
                if (toNode && inPort) {
                  inPort.bufferedCount = curIn + 1;
                  inPort.itemName = pkt.itemName;
                  if (
                    toNode.buildingId === 'storage_container' ||
                    toNode.buildingId === 'the_hub' ||
                    toNode.buildingId === 'splitter' ||
                    toNode.buildingId === 'merger'
                  ) {
                    const maxMain = toNode.maxStoredCount ?? 100;
                    if (Math.round(toNode.storedCount ?? 0) < maxMain) {
                      inPort.bufferedCount = Math.max(
                        0,
                        Math.round(inPort.bufferedCount ?? 0) - 1
                      );
                      toNode.storedCount = Math.round(toNode.storedCount ?? 0) + 1;
                      for (const op of toNode.outputs) {
                        op.bufferedCount = toNode.storedCount;
                      }
                    }
                  }
                }
              } else {
                pkt.distancePx = Number(lengthPx.toFixed(2));
                pkt.stalled = true;
                stalledAtExit = true;
                remaining.push(pkt);
              }
            } else {
              pkt.distancePx = Number(nextDist.toFixed(2));
              pkt.stalled = false;
              remaining.push(pkt);
            }
          } else {
            const aheadPkt = remaining[remaining.length - 1];
            const maxAllowedDist = aheadPkt.distancePx - BELT_ITEM_FOOTPRINT_PX;
            if (nextDist >= maxAllowedDist - 0.05) {
              const clampedDist = Math.max(0, maxAllowedDist);
              pkt.distancePx = Number(clampedDist.toFixed(2));
              pkt.stalled = Boolean(aheadPkt.stalled);
            } else {
              pkt.distancePx = Number(nextDist.toFixed(2));
              pkt.stalled = false;
            }
            remaining.push(pkt);
          }
        }

        if (arrivedThisSubStep || stalledAtExit) {
          conn.firstItemArrived = true;
        }
        conn.inFlightItems = remaining;
        conn.isBackedUp = stalledAtExit;
      }

      // STEP B: Advance machine crafting cycles
      for (const node of nextNodes) {
        const recipe = node.recipeId ? RECIPES[node.recipeId] : null;
        if (!Number.isFinite(node.progress)) node.progress = 0;

        if (node.buildingId === 'resource_deposit') {
          const purityKey = node.purity ?? 'normal';
          const purityRate = (PURITY_CONFIG[purityKey] ?? PURITY_CONFIG.normal).ratePerMin;
          const outMax = node.maxStoredCount ?? 100;
          if (Math.round(node.storedCount ?? 0) < outMax) {
            node.progress = (node.progress ?? 0) + subDt * (purityRate / 60);
            let guard = 0;
            while (
              guard++ < 250 &&
              node.progress >= 1.0 - 1e-6 &&
              Math.round(node.storedCount ?? 0) < outMax
            ) {
              node.storedCount = Math.round(node.storedCount ?? 0) + 1;
              node.progress = Math.max(0, node.progress - 1.0);
            }
          } else {
            node.progress = Math.min(1.0, node.progress ?? 0);
          }
          if (node.outputs[0]) {
            node.outputs[0].bufferedCount = node.storedCount;
          }
        } else if (node.buildingId === 'miner_mk1') {
          const outPort = node.outputs[0];
          const outMax = node.maxStoredCount ?? 100;
          const deposit = mountedDepositByMinerId.get(node.id);

          if (!deposit || node.isStandby) {
            if (!deposit) {
              node.progress = 0;
            }
            if (outPort) {
              outPort.bufferedCount = node.storedCount;
            }
            continue;
          }

          const purityKey = deposit.purity ?? 'normal';
          const baseExtractRate = (PURITY_CONFIG[purityKey] ?? PURITY_CONFIG.normal).ratePerMin;
          const clockRatio = Math.max(0.01, (node.clockSpeedPct ?? 100) / 100);
          const extractRate = baseExtractRate * clockRatio;

          if (Math.round(node.storedCount ?? 0) < outMax) {
            node.progress = (node.progress ?? 0) + subDt * (extractRate / 60);
            let guard = 0;
            while (
              guard++ < 250 &&
              node.progress >= 1.0 - 1e-6 &&
              Math.round(node.storedCount ?? 0) < outMax
            ) {
              node.storedCount = Math.round(node.storedCount ?? 0) + 1;
              node.progress = Math.max(0, node.progress - 1.0);
            }
          } else {
            node.progress = 0;
          }
          if (outPort) {
            outPort.bufferedCount = node.storedCount;
          }
        } else if (
          node.buildingId === 'storage_container' ||
          node.buildingId === 'the_hub' ||
          node.buildingId === 'splitter' ||
          node.buildingId === 'merger'
        ) {
          const maxMain = node.maxStoredCount ?? 100;
          for (const inPort of node.inputs) {
            let guard = 0;
            while (
              guard++ < 250 &&
              Math.round(inPort.bufferedCount ?? 0) >= 1 &&
              Math.round(node.storedCount ?? 0) < maxMain
            ) {
              inPort.bufferedCount = Math.round(inPort.bufferedCount ?? 0) - 1;
              node.storedCount = Math.round(node.storedCount ?? 0) + 1;
            }
          }
          for (const op of node.outputs) {
            op.bufferedCount = node.storedCount;
          }
          node.progress = (node.efficiency ?? 0) > 0 ? 1 : 0;
        } else if (recipe) {
          if (node.isStandby) {
            continue;
          }
          const baseCycleSec = recipe.cycleTimeSec || 2.0;
          const clockRatio = Math.max(0.01, (node.clockSpeedPct ?? 100) / 100);
          const effectiveCycleSec = baseCycleSec / clockRatio;
          const outSpec = recipe.outputs[0];
          const outCount = getRecipeOutputCountPerCycle(
            outSpec?.ratePerMin ?? 30,
            baseCycleSec
          );
          const outMax = node.maxStoredCount ?? 100;

          const checkInputsReady = () =>
            recipe.inputs.every(
              (req, idx) =>
                Math.round(node.inputs[idx]?.bufferedCount ?? 0) >=
                getRecipeInputCountPerCycle(req.ratePerMin, baseCycleSec)
            );
          const checkOutputRoom = () =>
            Math.round(node.storedCount ?? 0) + outCount <= outMax;

          if (checkInputsReady() && checkOutputRoom()) {
            node.progress = (node.progress ?? 0) + subDt / effectiveCycleSec;
            let guard = 0;
            while (
              guard++ < 250 &&
              node.progress >= 1.0 - 1e-6 &&
              checkInputsReady() &&
              checkOutputRoom()
            ) {
              node.progress = Math.max(0, node.progress - 1.0);
              for (let idx = 0; idx < recipe.inputs.length; idx++) {
                const reqCount = getRecipeInputCountPerCycle(
                  recipe.inputs[idx].ratePerMin,
                  baseCycleSec
                );
                const port = node.inputs[idx];
                if (port) {
                  port.bufferedCount = Math.max(
                    0,
                    Math.round(port.bufferedCount ?? 0) - reqCount
                  );
                }
              }
              node.storedCount = Math.min(
                outMax,
                Math.round(node.storedCount ?? 0) + outCount
              );
              if (node.outputs[0]) {
                node.outputs[0].bufferedCount = node.storedCount;
              }
            }
          } else if (!checkOutputRoom()) {
            node.progress = 0;
          }
        }
      }

      // STEP C: Pull discrete items (`-1`) from each node's Output Storage onto outgoing belt entrances
      for (const fromNode of nextNodes) {
        const outConns = outgoingConnsByNodeId.get(fromNode.id);
        if (!outConns || outConns.length === 0) continue;

        for (const conn of outConns) {
          const tierDef = getBeltTierDef(conn.beltTier, conn.maxCapacityPerMin);
          const itemsPerSec = tierDef.capacityPerMin / 60;
          conn.spawnAccumulator = (conn.spawnAccumulator ?? 1.0) + itemsPerSec * subDt;
        }

        let pullSafety = 0;
        while (Math.round(fromNode.storedCount ?? 0) >= 1 && pullSafety < 16) {
          pullSafety++;
          let bestConn: ConveyorConnection | null = null;
          let bestClearancePx = -1;

          for (const conn of outConns) {
            if ((conn.spawnAccumulator ?? 0) < 1.0 - 1e-6) continue;
            const items = conn.inFlightItems ?? [];
            const lastPkt = items[items.length - 1];
            const clearancePx = lastPkt ? lastPkt.distancePx : Infinity;
            if (clearancePx >= BELT_ITEM_FOOTPRINT_PX - 0.05) {
              if (clearancePx > bestClearancePx) {
                bestClearancePx = clearancePx;
                bestConn = conn;
              }
            }
          }

          if (!bestConn) break;

          const tierDef = getBeltTierDef(
            bestConn.beltTier,
            bestConn.maxCapacityPerMin
          );
          const outPort = fromNode.outputs.find((p) => p.id === bestConn!.fromPortId);
          const itemName =
            outPort?.itemName ??
            bestConn.itemName ??
            fromNode.inputs.find((p) => p.itemName)?.itemName ??
            'Iron Ore';

          const items = bestConn.inFlightItems ?? [];
          const lastPkt = items[items.length - 1];
          const itemsPerSec = tierDef.capacityPerMin / 60;
          const overshootSec = Math.max(
            0,
            ((bestConn.spawnAccumulator ?? 1) - 1.0) / itemsPerSec
          );
          const desiredDist = Math.min(
            BELT_ITEM_FOOTPRINT_PX * 0.5,
            overshootSec * tierDef.speedPxPerSec
          );
          const maxAllowedDist = lastPkt
            ? lastPkt.distancePx - BELT_ITEM_FOOTPRINT_PX
            : desiredDist;
          const spawnDist = Math.max(0, Math.min(desiredDist, maxAllowedDist));

          fromNode.storedCount = Math.max(0, Math.round(fromNode.storedCount ?? 0) - 1);
          for (const op of fromNode.outputs) {
            op.bufferedCount = fromNode.storedCount;
          }

          bestConn.itemName = itemName;
          items.push({
            id: `${bestConn.id}_pkt_${++packetIdCounter}`,
            itemName,
            distancePx: Number(spawnDist.toFixed(2)),
            stalled: false,
          });
          bestConn.inFlightItems = items;
          bestConn.spawnAccumulator = Math.max(
            0,
            (bestConn.spawnAccumulator ?? 1) - 1.0
          );
        }

        for (const conn of outConns) {
          if ((conn.spawnAccumulator ?? 0) > 1.0) {
            conn.spawnAccumulator = 1.0;
          }
        }
      }
    }
  } else {
    // dt === 0 snapshot re-evaluation (e.g. after node placement or drag)
    for (const conn of nextConns) {
      const lengthPx = conn.lengthPx ?? 240;
      const items = conn.inFlightItems ?? [];
      items.sort((a, b) => b.distancePx - a.distancePx);
      for (const pkt of items) {
        pkt.distancePx = Math.min(lengthPx, pkt.distancePx);
      }
    }
  }

  for (const node of nextNodes) {
    node.maxInputStoredCount = node.inputs.reduce((acc, p) => acc + (p.maxBuffer ?? 0), 0);
    node.inputStoredCount = node.inputs.reduce(
      (acc, p) => acc + Math.round(p.bufferedCount ?? 0),
      0
    );
  }

  // Finalize belt drain detection & run steady-state telemetry propagation
  for (const conn of nextConns) {
    const remaining = conn.inFlightItems ?? [];
    const fromNode = nodeMap.get(conn.fromNodeId);
    const sourceStillActive =
      (conn.sourceRatePerMin ?? 0) > 0 ||
      Math.round(fromNode?.storedCount ?? 0) > 0 ||
      (fromNode?.progress ?? 0) > 0;

    if (remaining.length === 0 && !sourceStillActive && !conn.isBackedUp) {
      conn.firstItemArrived = false;
      conn.ratePerMin = 0;
    }
  }

  propagateSteadyStateTelemetry(
    nextNodes,
    nextConns,
    nodeMap,
    mountedDepositByMinerId,
    incomingConnByPortKey,
    outgoingConnByPortKey,
    outgoingConnsByNodeId
  );

  // Ensure any belt with a physically stalled front item at lengthPx reflects its backed-up state
  for (const conn of nextConns) {
    const remaining = conn.inFlightItems ?? [];
    const lengthPx = conn.lengthPx ?? 240;
    const hasStalledFrontItem =
      remaining.length > 0 &&
      Boolean(remaining[0].stalled) &&
      remaining[0].distancePx >= lengthPx - 1.5;

    if (hasStalledFrontItem) {
      conn.isBackedUp = true;
      const toNode = nodeMap.get(conn.toNodeId);
      const inPort = toNode?.inputs.find((p) => p.id === conn.toPortId);
      if (toNode && inPort) {
        const { destMaxAcceptRate } = computeDestPortMaxAcceptRate(
          conn,
          toNode,
          inPort,
          outgoingConnsByNodeId
        );
        conn.ratePerMin = Math.min(conn.sourceRatePerMin ?? 0, destMaxAcceptRate);
        inPort.actualRatePerMin = conn.ratePerMin;
      }
      if (isBeltPackedBackToSource(conn, true)) {
        conn.sourceRatePerMin = conn.ratePerMin;
      }
    }
  }

  // Update Satisfactory Productivity Display rolling-average efficiency on each machine
  const PROD_DISPLAY_WINDOW_SEC = 6.0;
  for (const node of nextNodes) {
    const prev = prevNodeStateById.get(node.id);
    const prevAvg = prev?.avgEfficiency;
    const prevStatus = prev?.status;
    const targetEff = node.efficiency;
    const isUnmountedMiner =
      node.buildingId === 'miner_mk1' && !mountedDepositByMinerId.has(node.id);

    if (
      dt <= 0 ||
      prevAvg === undefined ||
      node.buildingId === 'resource_deposit' ||
      node.status === 'idle' ||
      node.status === 'waiting' ||
      isUnmountedMiner ||
      (targetEff > 0 && (prevStatus === 'waiting' || prevStatus === 'idle'))
    ) {
      node.avgEfficiency = targetEff;
      node.efficiency = Math.round(targetEff);
    } else {
      const alpha = 1 - Math.exp(-dt / PROD_DISPLAY_WINDOW_SEC);
      let nextAvg = prevAvg + (targetEff - prevAvg) * alpha;
      if (Math.abs(nextAvg - targetEff) < 0.45) {
        nextAvg = targetEff;
      }
      node.avgEfficiency = Number(nextAvg.toFixed(2));
      node.efficiency = Math.round(node.avgEfficiency);

      if (node.buildingId === 'miner_mk1' || (node.recipeId && RECIPES[node.recipeId])) {
        if (node.efficiency >= 99) {
          node.status = 'optimal';
        } else if (node.efficiency > 0 && node.status !== 'backed_up') {
          node.status = 'working';
        }
      }
    }
  }

  return { nodes: nextNodes, connections: nextConns };
}
