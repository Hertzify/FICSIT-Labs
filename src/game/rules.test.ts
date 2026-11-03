import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDING_LIST, CONVEYOR_BELT_TIERS } from './catalog';
import { BUILDING_ICON_PATHS, ITEM_ICON_PATHS, getItemIconUrl } from './icons';
import {
  canConnectPorts,
  changeNodeRecipe,
  clampCameraToWorld,
  clampNodeToWorld,
  computeNodeSnapAlignment,
  computeOrthogonalConveyorPath,
  createConveyorConnection,
  createMachineNode,
  createStarterFactory,
  doesPathIntersectNode,
  doNodesOverlap,
  findConveyorCrossings,
  getCachedConveyorRoute,
  getPortWorldPosition,
  isMacroIconZoom,
  isNodePositionValid,
  parseSaveImport,
  sampleOrthogonalPath,
  serializeSaveExport,
  snapToGrid,
  stepSimulation,
  upgradeConveyorBeltTier,
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

test('getCachedConveyorRoute reuses cached belt paths when stationary and invalidates when any node moves', () => {
  const miner = createMachineNode('miner_mk1', 400, 1200, 'cache_miner');
  const smelter = createMachineNode('smelter', 800, 1200, 'cache_smelter');
  const nodes = [miner, smelter];

  const routeA = getCachedConveyorRoute(miner, 0, smelter, 0, nodes);
  const routeB = getCachedConveyorRoute(miner, 0, smelter, 0, nodes);
  assert.equal(routeA, routeB, 'Expected identical cached route object reference when no nodes moved');

  const movedSmelter = { ...smelter, x: 960 };
  const routeMoved = getCachedConveyorRoute(miner, 0, movedSmelter, 0, [miner, movedSmelter]);
  assert.notEqual(routeMoved, routeA);
  assert.ok(routeMoved.lengthPx > routeA.lengthPx);
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
});

test('Satisfactory Conveyor Belt tiers (Mk.1 60/m @ 1.2m/s .. Mk.6 1200/m @ 24m/s) enforce tight 1.2m (18px) item spacing and travel pace', () => {
  assert.equal(CONVEYOR_BELT_TIERS[1].capacityPerMin, 60);
  assert.equal(CONVEYOR_BELT_TIERS[1].speedMetersPerSec, 1.2);
  assert.equal(CONVEYOR_BELT_TIERS[1].speedPxPerSec, 18);

  assert.equal(CONVEYOR_BELT_TIERS[2].capacityPerMin, 120);
  assert.equal(CONVEYOR_BELT_TIERS[2].speedMetersPerSec, 2.4);
  assert.equal(CONVEYOR_BELT_TIERS[2].speedPxPerSec, 36);

  assert.equal(CONVEYOR_BELT_TIERS[3].capacityPerMin, 270);
  assert.equal(CONVEYOR_BELT_TIERS[3].speedMetersPerSec, 5.4);
  assert.equal(CONVEYOR_BELT_TIERS[4].capacityPerMin, 480);
  assert.equal(CONVEYOR_BELT_TIERS[4].speedMetersPerSec, 9.6);
  assert.equal(CONVEYOR_BELT_TIERS[5].capacityPerMin, 780);
  assert.equal(CONVEYOR_BELT_TIERS[5].speedMetersPerSec, 15.6);
  assert.equal(CONVEYOR_BELT_TIERS[6].capacityPerMin, 1200);
  assert.equal(CONVEYOR_BELT_TIERS[6].speedMetersPerSec, 24.0);

  const starter = createStarterFactory();
  // Starter belt 1 (60/m on Mk.1 belt, ~151px long) should have tightly packed items every 18px (1.2m)
  const starterBelt1 = starter.connections.find((c) => c.id === 'conn_starter_1')!;
  assert.ok((starterBelt1.inFlightItems?.length ?? 0) >= 7);
  const gap01 = Math.abs(
    starterBelt1.inFlightItems![0].distancePx - starterBelt1.inFlightItems![1].distancePx
  );
  assert.ok(
    Math.abs(gap01 - 18) < 0.5,
    `Expected tight 18px (1.2m) bumper-to-bumper item spacing on full 60/m Mk.1 belt, got ${gap01}px`
  );

  const pureCopper = starter.nodes.find(
    (d) => d.buildingId === 'resource_deposit' && d.purity === 'pure' && d.recipeId === 'deposit_copper'
  )!;
  // Place a Miner 450px away from the Pure Copper deposit (belt length ~ 197px = ~13.1m)
  const miner = createMachineNode('miner_mk1', pureCopper.x + 450, pureCopper.y, 'distant_miner');

  // Connect using a Mk.1 belt (60/min capacity, 1.2 m/s = 18 px/s speed)
  const mk1Conn = createConveyorConnection(
    pureCopper.id,
    pureCopper.outputs[0].id,
    miner.id,
    miner.inputs[0].id,
    1,
    'conn_mk1_distant'
  );
  assert.equal(mk1Conn.beltTier, 1);
  assert.equal(mk1Conn.maxCapacityPerMin, 60);
  assert.equal(mk1Conn.firstItemArrived, false);

  // Step 3 seconds (54px traveled at 18px/s): 3 tightly squeezed items on belt, not arrived yet!
  let simNodes = [pureCopper, miner];
  let simConns = [mk1Conn];
  for (let i = 0; i < 3; i++) {
    const next = stepSimulation(simNodes, simConns, 1.0);
    simNodes = next.nodes;
    simConns = next.connections;
  }
  const connEarly = simConns[0];
  const minerEarly = simNodes.find((n) => n.id === miner.id)!;
  assert.equal(connEarly.firstItemArrived, false);
  assert.equal(connEarly.ratePerMin, 0);
  assert.equal(connEarly.sourceRatePerMin, 60); // Capped by Mk.1 belt at 60/m even though deposit is Pure 120/m
  assert.ok((connEarly.inFlightItems?.length ?? 0) >= 3);
  assert.equal(minerEarly.status, 'waiting');
  assert.equal(minerEarly.outputs[0].actualRatePerMin, 0);

  // Step enough seconds for the leading packet to travel the full belt length at 18 px/s (1.2 m/s)
  for (let i = 0; i < 12; i++) {
    const next = stepSimulation(simNodes, simConns, 1.0);
    simNodes = next.nodes;
    simConns = next.connections;
  }

  const connArrived = simConns[0];
  const minerArrived = simNodes.find((n) => n.id === miner.id)!;
  assert.equal(connArrived.firstItemArrived, true);
  assert.equal(connArrived.ratePerMin, 60); // Mk.1 bottlenecked to 60/min
  assert.equal(minerArrived.outputs[0].actualRatePerMin, 60);

  // Upgrade the belt to Mk.2 (120/min capacity, 2.4 m/s = 36 px/s speed)
  const upgradedConn = upgradeConveyorBeltTier(connArrived, 2);
  const afterUpgrade = stepSimulation(simNodes, [upgradedConn], 0.5);
  const minerMk2 = afterUpgrade.nodes.find((n) => n.id === miner.id)!;
  assert.equal(afterUpgrade.connections[0].maxCapacityPerMin, 120);
  assert.equal(afterUpgrade.connections[0].ratePerMin, 120);
  assert.equal(minerMk2.outputs[0].actualRatePerMin, 120);
});

test('all 13 Satisfactory Wiki resource/part icons and 6 Conveyor Belt Mk.1-Mk.6 icons resolve cleanly', () => {
  assert.equal(Object.keys(ITEM_ICON_PATHS).length, 13);
  assert.ok(getItemIconUrl('Iron Ore')?.endsWith('iron_ore.png'));
  assert.ok(getItemIconUrl('Copper Ingot')?.endsWith('copper_ingot.png'));
  assert.ok(getItemIconUrl('Screws')?.endsWith('screw.png'));
  assert.ok(getItemIconUrl('Reinforced Plate')?.endsWith('reinforced_plate.png'));
  assert.ok(getItemIconUrl('Rotor')?.endsWith('rotor.png'));
  assert.ok(BUILDING_ICON_PATHS.conveyor_belt_mk1?.endsWith('conveyor_belt_mk1.png'));
  assert.ok(BUILDING_ICON_PATHS.conveyor_belt_mk2?.endsWith('conveyor_belt_mk2.png'));
  assert.ok(BUILDING_ICON_PATHS.conveyor_belt_mk6?.endsWith('conveyor_belt_mk6.png'));
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

test('version tracking matches 0.0.13 dev build', () => {
  assert.equal(APP_VERSION, '0.0.13');
  assert.equal(APP_BUILD_TAG, '0.0.13 dev build');
});

test('doNodesOverlap and isNodePositionValid enforce strict no-overlap rule between buildings', () => {
  const nodeA = createMachineNode('smelter', 100, 100, 'smelter_a');
  const nodeB = createMachineNode('constructor', 150, 120, 'constructor_b'); // Overlaps A
  const nodeC = createMachineNode('constructor', 500, 500, 'constructor_c'); // Far away

  assert.equal(doNodesOverlap(nodeA, nodeB), true);
  assert.equal(doNodesOverlap(nodeA, nodeC), false);

  const checkColliding = isNodePositionValid([nodeA, nodeC], nodeB);
  assert.equal(checkColliding.valid, false);
  assert.equal(checkColliding.collidingNode?.id, nodeA.id);

  const checkFree = isNodePositionValid([nodeA, nodeC], {
    x: 900,
    y: 900,
    width: 260,
    height: 140,
  });
  assert.equal(checkFree.valid, true);
});

test('computeOrthogonalConveyorPath produces clean 90-degree orthogonal routing and avoids obstacle nodes with clearance', () => {
  const startX = 100;
  const startY = 100;
  const endX = 600;
  const endY = 250;

  // Clear path without obstacles
  const clearPath = computeOrthogonalConveyorPath(startX, startY, endX, endY, []);
  assert.ok(clearPath.length >= 2);
  for (let i = 1; i < clearPath.length; i++) {
    const isHorizontal = Math.abs(clearPath[i].y - clearPath[i - 1].y) < 1e-4;
    const isVertical = Math.abs(clearPath[i].x - clearPath[i - 1].x) < 1e-4;
    assert.ok(
      isHorizontal || isVertical,
      `Expected purely 90-degree orthogonal segment, got (${clearPath[i - 1].x}, ${clearPath[i - 1].y}) -> (${clearPath[i].x}, ${clearPath[i].y})`
    );
  }

  // Obstacle right in the center corridor (midX = 350)
  const obstacleSmelter = createMachineNode('smelter', 320, 80, 'obs_smelter');
  const routedPath = computeOrthogonalConveyorPath(startX, startY, endX, endY, [obstacleSmelter]);
  assert.equal(doesPathIntersectNode(routedPath, obstacleSmelter, 12), false);

  // When wrapping around fromNode (e.g. backward connection), path never intersects or hugs fromNode
  const srcMachine = createMachineNode('miner_mk1', 400, 400, 'src_miner');
  const dstMachine = createMachineNode('smelter', 100, 200, 'dst_smelter');
  // Output port on right of srcMachine (x = 668, y = 470), target input port on left of dstMachine (x = 100, y = 270)
  const wrapPath = computeOrthogonalConveyorPath(
    srcMachine.x + srcMachine.width,
    srcMachine.y + 70,
    dstMachine.x,
    dstMachine.y + 70,
    [srcMachine, dstMachine],
    srcMachine,
    dstMachine
  );
  // Verify wrapPath is 90-degree orthogonal
  for (let i = 1; i < wrapPath.length; i++) {
    const isH = Math.abs(wrapPath[i].y - wrapPath[i - 1].y) < 1e-4;
    const isV = Math.abs(wrapPath[i].x - wrapPath[i - 1].x) < 1e-4;
    assert.ok(isH || isV);
  }
  // Internal segments of wrapPath must never intersect srcMachine or dstMachine bounding boxes
  const internalSegments = wrapPath.slice(1, -1);
  assert.equal(doesPathIntersectNode(internalSegments, srcMachine, 12), false);
  assert.equal(doesPathIntersectNode(internalSegments, dstMachine, 12), false);

  // Vertically aligned nodes (Miner Mk.1 above Iron Node) route cleanly through the gap between them,
  // never looping far upward even when distant deposits exist on the same X column
  const distantUpperDeposit = createMachineNode('resource_deposit', 240, 200, 'distant_dep');
  const ironNode = createMachineNode('resource_deposit', 240, 1200, 'iron_dep');
  const minerAbove = createMachineNode('miner_mk1', 192, 1008, 'miner_above'); // bottom = 1148, gap = 52px (1148..1200)
  const vPath = computeOrthogonalConveyorPath(
    ironNode.x + ironNode.width,
    ironNode.y + 88,
    minerAbove.x,
    minerAbove.y + 88,
    [distantUpperDeposit, ironNode, minerAbove],
    ironNode,
    minerAbove
  );
  // Every point of vPath must stay strictly between minerAbove.y and ironNode.y + ironNode.height (routes through the middle gap!)
  for (const pt of vPath) {
    assert.ok(
      pt.y >= minerAbove.y && pt.y <= ironNode.y + ironNode.height,
      `Expected vertical alignment belt to pass between the two nodes, got y=${pt.y}`
    );
  }

  // Tightly stacked vertical nodes (only 12px gap < 24px) also route directly through the gap without looping above
  const minerTight = createMachineNode('miner_mk1', 192, ironNode.y - 140 - 12, 'miner_tight');
  const tightVPath = computeOrthogonalConveyorPath(
    ironNode.x + ironNode.width,
    ironNode.y + 88,
    minerTight.x,
    minerTight.y + 88,
    [ironNode, minerTight],
    ironNode,
    minerTight
  );
  for (const pt of tightVPath) {
    assert.ok(
      pt.y >= minerTight.y && pt.y <= ironNode.y + ironNode.height,
      `Expected tight vertical belt to pass through 12px gap without looping above, got y=${pt.y}`
    );
  }

  // Closely placed horizontal nodes (24px apart, < 2 * STUB = 44px) connect via a direct horizontal segment without looping
  const closeSmelter = createMachineNode('smelter', 1000, 1000, 'close_smelter');
  const closeConstructor = createMachineNode(
    'constructor',
    closeSmelter.x + closeSmelter.width + 24,
    1000,
    'close_constructor'
  );
  const closeHPath = computeOrthogonalConveyorPath(
    closeSmelter.x + closeSmelter.width,
    closeSmelter.y + 88,
    closeConstructor.x,
    closeConstructor.y + 88,
    [closeSmelter, closeConstructor],
    closeSmelter,
    closeConstructor
  );
  assert.equal(closeHPath.length, 2, 'Expected straight 2-point horizontal belt when nodes are 24px apart');
  assert.equal(closeHPath[0].y, closeSmelter.y + 88);
  assert.equal(closeHPath[1].y, closeConstructor.y + 88);

  // Moving a connected node further away or into vertical alignment enforces physical transfer speed along the new orthogonal path
  const starter = createStarterFactory();
  const starterMiner = starter.nodes.find((n) => n.id === 'starter_miner')!;
  const starterDeposit = starter.nodes.find((n) => n.id === 'starter_deposit')!;
  // Move starter_miner directly above starter_deposit (stretching the orthogonal belt length)
  const movedNodes = starter.nodes.map((n) =>
    n.id === starterMiner.id ? { ...n, x: starterDeposit.x - 24, y: starterDeposit.y - 192 } : n
  );
  const afterMove = stepSimulation(movedNodes, starter.connections, 0.1);
  const movedConn = afterMove.connections.find((c) => c.id === 'conn_starter_1')!;
  // Because the belt path is now longer than before, firstItemArrived must be false and items must physically travel the new distance
  assert.equal(movedConn.firstItemArrived, false);
  assert.equal(movedConn.ratePerMin, 0);
});

test('sampleOrthogonalPath accurately samples progress and tangent angle along 90-degree polyline', () => {
  const polyline = [
    { x: 0, y: 100 },
    { x: 100, y: 100 }, // 100px horizontal east (angle = 0)
    { x: 100, y: 200 }, // 100px vertical south (angle = PI/2)
  ];

  const atStart = sampleOrthogonalPath(polyline, 0);
  assert.equal(atStart.x, 0);
  assert.equal(atStart.y, 100);

  const atCorner = sampleOrthogonalPath(polyline, 0.5);
  assert.equal(atCorner.x, 100);
  assert.equal(atCorner.y, 100);

  const atMidDown = sampleOrthogonalPath(polyline, 0.75);
  assert.equal(atMidDown.x, 100);
  assert.equal(atMidDown.y, 150);
  assert.ok(Math.abs(atMidDown.angle - Math.PI / 2) < 1e-4);

  const atEnd = sampleOrthogonalPath(polyline, 1.0);
  assert.equal(atEnd.x, 100);
  assert.equal(atEnd.y, 200);
});

test('findConveyorCrossings detects perpendicular crossings for elevated overpass rendering', () => {
  // Horizontal path from (0, 100) to (200, 100)
  const pathH = {
    connId: 'conn_h',
    pts: [
      { x: 0, y: 100 },
      { x: 200, y: 100 },
    ],
  };

  // Vertical path from (100, 0) to (100, 200) crossing at (100, 100)
  const pathV = {
    connId: 'conn_v',
    pts: [
      { x: 100, y: 0 },
      { x: 100, y: 200 },
    ],
  };

  const crossings = findConveyorCrossings([pathH, pathV]);
  assert.equal(crossings.length, 1);
  assert.equal(crossings[0].x, 100);
  assert.equal(crossings[0].y, 100);
});

test('belt transit state stays consistent during incremental node drags and front-gap scenarios', () => {
  let { nodes, connections } = createStarterFactory();
  // Run initial tick to populate starter belt items
  ({ nodes, connections } = stepSimulation(nodes, connections, 0.05));

  const smelterId = 'starter_smelter';
  // 1. Move smelter closer first (clipping items to shorter belt length)
  nodes = nodes.map((n) => (n.id === smelterId ? { ...n, x: n.x - 48 } : n));
  ({ nodes, connections } = stepSimulation(nodes, connections, 0.05));

  // 2. Now drag smelter outward in small 3px increments per 28ms frame (20 frames = +60px gap)
  for (let i = 0; i < 20; i++) {
    nodes = nodes.map((n) => (n.id === smelterId ? { ...n, x: n.x + 3 } : n));
    ({ nodes, connections } = stepSimulation(nodes, connections, 0.028));
    const conn2 = connections.find((c) => c.id === 'conn_starter_2')!;
    assert.equal(
      conn2.firstItemArrived,
      false,
      `Expected belt to be in transit on incremental drag step ${i + 1}`
    );
    assert.equal(conn2.ratePerMin, 0);
  }

  // 3. After sufficient travel time (~4 seconds for 60px at 18px/s), items reach the destination and resume 60/m
  for (let i = 0; i < 45; i++) {
    ({ nodes, connections } = stepSimulation(nodes, connections, 0.1));
  }
  const settledConn2 = connections.find((c) => c.id === 'conn_starter_2')!;
  assert.equal(settledConn2.firstItemArrived, true);
  assert.equal(settledConn2.ratePerMin, 60);
});

test('standardized port heights produce 100% straight 2-point horizontal belts across aligned buildings and starter chain', () => {
  const y = 2400;
  const deposit = createMachineNode('resource_deposit', 240, y, 'dep');
  const miner = createMachineNode('miner_mk1', 600, y, 'min');
  const smelter = createMachineNode('smelter', 960, y, 'smelt');
  const constructorNode = createMachineNode('constructor', 1320, y, 'const');
  const storage = createMachineNode('storage_container', 1680, y, 'stor');

  const dOut = getPortWorldPosition(deposit, 'output', 0, deposit.outputs.length);
  const mIn = getPortWorldPosition(miner, 'input', 0, miner.inputs.length);
  const mOut = getPortWorldPosition(miner, 'output', 0, miner.outputs.length);
  const sIn = getPortWorldPosition(smelter, 'input', 0, smelter.inputs.length);
  const cIn = getPortWorldPosition(constructorNode, 'input', 0, constructorNode.inputs.length);
  const stIn = getPortWorldPosition(storage, 'input', 0, storage.inputs.length);

  assert.equal(dOut.y, y + 96);
  assert.equal(mIn.y, y + 96);
  assert.equal(mOut.y, y + 96);
  assert.equal(sIn.y, y + 96);
  assert.equal(cIn.y, y + 96);
  assert.equal(stIn.y, y + 96);

  const beltPts = computeOrthogonalConveyorPath(
    dOut.x,
    dOut.y,
    mIn.x,
    mIn.y,
    [deposit, miner],
    deposit,
    miner
  );
  assert.equal(beltPts.length, 2, 'Expected perfectly straight 2-point horizontal belt');
  assert.equal(beltPts[0].y, beltPts[1].y);

  // Verify all 4 starter factory belts are 100% straight 2-point horizontal lines
  const starter = createStarterFactory();
  for (const conn of starter.connections) {
    const fn = starter.nodes.find((n) => n.id === conn.fromNodeId)!;
    const tn = starter.nodes.find((n) => n.id === conn.toNodeId)!;
    const p1 = getPortWorldPosition(fn, 'output', 0, fn.outputs.length);
    const p2 = getPortWorldPosition(tn, 'input', 0, tn.inputs.length);
    const path = computeOrthogonalConveyorPath(p1.x, p1.y, p2.x, p2.y, starter.nodes, fn, tn);
    assert.equal(
      path.length,
      2,
      `Expected starter connection ${conn.id} to be a straight 2-point belt, got ${path.length} points`
    );
    assert.equal(path[0].y, path[1].y);
  }
});

test('computeNodeSnapAlignment magnetically snaps to connected ports, nearby ports, and building centers with laser guidelines', () => {
  const smelter = createMachineNode('smelter', 1000, 1200, 'smelter_1');
  const constructorNode = createMachineNode('constructor', 1400, 1200, 'constructor_1');
  const conn = createConveyorConnection(
    smelter.id,
    smelter.outputs[0].id,
    constructorNode.id,
    constructorNode.inputs[0].id,
    1,
    'conn_1'
  );

  // 1. Drag connected constructor slightly off-axis (y = 1211, within 18px magnetic threshold of 1200)
  const snapConnected = computeNodeSnapAlignment(
    {
      id: constructorNode.id,
      buildingId: constructorNode.buildingId,
      x: 1400,
      y: 1211,
      width: constructorNode.width,
      height: constructorNode.height,
    },
    [smelter, constructorNode],
    [conn],
    { gridSnap: true, gridSize: 24, snapMode: true }
  );
  assert.equal(snapConnected.y, 1200, 'Should magnetically snap connected port back to y=1200');
  assert.equal(snapConnected.snappedY, true);
  assert.ok(
    snapConnected.guidelines.some((g) => g.kind === 'port' && g.axis === 'horizontal'),
    'Should emit horizontal port laser guideline'
  );

  // 2. Placing a new unconnected building near smelter's output port snaps to port Y and emits laser
  const snapGhost = computeNodeSnapAlignment(
    {
      buildingId: 'storage_container',
      x: 1420,
      y: 1189, // 11px away from 1200
      width: 260,
      height: 144,
    },
    [smelter],
    [],
    { gridSnap: true, gridSize: 24, snapMode: true }
  );
  assert.equal(snapGhost.y, 1200);
  assert.ok(snapGhost.guidelines.some((g) => g.kind === 'port'));

  // 3. When snapMode is false, falls back to standard grid snapping with zero guidelines
  const snapDisabled = computeNodeSnapAlignment(
    {
      buildingId: 'storage_container',
      x: 1420,
      y: 1189,
      width: 260,
      height: 144,
    },
    [smelter],
    [],
    { gridSnap: true, gridSize: 24, snapMode: false }
  );
  assert.equal(snapDisabled.guidelines.length, 0);
});


