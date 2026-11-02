import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDING_LIST } from './catalog';
import { ITEM_ICON_PATHS, getItemIconUrl } from './icons';
import {
  canConnectPorts,
  changeNodeRecipe,
  clampCameraToWorld,
  clampNodeToWorld,
  computeConveyorBeltFlowVisuals,
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

  const far = clampNodeToWorld(99999, 99999, 268, 140);
  assert.equal(far.x, WORLD_WIDTH - 268 - 24);
  assert.equal(far.y, WORLD_HEIGHT - 140 - 24);
  assert.equal(WORLD_WIDTH, 12000);
  assert.equal(WORLD_HEIGHT, 8000);
});

test('clampCameraToWorld constrains zoom and isMacroIconZoom requires 0.25x zoom-out threshold', () => {
  const zoomedOut = clampCameraToWorld({ x: -99999, y: -99999, zoom: 0.02 }, 1440, 900);
  assert.equal(zoomedOut.zoom, 0.06);
  assert.equal(isMacroIconZoom(0.06), true);
  assert.equal(isMacroIconZoom(0.24), true);
  // At 0.25x and 0.30x zoom, detailed cards still show (user must zoom out below 0.25x)
  assert.equal(isMacroIconZoom(0.25), false);
  assert.equal(isMacroIconZoom(0.30), false);
  assert.equal(isMacroIconZoom(0.75), false);
});

test('computeConveyorBeltFlowVisuals is strictly adaptive down to every single digit (1/m .. 9/m)', () => {
  const zero = computeConveyorBeltFlowVisuals(0);
  assert.equal(zero.dotCount, 0);
  assert.equal(zero.speedMultiplier, 0);

  // Verify every single-digit rate 1..9 produces a strictly increasing speedMultiplier and decreasing spacingRatio
  for (let r = 1; r <= 9; r++) {
    const curr = computeConveyorBeltFlowVisuals(r);
    const next = computeConveyorBeltFlowVisuals(r + 1);
    assert.ok(
      curr.speedMultiplier < next.speedMultiplier,
      `Expected speed at ${r}/m (${curr.speedMultiplier}) < speed at ${r + 1}/m (${next.speedMultiplier})`
    );
    assert.ok(
      curr.spacingRatio > next.spacingRatio,
      `Expected spacingRatio at ${r}/m > spacingRatio at ${r + 1}/m`
    );
  }

  const slow = computeConveyorBeltFlowVisuals(4);
  const medium = computeConveyorBeltFlowVisuals(30);
  const normal = computeConveyorBeltFlowVisuals(60);
  const pure = computeConveyorBeltFlowVisuals(120);

  assert.ok(slow.speedMultiplier < medium.speedMultiplier);
  assert.ok(medium.speedMultiplier < normal.speedMultiplier);
  assert.ok(normal.speedMultiplier < pure.speedMultiplier);

  assert.ok(slow.dotCount < normal.dotCount);
  assert.ok(normal.dotCount < pure.dotCount);
});

test('32 natural world resource deposits are scattered in clusters with Impure (30), Normal (60), and Pure (120) qualities', () => {
  assert.equal(
    BUILDING_LIST.some((b) => b.id === 'resource_deposit'),
    false,
    'Resource Deposits should not be buildable in the Build Menu'
  );

  const starter = createStarterFactory();
  const deposits = starter.nodes.filter((n) => n.buildingId === 'resource_deposit');
  assert.equal(deposits.length, 32);

  const impureDep = deposits.find((d) => d.purity === 'impure')!;
  const normalDep = deposits.find((d) => d.purity === 'normal')!;
  const pureDep = deposits.find((d) => d.purity === 'pure')!;

  assert.equal(impureDep.outputs[0].actualRatePerMin, 30);
  assert.equal(normalDep.outputs[0].actualRatePerMin, 60);
  assert.equal(pureDep.outputs[0].actualRatePerMin, 120);

  // Connecting a Miner Mk.1 to a Pure Copper Deposit extracts 120/min Copper Ore
  const pureCopper = deposits.find(
    (d) => d.purity === 'pure' && d.recipeId === 'deposit_copper'
  )!;
  const miner = createMachineNode('miner_mk1', 2900, 384, 'test_pure_miner');
  const sim = stepSimulation(
    [pureCopper, miner],
    [
      {
        id: 'c_pure',
        fromNodeId: pureCopper.id,
        fromPortId: pureCopper.outputs[0].id,
        toNodeId: miner.id,
        toPortId: miner.inputs[0].id,
        itemName: null,
        ratePerMin: 0,
        maxCapacityPerMin: 120,
      },
    ],
    0.016
  );
  const updatedMiner = sim.nodes.find((n) => n.id === miner.id)!;
  assert.equal(updatedMiner.efficiency, 100);
  assert.equal(updatedMiner.outputs[0].itemName, 'Copper Ore');
  assert.equal(updatedMiner.outputs[0].actualRatePerMin, 120);
});

test('all 13 Satisfactory Wiki resource and part icons resolve cleanly', () => {
  assert.equal(Object.keys(ITEM_ICON_PATHS).length, 13);
  assert.ok(getItemIconUrl('Iron Ore')?.endsWith('iron_ore.png'));
  assert.ok(getItemIconUrl('Copper Ingot')?.endsWith('copper_ingot.png'));
  assert.ok(getItemIconUrl('Screws')?.endsWith('screw.png'));
  assert.ok(getItemIconUrl('Reinforced Plate')?.endsWith('reinforced_plate.png'));
  assert.ok(getItemIconUrl('Rotor')?.endsWith('rotor.png'));
});

test('canConnectPorts and changeNodeRecipe work as expected', () => {
  const miner = createMachineNode('miner_mk1', 0, 0, 'm1', 'mine_iron');
  const smelter = createMachineNode('smelter', 300, 0, 's1', 'smelt_iron');
  const nodes = [miner, smelter];

  assert.equal(
    canConnectPorts(nodes, [], miner.id, miner.outputs[0].id, miner.id, miner.inputs[0].id)
      .valid,
    false
  );
  assert.equal(
    canConnectPorts(
      nodes,
      [],
      miner.id,
      miner.outputs[0].id,
      smelter.id,
      smelter.inputs[0].id
    ).valid,
    true
  );

  const constructorNode = createMachineNode('constructor', 0, 0, 'c1', 'construct_iron_plate');
  const updated = changeNodeRecipe(constructorNode, 'construct_iron_rod');
  assert.equal(updated.outputs[0].label, 'Iron Rod');
  assert.equal(updated.outputs[0].targetRatePerMin, 15);
});

test('serializeSaveExport and parseSaveImport round-trip save slot and ensure 32 world deposits', () => {
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
  assert.equal(parsed.slot.nodes.length, 36);
});

test('version tracking matches 0.0.05 dev build', () => {
  assert.equal(APP_VERSION, '0.0.05');
  assert.equal(APP_BUILD_TAG, '0.0.05 dev build');
});
