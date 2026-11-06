/**
 * ============================================================================
 * MODULE INDEX: Steady-State Telemetry & Backpressure Solver (`src/game/simulationTelemetry.ts`)
 * ============================================================================
 * [Lines 022-029] getRecipeInputCountPerCycle, getRecipeOutputCountPerCycle
 * [Lines 031-070] isBeltPackedBackToSource, getEffectiveOutgoingBeltCapacity
 * [Lines 072-167] normalizeNodeStorageCapacities
 * [Lines 169-256] computeDestPortMaxAcceptRate
 * [Lines 258-750] propagateSteadyStateTelemetry - Multi-pass steady-state rate & status solver
 * ============================================================================
 */

import {
  BELT_ITEM_FOOTPRINT_PX,
  clampClockSpeedPct,
  getBuildingMaxStorage,
  getItemStackSize,
  getRequiredPowerShards,
  PURITY_CONFIG,
  RECIPES,
  STORAGE_CONTAINER_SLOTS,
} from './catalog';
import { ConveyorConnection, MachineNode, PortSocket } from './types';

export function getRecipeInputCountPerCycle(ratePerMin: number, cycleTimeSec: number): number {
  return Math.max(1, Math.round((ratePerMin * cycleTimeSec) / 60));
}

export function getRecipeOutputCountPerCycle(ratePerMin: number, cycleTimeSec: number): number {
  return Math.max(1, Math.round((ratePerMin * cycleTimeSec) / 60));
}

/**
 * Checks whether a conveyor belt's physical item queue has backed up from the destination port
 * (`lengthPx`) all the way back to the source entrance (`distancePx < BELT_ITEM_FOOTPRINT_PX`).
 */
export function isBeltPackedBackToSource(
  conn: ConveyorConnection,
  allowShiftTolerance = false
): boolean {
  const items = conn.inFlightItems;
  if (!items || items.length === 0) return false;
  const lengthPx = conn.lengthPx ?? 240;
  const minItemsToPack = Math.max(1, Math.floor(lengthPx / BELT_ITEM_FOOTPRINT_PX));
  const useHysteresis = allowShiftTolerance || Boolean(conn.isBackedUp);
  const reqCount = useHysteresis ? Math.max(1, minItemsToPack - 1) : minItemsToPack;
  if (items.length < reqCount) return false;

  let maxDist = -Infinity;
  let minDist = Infinity;
  for (let i = 0; i < items.length; i++) {
    const d = items[i].distancePx;
    if (d > maxDist) maxDist = d;
    if (d < minDist) minDist = d;
  }
  if (useHysteresis) {
    return (
      maxDist >= lengthPx - BELT_ITEM_FOOTPRINT_PX * 1.6 &&
      minDist <= BELT_ITEM_FOOTPRINT_PX * 1.6
    );
  }
  return maxDist >= lengthPx - 2.5 && minDist < BELT_ITEM_FOOTPRINT_PX - 0.1;
}

export function getEffectiveOutgoingBeltCapacity(conn: ConveyorConnection | undefined): number {
  if (!conn) return 0;
  if (conn.isBackedUp && isBeltPackedBackToSource(conn, true)) {
    return conn.ratePerMin ?? 0;
  }
  return conn.maxCapacityPerMin;
}

/**
 * Normalizes node & port input/output storage capacities with official Satisfactory integer stack limits.
 */
