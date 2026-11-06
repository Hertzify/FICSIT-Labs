import {
  BUILDINGS,
  CONVEYOR_BELT_TIERS,
  getBuildingMaxStorage,
  getItemStackSize,
  PURITY_CONFIG,
  RECIPES,
  SECTOR_01_DEPOSIT_SPECS,
  STORAGE_CONTAINER_SLOTS,
} from './catalog';
import { stepSimulation } from './simulation';
import {
  ConveyorBeltTier,
  ConveyorBeltTierDef,
  ConveyorConnection,
  MachineNode,
  PortSocket,
  ResourcePurity,
  SaveSlot,
} from './types';

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

  const isLogistics = buildingId === 'splitter' || buildingId === 'merger';
  const inputs: PortSocket[] = [];
  for (let i = 0; i < bDef.inputPortCount; i++) {
    const ing = recipe?.inputs[i] ?? null;
    const stackLimit = isLogistics
      ? getBuildingMaxStorage(buildingId, null, null)
      : getItemStackSize(ing?.itemId ?? ing?.itemName ?? null);
    inputs.push({
      id: `${nodeId}_in_${i}`,
      index: i,
      side: 'input',
      label: ing ? ing.itemName : `IN ${i + 1}`,
      itemName: ing ? ing.itemName : null,
      targetRatePerMin: ing ? ing.ratePerMin : 60,
      actualRatePerMin: 0,
      bufferedCount: 0,
      maxBuffer: stackLimit,
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
    const stackLimit =
      buildingId === 'storage_container'
        ? STORAGE_CONTAINER_SLOTS * getItemStackSize(out?.itemId ?? out?.itemName ?? null)
        : isLogistics
        ? getBuildingMaxStorage(buildingId, null, null)
        : getItemStackSize(out?.itemId ?? out?.itemName ?? null);
    outputs.push({
      id: `${nodeId}_out_${i}`,
      index: i,
      side: 'output',
      label: out ? out.itemName : `OUT ${i + 1}`,
      itemName: out ? out.itemName : null,
      targetRatePerMin: rate,
      actualRatePerMin: 0,
      bufferedCount: 0,
      maxBuffer: stackLimit,
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
  const maxStoredCount = getBuildingMaxStorage(bDef.id, recipeId, outputs[0]?.itemName ?? null);
  const maxInputStoredCount = inputs.reduce((acc, p) => acc + (p.maxBuffer ?? 100), 0);

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
    clockSpeedPct: 100,
    powerShards: 0,
    isStandby: false,
    inputStoredCount: 0,
    maxInputStoredCount,
    storedCount: 0,
    maxStoredCount,
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

  const result: MachineNode[] = filtered.map((n): MachineNode => {
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
          inputs: [],
          outputs: [],
          inputStoredCount: 0,
          maxInputStoredCount: 0,
        };
      }
    }

    // Rebuild default ports if a saved node is missing its port arrays
    const templatePorts =
      !Array.isArray(n.inputs) ||
      !Array.isArray(n.outputs) ||
      (bDef &&
        n.buildingId !== 'miner_mk1' &&
        n.buildingId !== 'resource_deposit' &&
        n.inputs.length === 0 &&
        bDef.inputPortCount > 0) ||
      (bDef &&
        n.buildingId !== 'resource_deposit' &&
        n.outputs.length === 0 &&
        bDef.outputPortCount > 0)
        ? buildNodePorts(n.id, n.buildingId, n.recipeId, n.purity)
        : null;

    // In Satisfactory, Miner Mk.1 has 0 input ports and only 1 output storage buffer!
    const rawInputs =
      n.buildingId === 'miner_mk1' || n.buildingId === 'resource_deposit'
        ? []
        : Array.isArray(n.inputs) && n.inputs.length > 0
        ? n.inputs
        : templatePorts?.inputs ?? [];

    const rawOutputs =
      n.buildingId === 'resource_deposit'
        ? []
        : Array.isArray(n.outputs) && n.outputs.length > 0
        ? n.outputs
        : templatePorts?.outputs ?? [];

    // Migrate legacy starter_hub y=2772 to 2808 so its input port aligns straight with starter_constructor
    const migratedY = n.id === 'starter_hub' && n.y === 2772 ? 2808 : n.y;
    const recipe = n.recipeId ? RECIPES[n.recipeId] : null;
    const activeItemName =
      rawOutputs[0]?.itemName ??
      rawInputs.find((p) => p.itemName)?.itemName ??
      recipe?.outputs[0]?.itemName ??
      null;

    const computedMaxStored = getBuildingMaxStorage(
      n.buildingId,
      n.recipeId,
      activeItemName
    );
    const maxStoredCount = Math.max(computedMaxStored, n.maxStoredCount ?? 0);

    const syncedInputs = rawInputs.map((p, idx) => {
      const rIn = recipe?.inputs[idx];
      const portStackLimit =
        n.buildingId === 'splitter' || n.buildingId === 'merger'
          ? getBuildingMaxStorage(n.buildingId, null, null)
          : Math.max(
              p.maxBuffer ?? 0,
              getItemStackSize(rIn?.itemId ?? rIn?.itemName ?? p.itemName ?? null)
            );
      return {
        ...p,
        maxBuffer: portStackLimit,
        bufferedCount: Math.min(portStackLimit, Math.max(0, Math.round(p.bufferedCount ?? 0))),
      };
    });

    let inputStoredCount = syncedInputs.reduce(
      (acc, p) => acc + (p.bufferedCount ?? 0),
      0
    );
    const savedInputTotal = Math.max(0, Math.round(n.inputStoredCount ?? 0));
    if (savedInputTotal > inputStoredCount && syncedInputs.length > 0) {
      let rem = savedInputTotal - inputStoredCount;
      for (const inp of syncedInputs) {
        if (rem <= 0) break;
        const cap = inp.maxBuffer ?? 100;
        const cur = inp.bufferedCount ?? 0;
        const add = Math.min(rem, Math.max(0, cap - cur));
        inp.bufferedCount = cur + add;
        rem -= add;
      }
      inputStoredCount = syncedInputs.reduce(
        (acc, p) => acc + (p.bufferedCount ?? 0),
        0
      );
    }

    const maxInputStoredCount = syncedInputs.reduce(
      (acc, p) => acc + (p.maxBuffer ?? 100),
      0
    );
    const rawStored = Math.max(
      n.storedCount ?? 0,
      rawOutputs[0]?.bufferedCount ?? 0
    );
    const storedCount = Math.min(maxStoredCount, Math.max(0, Math.round(rawStored)));
    const syncedOutputs = rawOutputs.map((p, idx) =>
      idx === 0
        ? { ...p, maxBuffer: maxStoredCount, bufferedCount: storedCount }
        : { ...p, bufferedCount: Math.max(0, Math.round(p.bufferedCount ?? 0)) }
    );
    return {
      ...n,
      y: migratedY,
      width: syncedWidth,
      height: syncedHeight,
      inputs: syncedInputs,
      outputs: syncedOutputs,
      inputStoredCount,
      maxInputStoredCount,
      maxStoredCount,
      storedCount,
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

  // Ensure every Miner Mk.1 is concentrically mounted on an unoccupied Resource Deposit (limit: 1 miner per deposit)
  const deposits = result.filter((n) => n.buildingId === 'resource_deposit');
  const claimedDepositIds = new Set<string>();

  // Pass 1: Lock miners that are already concentrically mounted on a deposit
  for (const node of result) {
    if (node.buildingId !== 'miner_mk1') continue;
    const directDep = deposits.find(
      (d) =>
        !claimedDepositIds.has(d.id) &&
        Math.abs(node.x - d.x) <= 4 &&
        Math.abs(node.y - d.y) <= 4
    );
    if (directDep) {
      node.x = directDep.x;
      node.y = directDep.y;
      claimedDepositIds.add(directDep.id);
    }
  }

  // Pass 2: Snap any offset/displaced miner onto the nearest unoccupied deposit within range
  for (const node of result) {
    if (node.buildingId !== 'miner_mk1') continue;
    const isAlreadyMounted = deposits.some(
      (d) => claimedDepositIds.has(d.id) && node.x === d.x && node.y === d.y
    );
    if (isAlreadyMounted) continue;

    let bestDep: MachineNode | null = null;
    let bestDist = Infinity;
    for (const d of deposits) {
      if (claimedDepositIds.has(d.id)) continue;
      const dist = Math.hypot(node.x - d.x, node.y - d.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestDep = d;
      }
    }
    if (bestDep && (bestDist <= 600 || node.id === 'starter_miner')) {
      node.x = bestDep.x;
      node.y = bestDep.y;
      claimedDepositIds.add(bestDep.id);
    }
  }

  // Always order ground resource deposits first so mounted miners render and hit-test cleanly on top
  result.sort((a, b) => {
    if (a.buildingId === 'resource_deposit' && b.buildingId !== 'resource_deposit') return -1;
    if (a.buildingId !== 'resource_deposit' && b.buildingId === 'resource_deposit') return 1;
    return 0;
  });

  return result;
}

export function changeNodeRecipe(node: MachineNode, newRecipeId: string | null): MachineNode {
  const { inputs, outputs } = buildNodePorts(
    node.id,
    node.buildingId,
    newRecipeId,
    node.purity
  );
  const maxStoredCount = getBuildingMaxStorage(
    node.buildingId,
    newRecipeId,
    outputs[0]?.itemName ?? null
  );
  const maxInputStoredCount = inputs.reduce((acc, p) => acc + (p.maxBuffer ?? 100), 0);
  return {
    ...node,
    recipeId: newRecipeId,
    inputs,
    outputs,
    progress: 0,
    inputStoredCount: 0,
    maxInputStoredCount,
    storedCount: 0,
    maxStoredCount,
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

export function createStarterFactory(): {
  nodes: MachineNode[];
  connections: ConveyorConnection[];
} {
  const worldDeposits = createSectorWorldDeposits();
  const starterDeposit = worldDeposits.find((d) => d.id === 'starter_deposit')!;

  const baseX = starterDeposit.x;
  const baseY = starterDeposit.y;

  // In Satisfactory, Miner Mk.1 is built directly ON TOP of the planetary Resource Deposit!
  const miner = createMachineNode('miner_mk1', baseX, baseY, 'starter_miner', 'mine_iron');
  const smelter = createMachineNode(
    'smelter',
    baseX + 408,
    baseY,
    'starter_smelter',
    'smelt_iron'
  );
  const constructorNode = createMachineNode(
    'constructor',
    baseX + 816,
    baseY,
    'starter_constructor',
    'construct_iron_plate'
  );
  // Place starter_hub at baseY + 24 so its Input 1 (+72px) sits at baseY + 96px,
  // forming a 100% straight horizontal conveyor belt from starter_constructor!
  const hub = createMachineNode('the_hub', baseX + 1224, baseY + 24, 'starter_hub', null);

  const rawConns: ConveyorConnection[] = [
    {
      id: 'conn_starter_1',
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
      id: 'conn_starter_2',
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
      id: 'conn_starter_3',
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
    const syncedNodes = ensureWorldDepositsPresent(parsed.nodes);
    const sim = stepSimulation(syncedNodes, parsed.connections, 0);
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
      nodes: sim.nodes,
      connections: sim.connections,
      camera: parsed.camera ?? { x: 40, y: 80, zoom: 0.9 },
    };
    return { slot };
  } catch {
    return { error: 'Could not parse JSON string. Please check your copied save data.' };
  }
}
