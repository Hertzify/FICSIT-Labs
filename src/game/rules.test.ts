import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canConnectPorts,
  changeNodeRecipe,
  clampCameraToWorld,
  clampNodeToWorld,
  createMachineNode,
  createStarterFactory,
  isMacroIconZoom,
  parseSaveImport,
  serializeSaveExport,
  snapToGrid,
  stepSimulation,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './rules';
import { APP_BUILD_TAG, APP_VERSION } from './version';

test('snapToGrid snaps coordinates only when enabled', () => {
  assert.equal(snapToGrid(37, 24, true), 48);
  assert.equal(snapToGrid(11, 24, true), 0);
  assert.equal(snapToGrid(37.4, 24, false), 37);
});

test('clampNodeToWorld keeps nodes inside bounded sector limits', () => {
  const neg = clampNodeToWorld(-250, -100, 268, 140);
  assert.equal(neg.x, 24);
  assert.equal(neg.y, 24);

  const far = clampNodeToWorld(9999, 9999, 268, 140);
  assert.equal(far.x, WORLD_WIDTH - 268 - 24);
  assert.equal(far.y, WORLD_HEIGHT - 140 - 24);
});

test('clampCameraToWorld constrains zoom and pan within sector bounds and isMacroIconZoom detects LOD', () => {
  const zoomedOut = clampCameraToWorld({ x: -99999, y: -99999, zoom: 0.05 }, 1440, 900);
  assert.equal(zoomedOut.zoom, 0.15);
  assert.equal(isMacroIconZoom(0.15), true);
  assert.equal(isMacroIconZoom(0.45), true);
  assert.equal(isMacroIconZoom(0.75), false);
  assert.ok(zoomedOut.x > -5000);
  assert.ok(zoomedOut.y > -5000);
});

test('canConnectPorts validates self-loops, duplicate lines, and valid connections', () => {
  const miner = createMachineNode('miner_mk1', 0, 0, 'm1', 'mine_iron');
  const smelter = createMachineNode('smelter', 300, 0, 's1', 'smelt_iron');
  const nodes = [miner, smelter];

  // Self connection is rejected
  const selfRes = canConnectPorts(nodes, [], miner.id, miner.outputs[0].id, miner.id, miner.inputs[0].id);
  assert.equal(selfRes.valid, false);

  // Valid output -> input connection succeeds
  const validRes = canConnectPorts(
    nodes,
    [],
    miner.id,
    miner.outputs[0].id,
    smelter.id,
    smelter.inputs[0].id
  );
  assert.equal(validRes.valid, true);

  // Occupying the same port is rejected
  const existing = [
    {
      id: 'c1',
      fromNodeId: miner.id,
      fromPortId: miner.outputs[0].id,
      toNodeId: smelter.id,
      toPortId: smelter.inputs[0].id,
      itemName: 'Iron Ore',
      ratePerMin: 60,
      maxCapacityPerMin: 60,
    },
  ];
  const dupRes = canConnectPorts(
    nodes,
    existing,
    miner.id,
    miner.outputs[0].id,
    smelter.id,
    smelter.inputs[0].id
  );
  assert.equal(dupRes.valid, false);
});

test('createStarterFactory and stepSimulation propagate 100% optimal throughput', () => {
  const starter = createStarterFactory();
  assert.equal(starter.nodes.length, 5);
  assert.equal(starter.connections.length, 4);

  const smelter = starter.nodes.find((n) => n.buildingId === 'smelter')!;
  const constructorNode = starter.nodes.find((n) => n.buildingId === 'constructor')!;
  const hub = starter.nodes.find((n) => n.buildingId === 'the_hub')!;

  assert.equal(smelter.efficiency, 100);
  assert.equal(smelter.status, 'optimal');
  assert.equal(smelter.outputs[0].actualRatePerMin, 30);

  assert.equal(constructorNode.efficiency, 100);
  assert.equal(constructorNode.outputs[0].actualRatePerMin, 20);

  const ticked = stepSimulation(starter.nodes, starter.connections, 0.05);
  const tickedHub = ticked.nodes.find((n) => n.id === hub.id)!;
  assert.ok(tickedHub.storedCount > 0);
});

test('changeNodeRecipe updates port labels and target rates', () => {
  const constructorNode = createMachineNode('constructor', 0, 0, 'c1', 'construct_iron_plate');
  assert.equal(constructorNode.outputs[0].label, 'Iron Plate');
  assert.equal(constructorNode.outputs[0].targetRatePerMin, 20);

  const updated = changeNodeRecipe(constructorNode, 'construct_iron_rod');
  assert.equal(updated.outputs[0].label, 'Iron Rod');
  assert.equal(updated.outputs[0].targetRatePerMin, 15);
});

test('serializeSaveExport and parseSaveImport round-trip save slot cleanly', () => {
  const starter = createStarterFactory();
  const raw = serializeSaveExport({
    id: 'test_slot',
    sessionName: 'Alpha Sector',
    slotName: 'Manual Save 1',
    kind: 'manual',
    updatedAt: 1700000000000,
    nodes: starter.nodes,
    connections: starter.connections,
    camera: { x: 10, y: 20, zoom: 1 },
  });

  const parsed = parseSaveImport(raw);
  assert.equal(parsed.error, undefined);
  assert.ok(parsed.slot);
  assert.equal(parsed.slot.sessionName, 'Alpha Sector');
  assert.equal(parsed.slot.nodes.length, 5);
});

test('version tracking matches 0.0.03 dev build', () => {
  assert.equal(APP_VERSION, '0.0.03');
  assert.equal(APP_BUILD_TAG, '0.0.03 dev build');
});