export function normalizeNodeStorageCapacities(nextNodes: MachineNode[]): void {
  for (const node of nextNodes) {
    const rawClock = node.clockSpeedPct ?? 100;
    const minShardsForClock = getRequiredPowerShards(rawClock);
    const shards = Math.min(3, Math.max(minShardsForClock, Math.floor(node.powerShards ?? 0)));
    node.powerShards = shards;
    node.clockSpeedPct = clampClockSpeedPct(rawClock, shards);
    node.isStandby = Boolean(node.isStandby);

    const recipe = node.recipeId ? RECIPES[node.recipeId] : null;
    const rawOutStored = Math.max(
      node.storedCount ?? 0,
      node.outputs[0]?.bufferedCount ?? 0
    );

    if (node.buildingId === 'storage_container' || node.buildingId === 'the_hub') {
      const activeItem =
        node.outputs[0]?.itemName ??
        node.inputs.find((p) => p.itemName)?.itemName ??
        null;
      const stackSize = getItemStackSize(activeItem);
      const maxCap = Math.max(
        STORAGE_CONTAINER_SLOTS * stackSize,
        node.maxStoredCount ?? 0
      );
      node.maxStoredCount = maxCap;
      node.storedCount = Math.min(maxCap, Math.max(0, Math.round(rawOutStored)));
      for (const inPort of node.inputs) {
        const portStack = Math.max(stackSize, getItemStackSize(inPort.itemName));
        inPort.maxBuffer = portStack;
        inPort.bufferedCount = Math.min(
          portStack,
          Math.max(0, Math.round(inPort.bufferedCount ?? 0))
        );
      }
      if (node.outputs[0]) {
        node.outputs[0].maxBuffer = maxCap;
        node.outputs[0].bufferedCount = node.storedCount;
      }
    } else if (node.buildingId === 'splitter' || node.buildingId === 'merger') {
      const logisticsMax = getBuildingMaxStorage(node.buildingId, null, null);
      node.maxStoredCount = logisticsMax;
      node.storedCount = Math.min(
        logisticsMax,
        Math.max(0, Math.round(rawOutStored))
      );
      for (const inPort of node.inputs) {
        inPort.maxBuffer = logisticsMax;
        inPort.bufferedCount = Math.min(
          logisticsMax,
          Math.max(0, Math.round(inPort.bufferedCount ?? 0))
        );
      }
      for (const outPort of node.outputs) {
        outPort.maxBuffer = logisticsMax;
        outPort.bufferedCount = node.storedCount;
      }
    } else if (node.buildingId === 'resource_deposit') {
      node.maxStoredCount = 100;
      node.storedCount = Math.min(100, Math.max(1, Math.round(node.storedCount || 100)));
      if (node.outputs[0]) {
        node.outputs[0].maxBuffer = 100;
        node.outputs[0].bufferedCount = node.storedCount;
      }
    } else if (recipe) {
      for (let i = 0; i < node.inputs.length; i++) {
        const req = recipe.inputs[i];
        const port = node.inputs[i];
        const maxBuf = getItemStackSize(req?.itemId ?? req?.itemName ?? port.itemName);
        port.maxBuffer = maxBuf;
        port.bufferedCount = Math.min(
          maxBuf,
          Math.max(0, Math.round(port.bufferedCount ?? 0))
        );
      }
      const outSpec = recipe.outputs[0];
      const outMax = getItemStackSize(
        outSpec?.itemId ?? outSpec?.itemName ?? node.outputs[0]?.itemName
      );
      node.maxStoredCount = outMax;
      node.storedCount = Math.min(
        outMax,
        Math.max(0, Math.round(rawOutStored))
      );
      if (node.outputs[0]) {
        node.outputs[0].maxBuffer = outMax;
        node.outputs[0].bufferedCount = node.storedCount;
      }
    } else {
      const maxCap = Math.max(
        getBuildingMaxStorage(node.buildingId, node.recipeId, null),
        node.maxStoredCount ?? 0
      );
      node.maxStoredCount = maxCap;
      node.storedCount = Math.min(maxCap, Math.max(0, Math.round(rawOutStored)));
      if (node.outputs[0]) {
        node.outputs[0].maxBuffer = maxCap;
        node.outputs[0].bufferedCount = node.storedCount;
      }
    }

    // Reconcile node.inputStoredCount into node.inputs[].bufferedCount if inputStoredCount was populated directly
    let sumPortBuffers = node.inputs.reduce(
      (acc, p) => acc + Math.round(p.bufferedCount ?? 0),
      0
    );
    const savedInTotal = Math.max(0, Math.round(node.inputStoredCount ?? 0));
    if (savedInTotal > sumPortBuffers && node.inputs.length > 0) {
      let rem = savedInTotal - sumPortBuffers;
      for (const inPort of node.inputs) {
        if (rem <= 0) break;
        const cap = inPort.maxBuffer ?? 100;
        const cur = Math.round(inPort.bufferedCount ?? 0);
        const add = Math.min(rem, Math.max(0, cap - cur));
        inPort.bufferedCount = cur + add;
        rem -= add;
      }
      sumPortBuffers = node.inputs.reduce(
        (acc, p) => acc + Math.round(p.bufferedCount ?? 0),
        0
      );
    }

    node.maxInputStoredCount = node.inputs.reduce((acc, p) => acc + (p.maxBuffer ?? 0), 0);
    node.inputStoredCount = sumPortBuffers;
  }
}

