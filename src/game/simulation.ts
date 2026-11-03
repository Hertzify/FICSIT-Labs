import {
  BELT_ITEM_FOOTPRINT_PX,
  getBuildingMaxStorage,
  getItemStackSize,
  PURITY_CONFIG,
  RECIPES,
  STORAGE_CONTAINER_SLOTS,
} from './catalog';
import { computeConveyorLengthPx } from './geometry';
import { BeltItemPacket, ConveyorConnection, MachineNode } from './types';
import { getBeltTierDef } from './world';

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

  // Normalize node & port buffer capacities with official Satisfactory stack limits
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
      node.storedCount = Math.min(maxCap, Math.max(0, node.storedCount ?? 0));
      for (const inPort of node.inputs) {
        inPort.maxBuffer = stackSize;
        inPort.bufferedCount = Math.min(stackSize, Math.max(0, inPort.bufferedCount ?? 0));
      }
      if (node.outputs[0]) {
        node.outputs[0].maxBuffer = maxCap;
        node.outputs[0].bufferedCount = node.storedCount;
      }
    } else if (recipe) {
      for (let i = 0; i < node.inputs.length; i++) {
        const req = recipe.inputs[i];
        const port = node.inputs[i];
        const maxBuf = getItemStackSize(req?.itemId ?? req?.itemName ?? port.itemName);
        port.maxBuffer = maxBuf;
        port.bufferedCount = Math.min(maxBuf, Math.max(0, port.bufferedCount ?? 0));
      }
      const outSpec = recipe.outputs[0];
      const outMax = getItemStackSize(
        outSpec?.itemId ?? outSpec?.itemName ?? node.outputs[0]?.itemName
      );
      node.maxStoredCount = outMax;
      node.storedCount = Math.min(
        outMax,
        Math.max(0, node.storedCount ?? node.outputs[0]?.bufferedCount ?? 0)
      );
      if (node.outputs[0]) {
        node.outputs[0].maxBuffer = outMax;
        node.outputs[0].bufferedCount = node.storedCount;
      }
    } else {
      const maxCap = getBuildingMaxStorage(node.buildingId, node.recipeId, null);
      node.maxStoredCount = maxCap;
      node.storedCount = Math.min(maxCap, Math.max(0, node.storedCount ?? 0));
    }
  }

  // Multi-pass flow propagation for settled belts & Satisfactory internal buffers with early-exit convergence
  const maxPasses = Math.max(5, nextNodes.length);
  for (let pass = 0; pass < maxPasses; pass++) {
    let anyChangeInPass = false;

    // Pass A: compute each node's output rates from its current arriving input rates & internal buffers
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
        const inPort = node.inputs[0];
        const outPort = node.outputs[0];
        const incomingConn = inPort
          ? incomingConnByPortKey.get(`${node.id}:${inPort.id}`)
          : undefined;
        const outgoingConn = outPort
          ? outgoingConnByPortKey.get(`${node.id}:${outPort.id}`)
          : undefined;
        const outMax = node.maxStoredCount ?? 100;
        const isOutputBufferFull = node.storedCount >= outMax - 0.01;
        const hasBufferedOre = (inPort?.bufferedCount ?? 0) > 0.05;

        if (
          inPort &&
          outPort &&
          ((incomingConn && inPort.actualRatePerMin > 0 && inPort.itemName) || hasBufferedOre)
        ) {
          const oreName =
            inPort.itemName ?? recipe?.outputs[0]?.itemName ?? 'Iron Ore';
          if (oreName.toLowerCase().includes('copper')) {
            node.recipeId = 'mine_copper';
          } else if (oreName.toLowerCase().includes('limestone')) {
            node.recipeId = 'mine_limestone';
          } else {
            node.recipeId = 'mine_iron';
          }
          const suppliedRate =
            inPort.actualRatePerMin > 0 ? inPort.actualRatePerMin : 60;
          inPort.label = oreName;
          inPort.itemName = oreName;
          inPort.targetRatePerMin = suppliedRate;

          const outMaxBeltRate = outgoingConn ? outgoingConn.maxCapacityPerMin : 0;
          // If output buffer (100 ore) is 100% full and no belt is draining it, Miner is BACKED UP!
          if (isOutputBufferFull && outMaxBeltRate === 0) {
            outPort.itemName = oreName;
            outPort.label = oreName;
            outPort.targetRatePerMin = suppliedRate;
            outPort.actualRatePerMin = 0;
            node.efficiency = 0;
            node.status = 'backed_up';
          } else {
            const activeRate = isOutputBufferFull
              ? Math.min(suppliedRate, outMaxBeltRate)
              : suppliedRate;
            outPort.itemName = oreName;
            outPort.label = oreName;
            outPort.targetRatePerMin = suppliedRate;
            outPort.actualRatePerMin =
              node.storedCount > 0.5 && outMaxBeltRate > activeRate
                ? Math.min(suppliedRate, outMaxBeltRate)
                : activeRate;
            node.efficiency =
              suppliedRate > 0 ? Math.round((activeRate / suppliedRate) * 100) : 0;
            node.status =
              node.efficiency === 0 && isOutputBufferFull
                ? 'backed_up'
                : node.efficiency >= 99
                ? 'optimal'
                : 'working';
          }
        } else {
          const fallbackOre = recipe?.outputs[0]?.itemName ?? 'Iron Ore';
          if (inPort) {
            inPort.label = fallbackOre;
            inPort.targetRatePerMin = 60;
          }
          const canDrainStoredOut = Boolean(outgoingConn && node.storedCount > 0.05);
          if (outPort) {
            outPort.label = fallbackOre;
            outPort.itemName = fallbackOre;
            outPort.targetRatePerMin = 60;
            outPort.actualRatePerMin = canDrainStoredOut
              ? Math.min(60, outgoingConn!.maxCapacityPerMin)
              : 0;
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
        const incomingConn = node.inputs[0]
          ? incomingConnByPortKey.get(`${node.id}:${node.inputs[0].id}`)
          : undefined;
        if (node.inputs[0]) {
          node.inputs[0].label = inItem ?? 'IN 1';
        }
        const activeOutConns = outgoingConnsByNodeId.get(node.id) ?? [];
        const splitCount = Math.max(1, activeOutConns.length);
        const perOutRate = activeOutConns.length > 0 ? Math.round(inRate / splitCount) : 0;

        for (const outPort of node.outputs) {
          const isConnected = outgoingConnByPortKey.has(`${node.id}:${outPort.id}`);
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
          const c = incomingConnByPortKey.get(`${node.id}:${inPort.id}`);
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
        const isContainerFull = node.storedCount >= maxCap - 0.01;

        const outPort = node.outputs[0];
        const outgoingConn = outPort
          ? outgoingConnByPortKey.get(`${node.id}:${outPort.id}`)
          : undefined;

        if (outPort) {
          // Storage Container can output incoming items OR discharge stored inventory onto a connected belt
          const dischargeRate =
            outgoingConn && node.storedCount > 0.05
              ? Math.max(totalIn, outgoingConn.maxCapacityPerMin)
              : totalIn;
          outPort.actualRatePerMin = outgoingConn
            ? Math.min(outgoingConn.maxCapacityPerMin, dischargeRate)
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
          node.status = isContainerFull && totalIn > effectiveOut ? 'backed_up' : 'optimal';
        } else {
          node.efficiency = 0;
          node.status = isContainerFull ? 'backed_up' : anyInTransit ? 'waiting' : 'idle';
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
            if ((incomingConn.sourceRatePerMin ?? 0) > 0 && !incomingConn.firstItemArrived) {
              anyInputInTransit = true;
            }
          }

          const itemMatches =
            !port.itemName ||
            port.itemName.toLowerCase() === req.itemName.toLowerCase();
          const beltSupplied = itemMatches ? port.actualRatePerMin : 0;
          // If the input slot has buffered ingredients (>= 0.05 items), the machine can draw from its internal input slot!
          const hasBufferedIngredient = (port.bufferedCount ?? 0) > 0.05;
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
        const isOutputFull = node.storedCount >= outMax - 0.01;
        const outgoingConn = outPort
          ? outgoingConnByPortKey.get(`${node.id}:${outPort.id}`)
          : undefined;

        if (isOutputFull) {
          const maxBeltOut = outgoingConn ? outgoingConn.maxCapacityPerMin : 0;
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
          // If output buffer has stored items and an output belt is connected, allow draining stored items
          if (outgoingConn && node.storedCount > 0.05 && craftedRate === 0) {
            pOut.actualRatePerMin = Math.min(
              spec.ratePerMin,
              outgoingConn.maxCapacityPerMin
            );
          } else {
            pOut.actualRatePerMin = craftedRate;
          }
        }
      }

      if (node.status !== prevStatus || node.efficiency !== prevEff) {
        anyChangeInPass = true;
      }
    }

    // Pass B: update belt entering rates & delivered rates (respecting full destination buffers)
    for (const conn of nextConns) {
      const fromNode = nodeMap.get(conn.fromNodeId);
      const toNode = nodeMap.get(conn.toNodeId);
      if (!fromNode || !toNode) continue;

      const outPort = fromNode.outputs.find((p) => p.id === conn.fromPortId);
      const inPort = toNode.inputs.find((p) => p.id === conn.toPortId);
      if (!outPort || !inPort) continue;

      // Determine how much the destination input port can accept if its internal buffer is 100% full
      let destMaxAcceptRate = conn.maxCapacityPerMin;
      if (toNode.buildingId === 'storage_container' || toNode.buildingId === 'the_hub') {
        const maxCap = toNode.maxStoredCount ?? 2400;
        if (toNode.storedCount >= maxCap - 0.01) {
          const dstOutConns = outgoingConnsByNodeId.get(toNode.id);
          const dstOutConn = dstOutConns?.[0];
          destMaxAcceptRate = dstOutConn
            ? Math.min(conn.maxCapacityPerMin, toNode.outputs[0]?.actualRatePerMin ?? 0)
            : 0;
        }
      } else if (toNode.recipeId && RECIPES[toNode.recipeId]) {
        const portMax = inPort.maxBuffer ?? 100;
        if ((inPort.bufferedCount ?? 0) >= portMax - 0.01) {
          const activeRatio =
            toNode.status === 'backed_up' ? 0 : (toNode.efficiency ?? 0) / 100;
          destMaxAcceptRate = Math.round(inPort.targetRatePerMin * activeRatio);
        }
      }

      const enteringRate = Math.min(
        conn.maxCapacityPerMin,
        outPort.actualRatePerMin,
        destMaxAcceptRate
      );
      const deliveredRate = conn.firstItemArrived ? enteringRate : 0;

      if (
        conn.sourceRatePerMin !== enteringRate ||
        conn.ratePerMin !== deliveredRate ||
        (outPort.itemName && conn.itemName !== outPort.itemName) ||
        inPort.actualRatePerMin !== deliveredRate
      ) {
        anyChangeInPass = true;
      }

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

    // Early-exit once flow propagation converges across the network
    if (pass >= 1 && !anyChangeInPass) {
      break;
    }
  }

  // Physical Belt Transit Step: advance tightly packed discrete items along each belt at exact Satisfactory m/s pace
  for (const conn of nextConns) {
    const tierDef = getBeltTierDef(conn.beltTier, conn.maxCapacityPerMin);
    const lengthPx = conn.lengthPx ?? 240;
    const enteringRate = conn.sourceRatePerMin ?? 0;
    const itemName = conn.itemName ?? 'Iron Ore';
    const items = conn.inFlightItems ?? [];

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
      for (let dist = lengthPx - idealSpacingPx * 0.5; dist >= 0; dist -= idealSpacingPx) {
        items.push({
          id: `${conn.id}_init_${Math.round(dist * 10)}`,
          itemName,
          distancePx: Number(dist.toFixed(2)),
        });
      }
      conn.spawnAccumulator = 0.5;
    }

    items.sort((a, b) => b.distancePx - a.distancePx);

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

    if (enteringRate > 0) {
      const itemsPerSec = enteringRate / 60;
      let acc = (conn.spawnAccumulator ?? 0) + itemsPerSec * dt;

      let safety = 0;
      while (acc >= 1 && safety < 64) {
        safety++;
        const lastPkt = remaining[remaining.length - 1];
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

  // Advance machine crafting cycle progress bars & Satisfactory internal input/output buffers using dt
  for (const node of nextNodes) {
    const recipe = node.recipeId ? RECIPES[node.recipeId] : null;
    const cycleSec = recipe?.cycleTimeSec ?? 2.0;

    if (node.efficiency > 0 && node.status !== 'backed_up') {
      const speedFactor = node.efficiency / 100;
      node.progress = (node.progress + (dt * speedFactor) / cycleSec) % 1;
    } else {
      node.progress = 0;
    }

    if (dt <= 0) continue;

    if (node.buildingId === 'storage_container' || node.buildingId === 'the_hub') {
      const inSum = node.inputs.reduce((acc, p) => acc + p.actualRatePerMin, 0);
      const outConns = outgoingConnsByNodeId.get(node.id);
      const outConn = outConns?.[0];
      const outSum = outConn ? (outConn.sourceRatePerMin ?? 0) : 0;
      const maxCap = node.maxStoredCount ?? 2400;
      const netPerSec = (inSum - outSum) / 60;
      node.storedCount = Math.min(maxCap, Math.max(0, node.storedCount + netPerSec * dt));
      if (node.outputs[0]) {
        node.outputs[0].bufferedCount = node.storedCount;
      }
      if (node.storedCount >= maxCap - 0.01 && inSum > outSum) {
        node.storedCount = maxCap;
        node.status = 'backed_up';
        if (outSum === 0) node.efficiency = 0;
      }
    } else if (recipe) {
      const activeRatio =
        node.status === 'backed_up' ? 0 : (node.efficiency ?? 0) / 100;

      // Update each input port's 1-stack internal buffer
      for (let i = 0; i < recipe.inputs.length; i++) {
        const req = recipe.inputs[i];
        const port = node.inputs[i];
        if (!port) continue;
        const maxBuf = port.maxBuffer ?? getItemStackSize(req.itemId || req.itemName);
        const arrivingPerSec = port.actualRatePerMin / 60;
        const consumedPerSec = (req.ratePerMin * activeRatio) / 60;
        const nextBuf = Math.min(
          maxBuf,
          Math.max(0, (port.bufferedCount ?? 0) + (arrivingPerSec - consumedPerSec) * dt)
        );
        port.bufferedCount = nextBuf;
      }

      // Update output port's 1-stack internal buffer (node.storedCount)
      const outSpec = recipe.outputs[0];
      if (outSpec) {
        const outMax = node.maxStoredCount ?? getItemStackSize(outSpec.itemId || outSpec.itemName);
        const outPort = node.outputs[0];
        const outConn = outPort
          ? outgoingConnByPortKey.get(`${node.id}:${outPort.id}`)
          : undefined;
        const producedPerSec = (outSpec.ratePerMin * activeRatio) / 60;
        const beltedOutPerSec = outConn ? (outConn.sourceRatePerMin ?? 0) / 60 : 0;
        const nextStored = Math.min(
          outMax,
          Math.max(0, node.storedCount + (producedPerSec - beltedOutPerSec) * dt)
        );
        node.storedCount = nextStored;
        if (outPort) {
          outPort.bufferedCount = nextStored;
          outPort.maxBuffer = outMax;
        }
        if (nextStored >= outMax - 0.01 && producedPerSec >= beltedOutPerSec) {
          node.storedCount = outMax;
          if (outPort) outPort.bufferedCount = outMax;
          node.status = 'backed_up';
          if (beltedOutPerSec <= 1e-4) {
            node.efficiency = 0;
            node.progress = 0;
          }
        }
      }
    }
  }

  return { nodes: nextNodes, connections: nextConns };
}
