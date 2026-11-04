import {
  BELT_ITEM_FOOTPRINT_PX,
  getBuildingMaxStorage,
  getItemStackSize,
  PURITY_CONFIG,
  RECIPES,
  STORAGE_CONTAINER_SLOTS,
} from './catalog';
import { computeConveyorLengthPx, doNodesOverlap, isMinerDirectlyOnDeposit } from './geometry';
import { BeltItemPacket, ConveyorConnection, MachineNode, PortSocket } from './types';
import { getBeltTierDef } from './world';

let packetIdCounter = 0;

function getRecipeInputCountPerCycle(ratePerMin: number, cycleTimeSec: number): number {
  return Math.max(1, Math.round((ratePerMin * cycleTimeSec) / 60));
}

function getRecipeOutputCountPerCycle(ratePerMin: number, cycleTimeSec: number): number {
  return Math.max(1, Math.round((ratePerMin * cycleTimeSec) / 60));
}

/**
 * Checks whether a conveyor belt's physical item queue has backed up from the destination port
 * (`lengthPx`) all the way back to the source entrance (`distancePx < BELT_ITEM_FOOTPRINT_PX`).
 */
function isBeltPackedBackToSource(conn: ConveyorConnection): boolean {
  const items = conn.inFlightItems;
  if (!items || items.length === 0) return false;
  const lengthPx = conn.lengthPx ?? 240;
  const minItemsToPack = Math.max(1, Math.floor(lengthPx / BELT_ITEM_FOOTPRINT_PX));
  if (items.length < minItemsToPack) return false;

  let maxDist = -Infinity;
  let minDist = Infinity;
  for (let i = 0; i < items.length; i++) {
    const d = items[i].distancePx;
    if (d > maxDist) maxDist = d;
    if (d < minDist) minDist = d;
  }
  return maxDist >= lengthPx - 2.5 && minDist < BELT_ITEM_FOOTPRINT_PX - 0.1;
}