/**
 * Computes maximum steady-state rate a destination input port can accept when its internal input storage is full.
 */
export function computeDestPortMaxAcceptRate(
  conn: ConveyorConnection,
  toNode: MachineNode,
  inPort: PortSocket,
  outgoingConnsByNodeId: Map<string, ConveyorConnection[]>
): { isInputFull: boolean; destMaxAcceptRate: number } {
  const portMax = inPort.maxBuffer ?? 100;
  const portBuf = Math.round(inPort.bufferedCount ?? 0);
  let reqPerCycle = 1;
  if (toNode.recipeId && RECIPES[toNode.recipeId]) {
    const r = RECIPES[toNode.recipeId];
    const req = r.inputs[inPort.index] ?? r.inputs[0];
    if (req) {
      reqPerCycle = getRecipeInputCountPerCycle(req.ratePerMin, r.cycleTimeSec);
    }
  }
  const lengthPx = conn.lengthPx ?? 240;
  const items = conn.inFlightItems ?? [];
  const frontDist = items.length > 0 ? items[0].distancePx : -1;
  const hasItemNearExit = frontDist >= lengthPx - BELT_ITEM_FOOTPRINT_PX * 1.8;
  const isInputFull =
    portBuf >= portMax ||
    (portBuf >= portMax - reqPerCycle && (Boolean(conn.isBackedUp) || hasItemNearExit));

  if (!isInputFull) {
    return { isInputFull: false, destMaxAcceptRate: conn.maxCapacityPerMin };
  }

  if (toNode.buildingId === 'storage_container' || toNode.buildingId === 'the_hub') {
    const maxCap = toNode.maxStoredCount ?? 2400;
    const isMainFull = Math.round(toNode.storedCount ?? 0) >= maxCap;
    if (!isMainFull) {
      return { isInputFull: false, destMaxAcceptRate: conn.maxCapacityPerMin };
    }
    const dstOutConns = outgoingConnsByNodeId.get(toNode.id);
    const dstOutConn = dstOutConns?.[0];
    const drainRate = dstOutConn
      ? Math.min(
          getEffectiveOutgoingBeltCapacity(dstOutConn),
          toNode.outputs[0]?.actualRatePerMin ?? 0
        )
      : 0;
    return { isInputFull: true, destMaxAcceptRate: drainRate };
  }

  if (toNode.buildingId === 'splitter' || toNode.buildingId === 'merger') {
    const maxCap = toNode.maxStoredCount ?? 9;
    const isOutStorageFull = Math.round(toNode.storedCount ?? 0) >= maxCap;
    const dstOutConns = outgoingConnsByNodeId.get(toNode.id) ?? [];
    const totalOutCap = dstOutConns.reduce(
      (acc, c) => acc + getEffectiveOutgoingBeltCapacity(c),
      0
    );
    if (!isOutStorageFull && totalOutCap > 0) {
      return { isInputFull: false, destMaxAcceptRate: conn.maxCapacityPerMin };
    }
    return {
      isInputFull: true,
      destMaxAcceptRate: Math.min(conn.maxCapacityPerMin, totalOutCap),
    };
  }

  if (toNode.recipeId && RECIPES[toNode.recipeId]) {
    const recipe = RECIPES[toNode.recipeId];
    const outSpec = recipe.outputs[0];
    const outCount = getRecipeOutputCountPerCycle(
      outSpec?.ratePerMin ?? 30,
      recipe.cycleTimeSec
    );
    const isOutFull =
      Math.round(toNode.storedCount ?? 0) + outCount > (toNode.maxStoredCount ?? 100);
    const dstOutConn = outgoingConnsByNodeId.get(toNode.id)?.[0];
    const dstOutCap = getEffectiveOutgoingBeltCapacity(dstOutConn);
    if (isOutFull && dstOutCap === 0) {
      return { isInputFull: true, destMaxAcceptRate: 0 };
    }
    const activeRatio =
      toNode.status === 'backed_up' ? 0 : (toNode.efficiency ?? 0) / 100;
    const acceptRate = Math.round(inPort.targetRatePerMin * activeRatio);
    return { isInputFull: true, destMaxAcceptRate: acceptRate };
  }

  return { isInputFull: true, destMaxAcceptRate: 0 };
}

