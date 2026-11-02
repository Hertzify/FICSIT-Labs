import { BUILDINGS, RECIPES } from './catalog';
import {
  CameraState,
  ConveyorConnection,
  MachineNode,
  PortSocket,
  SaveSlot,
} from './types';

// Initial Sector 01 Map Boundaries (Large 3840x2160 sector, expandable in future updates)
export const WORLD_WIDTH = 3840;
export const WORLD_HEIGHT = 2160;
export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 1.85;
export const LOD_ICON_BOX_ZOOM_THRESHOLD = 0.55;
export const WORLD_PADDING = 24;

export function isMacroIconZoom(zoom: number): boolean {
  return zoom < LOD_ICON_BOX_ZOOM_THRESHOLD;
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
    // Center if zoomed out enough that entire sector width fits inside viewport
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
  recipeId: string | null
): { inputs: PortSocket[]; outputs: PortSocket[] } {
  const bDef = BUILDINGS[buildingId];
  if (!bDef) {
    return { inputs: [], outputs: [] };
  }
  const recipe = recipeId ? RECIPES[recipeId] : null;

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
    outputs.push({
      id: `${nodeId}_out_${i}`,
      index: i,
      side: 'output',
      label: out ? out.itemName : `OUT ${i + 1}`,
      itemName: out ? out.itemName : null,
      targetRatePerMin: out ? out.ratePerMin : 60,
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
  customRecipeId?: string | null
): MachineNode {
  const bDef = BUILDINGS[buildingId] ?? BUILDINGS.smelter;
  const id = customId ?? `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const recipeId = customRecipeId !== undefined ? customRecipeId : bDef.defaultRecipeId;
  const { inputs, outputs } = buildNodePorts(id, bDef.id, recipeId);

  return {
    id,
    buildingId: bDef.id,
    title: bDef.name,
    x,
    y,
    width: bDef.width,
    height: bDef.height,
    recipeId,
    status: 'idle',
    efficiency: 0,
    progress: 0,
    storedCount: 0,
    inputs,
    outputs,
  };
}

export function changeNodeRecipe(node: MachineNode, newRecipeId: string | null): MachineNode {
  const { inputs, outputs } = buildNodePorts(node.id, node.buildingId, newRecipeId);
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
 * Pure simulation tick: computes throughput along conveyor lines, updates machine
 * efficiency, status, progress bars, and storage counts.
 */
export function stepSimulation(
  nodes: MachineNode[],
  connections: ConveyorConnection[],
  rawDt: number
): { nodes: MachineNode[]; connections: ConveyorConnection[] } {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);

  const nextNodes: MachineNode[] = nodes.map((n) => ({
    ...n,
    inputs: n.inputs.map((p) => ({ ...p, actualRatePerMin: 0 })),
    outputs: n.outputs.map((p) => ({ ...p, actualRatePerMin: 0 })),
  }));
  const nextConns: ConveyorConnection[] = connections.map((c) => ({ ...c }));

  const nodeMap = new Map<string, MachineNode>();
  for (const n of nextNodes) {
    nodeMap.set(n.id, n);
  }

  // Multi-pass flow propagation so multi-stage chains update deterministically
  const maxPasses = Math.max(5, nextNodes.length);
  for (let pass = 0; pass < maxPasses; pass++) {
    // Pass A: compute each node's output rates from its current input rates
    for (const node of nextNodes) {
      const recipe = node.recipeId ? RECIPES[node.recipeId] : null;

      if (node.buildingId === 'resource_deposit') {
        const outRecipe = recipe ?? RECIPES.deposit_iron;
        const rate = outRecipe.outputs[0]?.ratePerMin ?? 60;
        const item = outRecipe.outputs[0]?.itemName ?? 'Iron Ore';
        if (node.outputs[0]) {
          node.outputs[0].actualRatePerMin = rate;
          node.outputs[0].targetRatePerMin = rate;
          node.outputs[0].itemName = item;
          node.outputs[0].label = item;
        }
        node.efficiency = 100;
        node.status = 'optimal';
      } else if (node.buildingId === 'splitter') {
        const inRate = node.inputs[0]?.actualRatePerMin ?? 0;
        const inItem = node.inputs[0]?.itemName ?? null;
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
        node.status = inRate > 0 ? 'optimal' : 'idle';
      } else if (node.buildingId === 'merger') {
        let totalIn = 0;
        let dominantItem: string | null = null;
        for (const inPort of node.inputs) {
          totalIn += inPort.actualRatePerMin;
          if (inPort.itemName && !dominantItem) {
            dominantItem = inPort.itemName;
          }
          inPort.label = inPort.itemName ?? `IN ${inPort.index + 1}`;
        }
        const cappedOut = Math.min(120, totalIn);
        if (node.outputs[0]) {
          node.outputs[0].actualRatePerMin = cappedOut;
          node.outputs[0].targetRatePerMin = 60;
          node.outputs[0].itemName = dominantItem;
          node.outputs[0].label = dominantItem ?? 'OUT 1';
        }
        node.efficiency = cappedOut > 0 ? 100 : 0;
        node.status = cappedOut > 0 ? 'optimal' : 'idle';
      } else if (node.buildingId === 'storage_container' || node.buildingId === 'the_hub') {
        let totalIn = 0;
        let itemLabel: string | null = null;
        for (const inPort of node.inputs) {
          totalIn += inPort.actualRatePerMin;
          if (inPort.itemName && !itemLabel) {
            itemLabel = inPort.itemName;
          }
          inPort.label = inPort.itemName ?? `IN ${inPort.index + 1}`;
        }
        if (node.outputs[0]) {
          node.outputs[0].actualRatePerMin = totalIn;
          node.outputs[0].itemName = itemLabel;
          node.outputs[0].label = itemLabel ?? 'OUT 1';
        }
        node.efficiency = totalIn > 0 ? 100 : 0;
        node.status = totalIn > 0 ? 'optimal' : 'idle';
      } else if (recipe) {
        // Production machine with recipe (Miner, Smelter, Constructor, Assembler)
        let limitingRatio = 1.0;
        let anyInputConnected = false;

        for (let i = 0; i < recipe.inputs.length; i++) {
          const req = recipe.inputs[i];
          const port = node.inputs[i];
          if (!port) continue;
          port.targetRatePerMin = req.ratePerMin;
          port.label = req.itemName;

          const hasConn = nextConns.some((c) => c.toNodeId === node.id && c.toPortId === port.id);
          if (hasConn) anyInputConnected = true;

          // Match item compatibility
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

    // Pass B: transfer output port rates across conveyor connections to input ports
    for (const conn of nextConns) {
      const fromNode = nodeMap.get(conn.fromNodeId);
      const toNode = nodeMap.get(conn.toNodeId);
      if (!fromNode || !toNode) continue;

      const outPort = fromNode.outputs.find((p) => p.id === conn.fromPortId);
      const inPort = toNode.inputs.find((p) => p.id === conn.toPortId);
      if (!outPort || !inPort) continue;

      const flowRate = Math.min(conn.maxCapacityPerMin, outPort.actualRatePerMin);
      conn.ratePerMin = flowRate;
      conn.itemName = outPort.itemName;

      inPort.actualRatePerMin = flowRate;
      if (outPort.itemName) {
        inPort.itemName = outPort.itemName;
      }
    }
  }

  // Advance progress bars & storage counts using dt
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
  const deposit = createMachineNode('resource_deposit', 48, 216, 'starter_deposit', 'deposit_iron');
  const miner = createMachineNode('miner_mk1', 408, 216, 'starter_miner', 'mine_iron');
  const smelter = createMachineNode('smelter', 792, 216, 'starter_smelter', 'smelt_iron');
  const constructorNode = createMachineNode(
    'constructor',
    1176,
    216,
    'starter_constructor',
    'construct_iron_plate'
  );
  const hub = createMachineNode('the_hub', 1560, 216, 'starter_hub', null);

  const rawConns: ConveyorConnection[] = [
    {
      id: 'conn_starter_1',
      fromNodeId: deposit.id,
      fromPortId: deposit.outputs[0].id,
      toNodeId: miner.id,
      toPortId: miner.inputs[0].id,
      itemName: 'Iron Ore',
      ratePerMin: 60,
      maxCapacityPerMin: 60,
    },
    {
      id: 'conn_starter_2',
      fromNodeId: miner.id,
      fromPortId: miner.outputs[0].id,
      toNodeId: smelter.id,
      toPortId: smelter.inputs[0].id,
      itemName: 'Iron Ore',
      ratePerMin: 60,
      maxCapacityPerMin: 60,
    },
    {
      id: 'conn_starter_3',
      fromNodeId: smelter.id,
      fromPortId: smelter.outputs[0].id,
      toNodeId: constructorNode.id,
      toPortId: constructorNode.inputs[0].id,
      itemName: 'Iron Ingot',
      ratePerMin: 30,
      maxCapacityPerMin: 60,
    },
    {
      id: 'conn_starter_4',
      fromNodeId: constructorNode.id,
      fromPortId: constructorNode.outputs[0].id,
      toNodeId: hub.id,
      toPortId: hub.inputs[0].id,
      itemName: 'Iron Plate',
      ratePerMin: 20,
      maxCapacityPerMin: 60,
    },
  ];

  return stepSimulation([deposit, miner, smelter, constructorNode, hub], rawConns, 0.016);
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
      nodes: parsed.nodes,
      connections: parsed.connections,
      camera: parsed.camera ?? { x: 40, y: 80, zoom: 0.9 },
    };
    return { slot };
  } catch {
    return { error: 'Could not parse JSON string. Please check your copied save data.' };
  }
}