function getEffectiveOutgoingBeltCapacity(conn: ConveyorConnection | undefined): number {
  if (!conn) return 0;
  if (conn.isBackedUp && isBeltPackedBackToSource(conn)) {
    return conn.ratePerMin ?? 0;
  }
  return conn.maxCapacityPerMin;
}

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
 *   items on the belt to catch up and line up bumper-to-bumper (`18px` = `1.2m` spacing) until a free
 *   spot opens up in the destination Input Storage.
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
        ? computeConveyorLengthPx(fromNode, outIdx, toNode, inIdx, nextNodes)
        : c.lengthPx ?? 240;
    const travelTimeSec = Number((lengthPx / tierDef.speedPxPerSec).toFixed(2));

    // If a node was dragged further away or belt path lengthened, items must travel the additional distance
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

  // Normalize node & port input/output storage capacities with official Satisfactory integer stack limits
  for (const node of nextNodes) {
    const recipe = node.recipeId ? RECIPES[node.recipeId] : null;
    if (node.buildingId === 'storage_container' || node.buildingId === 'the_hub') {
      const activeItem =
        node.outputs[0]?.itemName ??
        node.inputs.find((p) => p.itemName)?.itemName ??
        null;
      const stackSize = getItemStackSize(activeItem);
      const maxCap = STORAGE_CONTAINER_SLOTS * stackSize;
      node.maxStoredCount = maxCap;
      node.storedCount = Math.min(maxCap, Math.max(0, Math.round(node.storedCount ?? 0)));
      for (const inPort of node.inputs) {
        inPort.maxBuffer = stackSize;
        inPort.bufferedCount = Math.min(
          stackSize,
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
        Math.max(0, Math.round(node.storedCount ?? 0))
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
        Math.max(0, Math.round(node.storedCount ?? node.outputs[0]?.bufferedCount ?? 0))
      );
      if (node.outputs[0]) {
        node.outputs[0].maxBuffer = outMax;
        node.outputs[0].bufferedCount = node.storedCount;
      }
    } else {
      const maxCap = getBuildingMaxStorage(node.buildingId, node.recipeId, null);
      node.maxStoredCount = maxCap;
      node.storedCount = Math.min(maxCap, Math.max(0, Math.round(node.storedCount ?? 0)));
    }

    node.maxInputStoredCount = node.inputs.reduce((acc, p) => acc + (p.maxBuffer ?? 0), 0);
    node.inputStoredCount = node.inputs.reduce(
      (acc, p) => acc + Math.round(p.bufferedCount ?? 0),
      0
    );
  }

  // Compute maximum steady-state rate a destination input port can accept when its internal input storage is full
  const computeDestPortMaxAcceptRate = (
    conn: ConveyorConnection,
    toNode: MachineNode,
    inPort: PortSocket
  ): { isInputFull: boolean; destMaxAcceptRate: number } => {
    const portMax = inPort.maxBuffer ?? 100;
    const portBuf = Math.round(inPort.bufferedCount ?? 0);
    const isInputFull = portBuf >= portMax;

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
  };

  // Helper to run multi-pass steady-state rate & status telemetry propagation
  const propagateTelemetryRates = () => {
    const maxPasses = Math.max(5, nextNodes.length);
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
          const outPort = node.outputs[0];
          const outgoingConn = outPort
            ? outgoingConnByPortKey.get(`${node.id}:${outPort.id}`)
            : undefined;
          const outMax = node.maxStoredCount ?? 100;
          const isOutputBufferFull = Math.round(node.storedCount ?? 0) >= outMax;

          // Find the underlying Resource Deposit (Satisfactory extractor mechanic: 1 Miner sits directly on deposit)
          const deposit = nextNodes.find(
            (n) =>
              n.buildingId === 'resource_deposit' &&
              isMinerDirectlyOnDeposit(node, n, 4) &&
              nextNodes.find(
                (m) => m.buildingId === 'miner_mk1' && isMinerDirectlyOnDeposit(m, n, 4)
              )?.id === node.id
          );

          if (!deposit) {
            // Unmounted Miner Mk.1 is on bare terrain without a Resource Deposit: strictly 0 extraction!
            node.efficiency = 0;
            node.status = 'starved';
            node.progress = 0;
            const outMaxBeltRate = getEffectiveOutgoingBeltCapacity(outgoingConn);
            const canDrain = Math.round(node.storedCount ?? 0) >= 1 && outMaxBeltRate > 0;
            if (outPort) {
              outPort.targetRatePerMin = 0;
              // If there are residual items stored in the miner buffer, allow draining them to connected belt
              outPort.actualRatePerMin = canDrain ? Math.min(60, outMaxBeltRate) : 0;
            }
            continue;
          }

          const purityKey = deposit.purity ?? 'normal';
          const suppliedRate = PURITY_CONFIG[purityKey]?.ratePerMin ?? 60;

          // Determine mined ore type from the underlying deposit or node's recipe
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

          if (isOutputBufferFull && outMaxBeltRate === 0) {
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
          let limitingRatio = 1.0;
          let anyInputConnected = false;
          let anyInputInTransit = false;

          for (let i = 0; i < recipe.inputs.length; i++) {
            const req = recipe.inputs[i];
            const port = node.inputs[i];
            if (!port) continue;
            port.targetRatePerMin = req.ratePerMin;
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
            const hasBufferedIngredient =
              Math.round(port.bufferedCount ?? 0) >= reqPerCycle;
            const effectiveSupplied = hasBufferedIngredient
              ? Math.max(beltSupplied, req.ratePerMin)
              : beltSupplied;
            const ratio =
              req.ratePerMin > 0 ? Math.min(1, effectiveSupplied / req.ratePerMin) : 1;
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
          const isOutputFull = Math.round(node.storedCount ?? 0) + outCount > outMax;
          const outgoingConn = outPort
            ? outgoingConnByPortKey.get(`${node.id}:${outPort.id}`)
            : undefined;
          const maxBeltOut = getEffectiveOutgoingBeltCapacity(outgoingConn);

          if (isOutputFull) {
            const recipeOutRate = outSpec?.ratePerMin ?? 30;
            const outCapRatio =
              recipeOutRate > 0 ? Math.min(1, maxBeltOut / recipeOutRate) : 0;
            limitingRatio = Math.min(limitingRatio, outCapRatio);
          }

          const eff = Math.round(limitingRatio * 100);
          node.efficiency = eff;

          if (isOutputFull && eff === 0) {
            node.status = 'backed_up';
          } else if (eff >= 99) {
            node.status = 'optimal';
          } else if (eff > 0) {
            node.status = isOutputFull ? 'backed_up' : 'working';
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
            pOut.targetRatePerMin = spec.ratePerMin;
            pOut.itemName = spec.itemName;
            pOut.label = spec.itemName;
            pOut.maxBuffer = outMax;
            pOut.bufferedCount = node.storedCount;

            const craftedRate = Math.round(spec.ratePerMin * limitingRatio);
            if (
              outgoingConn &&
              maxBeltOut > 0 &&
              Math.round(node.storedCount ?? 0) >= 1 &&
              craftedRate === 0
            ) {
              pOut.actualRatePerMin = Math.min(spec.ratePerMin, maxBeltOut);
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
          inPort
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
  };

  // Initial telemetry pass so pre-settled starter belts know their item names & spacing
  propagateTelemetryRates();

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
    const idealSpacingPx = Math.max(
      BELT_ITEM_FOOTPRINT_PX,
      (tierDef.speedPxPerSec * 60) / Math.min(tierDef.capacityPerMin, spacingRate)
    );
    const itemName = conn.itemName ?? outPort?.itemName ?? 'Iron Ore';
    const items: BeltItemPacket[] = [];

    for (let dist = lengthPx - idealSpacingPx * 0.5; dist >= 0; dist -= idealSpacingPx) {
      items.push({
        id: `${conn.id}_init_${Math.round(dist * 10)}`,
        itemName,
        distancePx: Number(dist.toFixed(2)),
        stalled: false,
      });
    }
    conn.inFlightItems = items;
    conn.spawnAccumulator = 0.5;

    // Seed initial discrete working inventory on pre-settled starter machines if they start at 0
    if (toNode && inPort && Math.round(inPort.bufferedCount ?? 0) === 0 && Math.round(toNode.storedCount ?? 0) === 0) {
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
    if (fromNode && fromNode.buildingId !== 'resource_deposit' && Math.round(fromNode.storedCount ?? 0) === 0) {
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
      // Arriving items enter `inPort.bufferedCount (+1)` ONLY if `curIn + 1 <= portMax`!
      // Otherwise they physically get stuck at `lengthPx` and trailing items line up behind them!
      for (const conn of nextConns) {
        const tierDef = getBeltTierDef(conn.beltTier, conn.maxCapacityPerMin);
        const lengthPx = conn.lengthPx ?? 240;
        const fromNode = nodeMap.get(conn.fromNodeId);
        const toNode = nodeMap.get(conn.toNodeId);
        const outPort = fromNode?.outputs.find((p) => p.id === conn.fromPortId);
        const inPort = toNode?.inputs.find((p) => p.id === conn.toPortId);

        const defaultItemName = conn.itemName ?? outPort?.itemName ?? 'Iron Ore';
        const items = conn.inFlightItems ?? [];
        items.sort((a, b) => b.distancePx - a.distancePx);

        const remaining: BeltItemPacket[] = [];
        let arrivedThisSubStep = false;
        let stalledAtExit = false;
        const stepPx = tierDef.speedPxPerSec * subDt;

        for (let i = 0; i < items.length; i++) {
          const pkt = items[i];
          if (!pkt.itemName) pkt.itemName = defaultItemName;
          const nextDist = pkt.distancePx + stepPx;

          if (remaining.length === 0) {
            // Front-most item on the belt
            if (nextDist >= lengthPx - 1e-4) {
              // If destination is a pass-through container/splitter/merger, first flush any input slot items into main storage if room exists
              if (
                toNode &&
                inPort &&
                (toNode.buildingId === 'storage_container' ||
                  toNode.buildingId === 'the_hub' ||
                  toNode.buildingId === 'splitter' ||
                  toNode.buildingId === 'merger')
              ) {
                const maxMain = toNode.maxStoredCount ?? 100;
                while (
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
                // Discrete item physically enters the destination node's Input Storage (+1)!
                arrivedThisSubStep = true;
                if (toNode && inPort) {
                  inPort.bufferedCount = curIn + 1;
                  inPort.itemName = pkt.itemName;
                  // Pass-through buildings immediately move the item to output/main storage if room exists
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
                // Destination Input Storage is FULL (e.g. 100/100)!
                // The item cannot enter and physically gets stuck at the end of the belt!
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
            // Following item: cannot advance closer than BELT_ITEM_FOOTPRINT_PX (18px = 1.2m) behind item ahead
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

      // STEP B: Advance machine crafting cycles (consuming discrete integer inputs & producing discrete integer outputs)
      for (const node of nextNodes) {
        const recipe = node.recipeId ? RECIPES[node.recipeId] : null;

        if (node.buildingId === 'resource_deposit') {
          const purityKey = node.purity ?? 'normal';
          const purityRate = PURITY_CONFIG[purityKey]?.ratePerMin ?? 60;
          const outMax = node.maxStoredCount ?? 100;
          if (Math.round(node.storedCount ?? 0) < outMax) {
            node.progress = (node.progress ?? 0) + subDt * (purityRate / 60);
            while (
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
          const deposit = nextNodes.find(
            (n) =>
              n.buildingId === 'resource_deposit' &&
              isMinerDirectlyOnDeposit(node, n, 4) &&
              nextNodes.find(
                (m) => m.buildingId === 'miner_mk1' && isMinerDirectlyOnDeposit(m, n, 4)
              )?.id === node.id
          );

          if (!deposit) {
            // Unmounted Miner: NO WIRELESS MINING! Strictly 0 ore production when off deposit!
            node.progress = 0;
            if (outPort) {
              outPort.bufferedCount = node.storedCount;
            }
            continue;
          }

          const purityKey = deposit.purity ?? 'normal';
          const extractRate = PURITY_CONFIG[purityKey]?.ratePerMin ?? 60;

          if (Math.round(node.storedCount ?? 0) < outMax) {
            node.progress = (node.progress ?? 0) + subDt * (extractRate / 60);
            while (
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
            while (
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
          const cycleSec = recipe.cycleTimeSec || 2.0;
          const outSpec = recipe.outputs[0];
          const outCount = getRecipeOutputCountPerCycle(
            outSpec?.ratePerMin ?? 30,
            cycleSec
          );
          const outMax = node.maxStoredCount ?? 100;

          const checkInputsReady = () =>
            recipe.inputs.every(
              (req, idx) =>
                Math.round(node.inputs[idx]?.bufferedCount ?? 0) >=
                getRecipeInputCountPerCycle(req.ratePerMin, cycleSec)
            );
          const checkOutputRoom = () =>
            Math.round(node.storedCount ?? 0) + outCount <= outMax;

          if (checkInputsReady() && checkOutputRoom()) {
            node.progress = (node.progress ?? 0) + subDt / cycleSec;
            while (
              node.progress >= 1.0 - 1e-6 &&
              checkInputsReady() &&
              checkOutputRoom()
            ) {
              node.progress = Math.max(0, node.progress - 1.0);
              for (let idx = 0; idx < recipe.inputs.length; idx++) {
                const reqCount = getRecipeInputCountPerCycle(
                  recipe.inputs[idx].ratePerMin,
                  cycleSec
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

      // STEP C: Pull discrete items (`-1`) from each node's Output Storage (`node.storedCount`)
      // onto connected outgoing belt entrances (`distancePx = 0`) when physical space is available!
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
          // Find eligible outgoing belts whose timer is ready (`spawnAccumulator >= 1`) and entrance (`distancePx >= 18px`) is clear
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

          // Deduct 1 discrete item from source node's Output Storage!
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

        // Clamp any waiting belt accumulators to 1.0 so they don't build up burst debt while blocked or starved
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

  // Update node inputStoredCount & maxInputStoredCount from discrete port buffers
  for (const node of nextNodes) {
    node.maxInputStoredCount = node.inputs.reduce((acc, p) => acc + (p.maxBuffer ?? 0), 0);
    node.inputStoredCount = node.inputs.reduce(
      (acc, p) => acc + Math.round(p.bufferedCount ?? 0),
      0
    );
  }

  // Finalize belt front-gap detection & run steady-state telemetry propagation
  for (const conn of nextConns) {
    const tierDef = getBeltTierDef(conn.beltTier, conn.maxCapacityPerMin);
    const lengthPx = conn.lengthPx ?? 240;
    const remaining = conn.inFlightItems ?? [];
    const spacingRate = Math.max(
      conn.sourceRatePerMin ?? 0,
      conn.ratePerMin ?? 0,
      tierDef.capacityPerMin
    );
    const idealSpacingPx = Math.max(
      BELT_ITEM_FOOTPRINT_PX,
      (tierDef.speedPxPerSec * 60) / Math.min(tierDef.capacityPerMin, spacingRate)
    );
    const frontDist = remaining.length > 0 ? remaining[0].distancePx : -1;
    const postGapToFrontPx =
      frontDist >= 0
        ? lengthPx - frontDist
        : lengthPx + (1 - (conn.spawnAccumulator ?? 0)) * idealSpacingPx;

    if (postGapToFrontPx > idealSpacingPx + 6 && !conn.isBackedUp) {
      conn.firstItemArrived = false;
      conn.ratePerMin = 0;
    }
  }

  propagateTelemetryRates();

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
        const { destMaxAcceptRate } = computeDestPortMaxAcceptRate(conn, toNode, inPort);
        conn.ratePerMin = Math.min(conn.sourceRatePerMin ?? 0, destMaxAcceptRate);
        inPort.actualRatePerMin = conn.ratePerMin;
      }
      if (isBeltPackedBackToSource(conn)) {
        conn.sourceRatePerMin = conn.ratePerMin;
      }
    }
  }

  return { nodes: nextNodes, connections: nextConns };
}