/**
 * Multi-pass steady-state rate & status telemetry propagation across nodes and conveyor belts.
 */
export function propagateSteadyStateTelemetry(
  nextNodes: MachineNode[],
  nextConns: ConveyorConnection[],
  nodeMap: Map<string, MachineNode>,
  mountedDepositByMinerId: Map<string, MachineNode>,
  incomingConnByPortKey: Map<string, ConveyorConnection>,
  outgoingConnByPortKey: Map<string, ConveyorConnection>,
  outgoingConnsByNodeId: Map<string, ConveyorConnection[]>
): void {
  // Seed connected input ports with current delivered belt rates before Pass 0
  for (const conn of nextConns) {
    const toNode = nodeMap.get(conn.toNodeId);
    const inPort = toNode?.inputs.find((p) => p.id === conn.toPortId);
    if (inPort) {
      inPort.actualRatePerMin = conn.firstItemArrived ? (conn.ratePerMin ?? 0) : 0;
      if (conn.itemName) {
        inPort.itemName = conn.itemName;
      }
    }
  }

  const maxPasses = Math.max(5, nextNodes.length + 2);
  for (let pass = 0; pass < maxPasses; pass++) {
    let anyChangeInPass = false;

    // Pass A: compute each node's output rates from its current arriving input rates & discrete buffers
    for (const node of nextNodes) {
      const recipe = node.recipeId ? RECIPES[node.recipeId] : null;
      const prevStatus = node.status;
      const prevEff = node.efficiency;

      if (node.buildingId === 'resource_deposit') {
        const outRecipe = recipe ?? RECIPES.deposit_iron;
        const purityKey = node.purity ?? 'normal';
        const rate = (PURITY_CONFIG[purityKey] ?? PURITY_CONFIG.normal).ratePerMin;
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
        const outPort = node.outputs[0];
        const outgoingConn = outPort
          ? outgoingConnByPortKey.get(`${node.id}:${outPort.id}`)
          : undefined;
        const outMax = node.maxStoredCount ?? 100;
        const isBeltPacked = Boolean(
          outgoingConn &&
            outgoingConn.isBackedUp &&
            isBeltPackedBackToSource(outgoingConn, true)
        );
        const isOutputBufferFull =
          Math.round(node.storedCount ?? 0) >= outMax ||
          (isBeltPacked && Math.round(node.storedCount ?? 0) >= outMax - 1);

        const deposit = mountedDepositByMinerId.get(node.id);

        if (!deposit) {
          node.efficiency = 0;
          node.status = 'starved';
          node.progress = 0;
          const outMaxBeltRate = getEffectiveOutgoingBeltCapacity(outgoingConn);
          const canDrain = Math.round(node.storedCount ?? 0) >= 1 && outMaxBeltRate > 0;
          if (outPort) {
            outPort.targetRatePerMin = 0;
            outPort.actualRatePerMin = canDrain ? Math.min(60, outMaxBeltRate) : 0;
          }
          continue;
        }

        const purityKey = deposit.purity ?? 'normal';
        const baseSuppliedRate = (PURITY_CONFIG[purityKey] ?? PURITY_CONFIG.normal).ratePerMin;
        const clockRatio = Math.max(0.01, (node.clockSpeedPct ?? 100) / 100);
        const suppliedRate = Math.round(baseSuppliedRate * clockRatio * 10) / 10;

        const oreName =
          deposit.recipeId === 'deposit_copper' || deposit.title?.toLowerCase().includes('copper')
            ? 'Copper Ore'
            : deposit.recipeId === 'deposit_limestone' || deposit.title?.toLowerCase().includes('limestone')
            ? 'Limestone'
            : recipe?.outputs[0]?.itemName ?? 'Iron Ore';

        if (oreName.toLowerCase().includes('copper')) {
          node.recipeId = 'mine_copper';
        } else if (oreName.toLowerCase().includes('limestone')) {
          node.recipeId = 'mine_limestone';
        } else {
          node.recipeId = 'mine_iron';
        }

        if (outPort) {
          outPort.label = oreName;
          outPort.itemName = oreName;
          outPort.targetRatePerMin = suppliedRate;
        }

        const outMaxBeltRate = getEffectiveOutgoingBeltCapacity(outgoingConn);

        if (node.isStandby) {
          const canDrain = Math.round(node.storedCount ?? 0) >= 1 && outMaxBeltRate > 0;
          if (outPort) {
            outPort.actualRatePerMin = canDrain ? Math.min(suppliedRate, outMaxBeltRate) : 0;
          }
          node.efficiency = 0;
          node.status = 'idle';
        } else if (isOutputBufferFull && outMaxBeltRate === 0) {
          if (outPort) outPort.actualRatePerMin = 0;
          node.efficiency = 0;
          node.status = 'backed_up';
        } else {
          const activeRate = isOutputBufferFull
            ? Math.min(suppliedRate, outMaxBeltRate)
            : suppliedRate;
          if (outPort) {
            outPort.actualRatePerMin =
              Math.round(node.storedCount ?? 0) >= 1 && outMaxBeltRate > activeRate
                ? Math.min(suppliedRate, outMaxBeltRate)
                : activeRate;
          }
          node.efficiency =
            suppliedRate > 0 ? Math.round((activeRate / suppliedRate) * 100) : 0;
          node.status =
            node.efficiency === 0 && isOutputBufferFull
              ? 'backed_up'
              : node.efficiency >= 99
              ? 'optimal'
              : 'working';
        }
      } else if (node.buildingId === 'splitter') {
        const inPort = node.inputs[0];
        const inRate = inPort?.actualRatePerMin ?? 0;
        const hasBuffered =
          Math.round(inPort?.bufferedCount ?? 0) >= 1 ||
          Math.round(node.storedCount ?? 0) >= 1;
        const inItem =
          inPort?.itemName ??
          node.outputs.find((p) => p.itemName)?.itemName ??
          null;
        const incomingConn = inPort
          ? incomingConnByPortKey.get(`${node.id}:${inPort.id}`)
          : undefined;
        if (inPort) {
          inPort.label = inItem ?? 'IN 1';
        }
        const activeOutConns = outgoingConnsByNodeId.get(node.id) ?? [];
        const availableOutConns = activeOutConns.filter(
          (c) => getEffectiveOutgoingBeltCapacity(c) > 0
        );
        const splitCount = Math.max(
          1,
          availableOutConns.length || activeOutConns.length
        );
        const effectiveIn =
          inRate > 0
            ? inRate
            : hasBuffered && availableOutConns.length > 0
            ? 60
            : 0;
        const perOutRate =
          activeOutConns.length > 0 ? Math.round(effectiveIn / splitCount) : 0;

        for (const outPort of node.outputs) {
          const outConn = outgoingConnByPortKey.get(`${node.id}:${outPort.id}`);
          const outCap = getEffectiveOutgoingBeltCapacity(outConn);
          outPort.actualRatePerMin = outConn ? Math.min(outCap, perOutRate) : 0;
          outPort.targetRatePerMin = 60;
          outPort.itemName = outConn ? inItem : outPort.itemName;
          outPort.label = inItem ?? `OUT ${outPort.index + 1}`;
        }

        const isOutFull =
          Math.round(node.storedCount ?? 0) >= (node.maxStoredCount ?? 9);
        const totalActualOut = node.outputs.reduce(
          (s, p) => s + p.actualRatePerMin,
          0
        );
        if (isOutFull && totalActualOut === 0 && (inRate > 0 || hasBuffered)) {
          node.efficiency = 0;
          node.status = 'backed_up';
        } else {
          node.efficiency =
            effectiveIn > 0 && totalActualOut > 0 ? 100 : inRate > 0 ? 100 : 0;
          const isInTransit = Boolean(
            incomingConn &&
              (incomingConn.sourceRatePerMin ?? 0) > 0 &&
              !incomingConn.firstItemArrived
          );
          node.status =
            node.efficiency > 0 ? 'optimal' : isInTransit ? 'waiting' : 'idle';
        }
      } else if (node.buildingId === 'merger') {
        let totalIn = 0;
        let dominantItem: string | null = node.outputs[0]?.itemName ?? null;
        let anyInTransit = false;
        let hasBuffered = Math.round(node.storedCount ?? 0) >= 1;
        for (const inPort of node.inputs) {
          totalIn += inPort.actualRatePerMin;
          if (Math.round(inPort.bufferedCount ?? 0) >= 1) {
            hasBuffered = true;
          }
          if (inPort.itemName && !dominantItem) {
            dominantItem = inPort.itemName;
          }
          inPort.label = inPort.itemName ?? `IN ${inPort.index + 1}`;
          const c = incomingConnByPortKey.get(`${node.id}:${inPort.id}`);
          if (c && (c.sourceRatePerMin ?? 0) > 0 && !c.firstItemArrived) {
            anyInTransit = true;
          }
        }
        const outPort = node.outputs[0];
        const outConn = outPort
          ? outgoingConnByPortKey.get(`${node.id}:${outPort.id}`)
          : undefined;
        const outCap = outConn ? getEffectiveOutgoingBeltCapacity(outConn) : 1200;
        const rawMerged =
          totalIn > 0 ? totalIn : hasBuffered && outConn && outCap > 0 ? 60 : 0;
        const cappedOut = Math.min(1200, outCap, rawMerged);
        if (outPort) {
          outPort.actualRatePerMin = cappedOut;
          outPort.targetRatePerMin = 60;
          outPort.itemName = dominantItem;
          outPort.label = dominantItem ?? 'OUT 1';
        }
        const isOutFull =
          Math.round(node.storedCount ?? 0) >= (node.maxStoredCount ?? 9);
        if (isOutFull && (!outConn || outCap === 0) && (totalIn > 0 || hasBuffered)) {
          node.efficiency = 0;
          node.status = 'backed_up';
        } else {
          node.efficiency = cappedOut > 0 ? 100 : 0;
          node.status =
            cappedOut > 0 ? 'optimal' : anyInTransit ? 'waiting' : 'idle';
        }
      } else if (
        node.buildingId === 'storage_container' ||
        node.buildingId === 'the_hub'
      ) {
        let totalIn = 0;
        let itemLabel: string | null = node.outputs[0]?.itemName ?? null;
        let anyInTransit = false;
        for (const inPort of node.inputs) {
          totalIn += inPort.actualRatePerMin;
          if (inPort.itemName && !itemLabel) {
            itemLabel = inPort.itemName;
          }
          inPort.label = inPort.itemName ?? `IN ${inPort.index + 1}`;
          const c = incomingConnByPortKey.get(`${node.id}:${inPort.id}`);
          if (c && (c.sourceRatePerMin ?? 0) > 0 && !c.firstItemArrived) {
            anyInTransit = true;
          }
        }

        const stackSize = getItemStackSize(itemLabel);
        const maxCap = STORAGE_CONTAINER_SLOTS * stackSize;
        node.maxStoredCount = maxCap;
        const isContainerFull = Math.round(node.storedCount ?? 0) >= maxCap;

        const outPort = node.outputs[0];
        const outgoingConn = outPort
          ? outgoingConnByPortKey.get(`${node.id}:${outPort.id}`)
          : undefined;
        const outCap = getEffectiveOutgoingBeltCapacity(outgoingConn);

        if (outPort) {
          const hasInventory =
            Math.round(node.storedCount ?? 0) >= 1 ||
            Math.round(node.inputs[0]?.bufferedCount ?? 0) >= 1;
          const dischargeRate =
            outgoingConn && hasInventory ? Math.max(totalIn, outCap) : totalIn;
          outPort.actualRatePerMin = outgoingConn
            ? Math.min(outCap, dischargeRate)
            : totalIn;
          outPort.itemName = itemLabel;
          outPort.label = itemLabel ?? 'OUT 1';
          outPort.maxBuffer = maxCap;
          outPort.bufferedCount = node.storedCount;
        }

        const effectiveOut = outgoingConn ? (outPort?.actualRatePerMin ?? 0) : 0;
        if (isContainerFull && totalIn > effectiveOut && effectiveOut === 0) {
          node.efficiency = 0;
          node.status = 'backed_up';
        } else if (totalIn > 0 || effectiveOut > 0) {
          node.efficiency = 100;
          node.status =
            isContainerFull && totalIn > effectiveOut ? 'backed_up' : 'optimal';
        } else {
          node.efficiency = 0;
          node.status = isContainerFull
            ? 'backed_up'
            : anyInTransit
            ? 'waiting'
            : 'idle';
        }
      } else if (recipe) {
        const clockRatio = Math.max(0.01, (node.clockSpeedPct ?? 100) / 100);
        let limitingRatio = node.isStandby ? 0 : 1.0;
        let anyInputConnected = false;
        let anyInputInTransit = false;

        for (let i = 0; i < recipe.inputs.length; i++) {
          const req = recipe.inputs[i];
          const port = node.inputs[i];
          if (!port) continue;
          const scaledReqRate = Math.round(req.ratePerMin * clockRatio * 10) / 10;
          port.targetRatePerMin = scaledReqRate;
          port.label = req.itemName;
          port.maxBuffer = getItemStackSize(req.itemId || req.itemName);

          const incomingConn = incomingConnByPortKey.get(`${node.id}:${port.id}`);
          if (incomingConn) {
            anyInputConnected = true;
            if (
              (incomingConn.sourceRatePerMin ?? 0) > 0 &&
              !incomingConn.firstItemArrived
            ) {
              anyInputInTransit = true;
            }
          }

          const itemMatches =
            !port.itemName ||
            port.itemName.toLowerCase() === req.itemName.toLowerCase();
          const beltSupplied = itemMatches ? port.actualRatePerMin : 0;
          const reqPerCycle = getRecipeInputCountPerCycle(
            req.ratePerMin,
            recipe.cycleTimeSec
          );
          const bufferedItems = Math.round(port.bufferedCount ?? 0);
          const hasStockpiledBuffer =
            bufferedItems >= reqPerCycle * 2 ||
            (bufferedItems >= reqPerCycle &&
              beltSupplied === 0 &&
              (!incomingConn || (incomingConn.sourceRatePerMin ?? 0) === 0));
          const effectiveSupplied = hasStockpiledBuffer
            ? Math.max(beltSupplied, scaledReqRate)
            : beltSupplied;
          const ratio =
            scaledReqRate > 0 ? Math.min(1, effectiveSupplied / scaledReqRate) : 1;
          limitingRatio = Math.min(limitingRatio, ratio);
        }

        const outSpec = recipe.outputs[0];
        const outPort = node.outputs[0];
        const outMax = getItemStackSize(outSpec?.itemId ?? outSpec?.itemName ?? null);
        node.maxStoredCount = outMax;
        const outCount = getRecipeOutputCountPerCycle(
          outSpec?.ratePerMin ?? 30,
          recipe.cycleTimeSec
        );
        const outgoingConn = outPort
          ? outgoingConnByPortKey.get(`${node.id}:${outPort.id}`)
          : undefined;
        const isBeltPacked = Boolean(
          outgoingConn &&
            outgoingConn.isBackedUp &&
            isBeltPackedBackToSource(outgoingConn, true)
        );
        const isOutputFull =
          Math.round(node.storedCount ?? 0) + outCount > outMax ||
          (isBeltPacked && Math.round(node.storedCount ?? 0) >= outMax - outCount);
        const maxBeltOut = getEffectiveOutgoingBeltCapacity(outgoingConn);

        const scaledRecipeOutRate =
          Math.round((outSpec?.ratePerMin ?? 30) * clockRatio * 10) / 10;

        if (isOutputFull) {
          const outCapRatio =
            scaledRecipeOutRate > 0 ? Math.min(1, maxBeltOut / scaledRecipeOutRate) : 0;
          limitingRatio = Math.min(limitingRatio, outCapRatio);
        }

        const eff = node.isStandby ? 0 : Math.round(limitingRatio * 100);
        node.efficiency = eff;

        if (node.isStandby) {
          node.status = 'idle';
        } else if (isOutputFull && eff === 0) {
          node.status = 'backed_up';
        } else if (eff >= 99) {
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
          const spec = recipe.outputs[i];
          const pOut = node.outputs[i];
          if (!pOut) continue;
          const scaledOutTarget = Math.round(spec.ratePerMin * clockRatio * 10) / 10;
          pOut.targetRatePerMin = scaledOutTarget;
          pOut.itemName = spec.itemName;
          pOut.label = spec.itemName;
          pOut.maxBuffer = outMax;
          pOut.bufferedCount = node.storedCount;

          const craftedRate = Math.round(scaledOutTarget * limitingRatio * 10) / 10;
          if (
            outgoingConn &&
            maxBeltOut > 0 &&
            Math.round(node.storedCount ?? 0) >= 1 &&
            craftedRate === 0
          ) {
            pOut.actualRatePerMin = Math.min(scaledOutTarget, maxBeltOut);
          } else {
            pOut.actualRatePerMin = craftedRate;
          }
        }
      }

      if (node.status !== prevStatus || node.efficiency !== prevEff) {
        anyChangeInPass = true;
      }
    }

    // Pass B: update belt entering rates & delivered rates (respecting full destination input storages)
    for (const conn of nextConns) {
      const fromNode = nodeMap.get(conn.fromNodeId);
      const toNode = nodeMap.get(conn.toNodeId);
      if (!fromNode || !toNode) continue;

      const outPort = fromNode.outputs.find((p) => p.id === conn.fromPortId);
      const inPort = toNode.inputs.find((p) => p.id === conn.toPortId);
      if (!outPort || !inPort) continue;

      const rawSupplyRate = Math.min(conn.maxCapacityPerMin, outPort.actualRatePerMin);
      const { isInputFull, destMaxAcceptRate } = computeDestPortMaxAcceptRate(
        conn,
        toNode,
        inPort,
        outgoingConnsByNodeId
      );

      const packedToEntrance =
        isInputFull &&
        destMaxAcceptRate < rawSupplyRate &&
        isBeltPackedBackToSource(conn);

      const enteringRate = packedToEntrance
        ? Math.min(rawSupplyRate, destMaxAcceptRate)
        : rawSupplyRate;
      const deliveredRate = conn.firstItemArrived
        ? Math.min(enteringRate, destMaxAcceptRate)
        : 0;
      const nextBackedUp = Boolean(
        isInputFull &&
          destMaxAcceptRate < Math.max(rawSupplyRate, conn.maxCapacityPerMin) &&
          conn.firstItemArrived
      );

      if (
        conn.sourceRatePerMin !== enteringRate ||
        conn.ratePerMin !== deliveredRate ||
        conn.isBackedUp !== nextBackedUp ||
        (outPort.itemName && conn.itemName !== outPort.itemName) ||
        inPort.actualRatePerMin !== deliveredRate
      ) {
        anyChangeInPass = true;
      }

      conn.isBackedUp = nextBackedUp;
      conn.sourceRatePerMin = enteringRate;
      if (outPort.itemName) {
        conn.itemName = outPort.itemName;
      }

      conn.ratePerMin = deliveredRate;

      inPort.actualRatePerMin = deliveredRate;
      if (conn.itemName) {
        inPort.itemName = conn.itemName;
      }
    }

    if (pass >= 1 && !anyChangeInPass) {
      break;
    }
  }
}
