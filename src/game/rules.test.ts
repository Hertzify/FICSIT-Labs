import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILDING_LIST,
  CONVEYOR_BELT_TIERS,
  formatDualRatePerMin,
  formatRatePerMin,
  PURITY_CONFIG,
} from './catalog';
import { BUILDING_ICON_PATHS, ITEM_ICON_PATHS, getItemIconUrl } from './icons';
import { cloneSaveGraph, DEFAULT_SETTINGS } from './storage';
import {
  canConnectPorts,
  changeNodeRecipe,
  clampCameraToWorld,
  clampNodeToWorld,
  computeConveyorPathWithWaypoints,
  computeFilletedConveyorPath,
  computeNodeSnapAlignment,
  computeOrthogonalConveyorPath,
  createConveyorConnection,
  createMachineNode,
  createStarterFactory,
  distanceFromPointToPolyline,
  distanceFromPointToSegment,
  doesPathIntersectNode,
  doNodesOverlap,
  ensureWorldDepositsPresent,
  findConveyorCrossings,
  getCachedConveyorRoute,
  getPortWorldPosition,
  isMacroIconZoom,
  isNodePositionValid,
  parseSaveImport,
  sampleFilletedPath,
  sampleOrthogonalPath,
  serializeSaveExport,
  snapToGrid,
  stepSimulation,
  upgradeConveyorBeltTier,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './rules';
import { ConveyorConnection, MachineNode } from './types';
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

  // Zooming out completely to MIN_ZOOM does not clamp min/max to a single locked point
  const atMinZoom = clampCameraToWorld({ x: 350, y: 210, zoom: 0.06 }, 1440, 900);
  assert.equal(atMinZoom.zoom, 0.06);
  assert.equal(atMinZoom.x, 350);
  assert.equal(atMinZoom.y, 210);
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

  assert.equal(PURITY_CONFIG[impureDep.purity!].ratePerMin, 30);
  assert.equal(PURITY_CONFIG[normalDep.purity!].ratePerMin, 60);
  assert.equal(PURITY_CONFIG[pureDep.purity!].ratePerMin, 120);

  // In Satisfactory, natural resource deposits have 0 conveyor ports (players build miners on top of them)
  assert.equal(impureDep.outputs.length, 0);
  assert.equal(normalDep.outputs.length, 0);
  assert.equal(pureDep.outputs.length, 0);
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
  // In Satisfactory, place a Miner directly on top of the Pure Copper deposit!
  const miner = createMachineNode('miner_mk1', pureCopper.x, pureCopper.y, 'pure_miner', 'mine_copper');
  // Place a Smelter 450px away
  const smelter = createMachineNode('smelter', pureCopper.x + 450, pureCopper.y, 'distant_smelter', 'smelt_copper');

  // Connect using a Mk.1 belt (60/min capacity, 1.2 m/s = 18 px/s speed)
  const mk1Conn = createConveyorConnection(
    miner.id,
    miner.outputs[0].id,
    smelter.id,
    smelter.inputs[0].id,
    1,
    'conn_mk1_distant'
  );
  assert.equal(mk1Conn.beltTier, 1);
  assert.equal(mk1Conn.maxCapacityPerMin, 60);
  assert.equal(mk1Conn.firstItemArrived, false);

  // Step 3 seconds (54px traveled at 18px/s): 3 tightly squeezed items on belt, not arrived yet!
  let simNodes = [pureCopper, miner, smelter];
  let simConns = [mk1Conn];
  for (let i = 0; i < 3; i++) {
    const next = stepSimulation(simNodes, simConns, 1.0);
    simNodes = next.nodes;
    simConns = next.connections;
  }
  const connEarly = simConns[0];
  const smelterEarly = simNodes.find((n) => n.id === smelter.id)!;
  assert.equal(connEarly.firstItemArrived, false);
  assert.equal(connEarly.ratePerMin, 0);
  assert.equal(connEarly.sourceRatePerMin, 60); // Capped by Mk.1 belt at 60/m even though deposit is Pure 120/m
  assert.ok((connEarly.inFlightItems?.length ?? 0) >= 3);
  assert.equal(smelterEarly.status, 'waiting');
  assert.equal(smelterEarly.inputs[0].bufferedCount, 0);

  // Step enough seconds for the leading packet to travel the full belt length at 18 px/s (1.2 m/s)
  for (let i = 0; i < 12; i++) {
    const next = stepSimulation(simNodes, simConns, 1.0);
    simNodes = next.nodes;
    simConns = next.connections;
  }

  const connArrived = simConns[0];
  const smelterArrived = simNodes.find((n) => n.id === smelter.id)!;
  assert.equal(connArrived.firstItemArrived, true);
  assert.equal(connArrived.ratePerMin, 60); // Mk.1 bottlenecked to 60/min
  assert.ok((smelterArrived.inputs[0].bufferedCount ?? 0) >= 1);

  // Upgrade the belt to Mk.2 (120/min capacity, 2.4 m/s = 36 px/s speed)
  const upgradedConn = upgradeConveyorBeltTier(connArrived, 2);
  const afterUpgrade = stepSimulation(simNodes, [upgradedConn], 0.5);
  const minerMk2 = afterUpgrade.nodes.find((n) => n.id === miner.id)!;
  assert.equal(afterUpgrade.connections[0].maxCapacityPerMin, 120);
  assert.equal(afterUpgrade.connections[0].ratePerMin, 120);
  assert.equal(minerMk2.outputs[0].actualRatePerMin, 120);
});

test('all 15 Satisfactory Wiki resource/part/artifact icons and 6 Conveyor Belt Mk.1-Mk.6 icons resolve cleanly', () => {
  assert.equal(Object.keys(ITEM_ICON_PATHS).length, 15);
  assert.ok(getItemIconUrl('Iron Ore')?.endsWith('iron_ore.png'));
  assert.ok(getItemIconUrl('Copper Ingot')?.endsWith('copper_ingot.png'));
  assert.ok(getItemIconUrl('Screws')?.endsWith('screw.png'));
  assert.ok(getItemIconUrl('Reinforced Plate')?.endsWith('reinforced_plate.png'));
  assert.ok(getItemIconUrl('Rotor')?.endsWith('rotor.png'));
  assert.ok(getItemIconUrl('Power Shard')?.endsWith('power_shard.png'));
  assert.ok(getItemIconUrl('Somersloop')?.endsWith('somersloop.png'));
  assert.ok(BUILDING_ICON_PATHS.conveyor_belt_mk1?.endsWith('conveyor_belt_mk1.png'));
  assert.ok(BUILDING_ICON_PATHS.conveyor_belt_mk2?.endsWith('conveyor_belt_mk2.png'));
  assert.ok(BUILDING_ICON_PATHS.conveyor_belt_mk6?.endsWith('conveyor_belt_mk6.png'));
});

test('canConnectPorts and changeNodeRecipe work as expected', () => {
  const miner = createMachineNode('miner_mk1', 0, 0, 'm1', 'mine_iron');
  const smelter = createMachineNode('smelter', 300, 0, 's1', 'smelt_iron');
  const nodes = [miner, smelter];

  assert.equal(miner.inputs.length, 0);
  assert.equal(
    canConnectPorts(nodes, [], smelter.id, smelter.outputs[0].id, smelter.id, smelter.inputs[0].id)
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

test('version tracking matches 0.0.2 Initial Release', () => {
  assert.equal(APP_VERSION, '0.0.2');
  assert.equal(APP_BUILD_TAG, '0.0.2 Initial Release');
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

  // In Satisfactory, a Miner Mk.1 CAN be built directly on top of a Resource Deposit:
  const deposit = createMachineNode('resource_deposit', 1000, 1000, 'deposit_ground');
  const minerOnDeposit = createMachineNode('miner_mk1', 1000, 1000, 'miner_mounted');
  const miner2OnDeposit = createMachineNode('miner_mk1', 1000, 1000, 'miner_second');
  const smelterOnDeposit = createMachineNode('smelter', 1000, 1000, 'smelter_mounted');

  // Miner on deposit is permitted!
  assert.equal(isNodePositionValid([deposit], minerOnDeposit).valid, true);
  // Smelter on deposit is blocked!
  assert.equal(isNodePositionValid([deposit], smelterOnDeposit).valid, false);
  // A second miner on an already occupied deposit is blocked!
  assert.equal(isNodePositionValid([deposit, minerOnDeposit], miner2OnDeposit).valid, false);
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

test('computeFilletedConveyorPath and sampleFilletedPath provide smooth circular fillet arcs and multiple rotation angles around 90-degree corners', () => {
  const polyline = [
    { x: 0, y: 100 },
    { x: 100, y: 100 }, // 100px east (angle = 0)
    { x: 100, y: 200 }, // 100px south (angle = PI/2)
  ];

  const filleted = computeFilletedConveyorPath(polyline, 10);
  assert.ok(filleted.segments.length >= 3, 'Expected line, arc, line segments');
  assert.equal(filleted.segments[0].type, 'line');
  assert.equal(filleted.segments[1].type, 'arc');
  assert.equal(filleted.segments[2].type, 'line');

  // Before corner: tangent angle is 0 rad (0 deg)
  const beforeCorner = sampleFilletedPath(filleted, 50);
  assert.ok(Math.abs(beforeCorner.angle) < 1e-4);

  // Sample multiple distinct angles through the 90-degree corner arc
  const arcStartDist = filleted.segments[0].length;
  const arcLen = filleted.segments[1].length;

  const sampleQuarter = sampleFilletedPath(filleted, arcStartDist + arcLen * 0.25);
  const sampleHalf = sampleFilletedPath(filleted, arcStartDist + arcLen * 0.5);
  const sampleThreeQuarter = sampleFilletedPath(filleted, arcStartDist + arcLen * 0.75);

  // Quarter turn (~22.5 deg = ~0.3927 rad)
  assert.ok(Math.abs(sampleQuarter.angle - Math.PI / 8) < 0.05);
  // Half turn (45 deg = ~0.7854 rad)
  assert.ok(Math.abs(sampleHalf.angle - Math.PI / 4) < 0.05);
  // Three quarter turn (~67.5 deg = ~1.178 rad)
  assert.ok(Math.abs(sampleThreeQuarter.angle - (3 * Math.PI) / 8) < 0.05);

  // All three intermediate rotation angles are strictly increasing and distinct!
  assert.ok(sampleQuarter.angle < sampleHalf.angle);
  assert.ok(sampleHalf.angle < sampleThreeQuarter.angle);
  assert.ok(sampleThreeQuarter.angle < Math.PI / 2);

  // After corner: tangent angle is strictly PI/2 (90 deg)
  const afterCorner = sampleFilletedPath(filleted, filleted.totalLength - 10);
  assert.ok(Math.abs(afterCorner.angle - Math.PI / 2) < 1e-4);
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
    const conn1 = connections.find((c) => c.id === 'conn_starter_1')!;
    assert.equal(
      conn1.firstItemArrived,
      false,
      `Expected belt to be in transit on incremental drag step ${i + 1}`
    );
    assert.equal(conn1.ratePerMin, 0);
  }

  // 3. After sufficient travel time (~4 seconds for 60px at 18px/s), items reach the destination and resume 60/m
  for (let i = 0; i < 45; i++) {
    ({ nodes, connections } = stepSimulation(nodes, connections, 0.1));
  }
  const settledConn1 = connections.find((c) => c.id === 'conn_starter_1')!;
  assert.equal(settledConn1.firstItemArrived, true);
  assert.equal(settledConn1.ratePerMin, 60);
});

test('standardized port heights produce 100% straight 2-point horizontal belts across aligned buildings and starter chain', () => {
  const y = 2400;
  const miner = createMachineNode('miner_mk1', 240, y, 'min');
  const smelter = createMachineNode('smelter', 600, y, 'smelt');
  const constructorNode = createMachineNode('constructor', 960, y, 'const');
  const storage = createMachineNode('storage_container', 1320, y, 'stor');

  const mOut = getPortWorldPosition(miner, 'output', 0, miner.outputs.length);
  const sIn = getPortWorldPosition(smelter, 'input', 0, smelter.inputs.length);
  const sOut = getPortWorldPosition(smelter, 'output', 0, smelter.outputs.length);
  const cIn = getPortWorldPosition(constructorNode, 'input', 0, constructorNode.inputs.length);
  const cOut = getPortWorldPosition(constructorNode, 'output', 0, constructorNode.outputs.length);
  const stIn = getPortWorldPosition(storage, 'input', 0, storage.inputs.length);

  assert.equal(mOut.y, y + 96);
  assert.equal(sIn.y, y + 96);
  assert.equal(sOut.y, y + 96);
  assert.equal(cIn.y, y + 96);
  assert.equal(cOut.y, y + 96);
  assert.equal(stIn.y, y + 96);

  const beltPts = computeOrthogonalConveyorPath(
    mOut.x,
    mOut.y,
    sIn.x,
    sIn.y,
    [miner, smelter],
    miner,
    smelter
  );
  assert.equal(beltPts.length, 2, 'Expected perfectly straight 2-point horizontal belt');
  assert.equal(beltPts[0].y, beltPts[1].y);

  // Verify all 3 starter factory belts are 100% straight 2-point horizontal lines
  const starter = createStarterFactory();
  assert.equal(starter.connections.length, 3);
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

test('nodes maintain both input and output storages and belt items visually get stuck and wait when destination input storage is full', () => {
  const deposit = createMachineNode('resource_deposit', 240, 2000, 'dep_iron', 'deposit_iron', {
    purity: 'normal',
  });
  const miner = createMachineNode('miner_mk1', 240, 2000, 'miner_1', 'mine_iron');
  const smelter = createMachineNode('smelter', 648, 2000, 'smelter_1', 'smelt_iron');
  const assembler = createMachineNode(
    'assembler',
    1056,
    2000,
    'assembler_1',
    'assemble_reinforced_plate'
  );

  // In Satisfactory Option A and C:
  // Resource deposit is a ground feature with 0 conveyor ports
  assert.equal(deposit.inputs.length, 0);
  assert.equal(deposit.outputs.length, 0);

  // Miner sits directly on top of deposit with 0 inputs and 1 output storage buffer
  assert.equal(miner.inputs.length, 0);
  assert.equal(miner.maxInputStoredCount, 0);
  assert.equal(miner.outputs[0].maxBuffer, 100);
  assert.equal(miner.maxStoredCount, 100);

  // Processors maintain dual input and output storages
  assert.equal(smelter.inputs[0].maxBuffer, 100);
  assert.equal(smelter.outputs[0].maxBuffer, 100);
  assert.equal(smelter.maxInputStoredCount, 100);
  assert.equal(smelter.maxStoredCount, 100);

  // Assembler has 2 inputs: Iron Plate (200) + Screws (500) = 700 total input storage, and 1 output: Reinforced Plate (100)
  assert.equal(assembler.inputs[0].maxBuffer, 200);
  assert.equal(assembler.inputs[1].maxBuffer, 500);
  assert.equal(assembler.maxInputStoredCount, 700);
  assert.equal(assembler.maxStoredCount, 100);

  const connMinerToSmelter = createConveyorConnection(
    miner.id,
    miner.outputs[0].id,
    smelter.id,
    smelter.inputs[0].id,
    1,
    'conn_miner_smelter'
  );

  // Set Smelter's Output Storage (100/100) and Input Storage (100/100) to FULL (no output belt connected)
  smelter.storedCount = 100;
  smelter.outputs[0].bufferedCount = 100;
  smelter.inputs[0].bufferedCount = 100;
  smelter.inputStoredCount = 100;

  let simNodes: MachineNode[] = [deposit, miner, smelter];
  let simConns: ConveyorConnection[] = [
    { ...connMinerToSmelter, firstItemArrived: true, inFlightItems: undefined },
  ];

  // Step simulation so items on the belt between Miner and Smelter hit the full Smelter input port and queue up
  for (let i = 0; i < 15; i++) {
    const res = stepSimulation(simNodes, simConns, 1.0);
    simNodes = res.nodes;
    simConns = res.connections;
  }

  const stalledBelt = simConns.find((c) => c.id === 'conn_miner_smelter')!;
  const beltLen = stalledBelt.lengthPx!;
  const beltItems = stalledBelt.inFlightItems!;

  // Verify the belt is marked backed up, delivered rate is 0, and items did NOT vanish — they are queued on the belt!
  assert.equal(stalledBelt.isBackedUp, true);
  assert.equal(stalledBelt.ratePerMin, 0);
  assert.ok(beltItems.length >= 6, `Expected items to remain queued on belt, got ${beltItems.length}`);

  // Leading item is stopped right at the destination input port (distancePx === beltLen) and marked stalled
  assert.equal(beltItems[0].distancePx, beltLen);
  assert.equal(beltItems[0].stalled, true);

  // Second and third items are queued tightly behind it at 18px (1.2m) intervals and marked stalled
  assert.equal(beltItems[1].distancePx, beltLen - 18);
  assert.equal(beltItems[1].stalled, true);
  assert.equal(beltItems[2].distancePx, beltLen - 36);
  assert.equal(beltItems[2].stalled, true);

  // Step another 1 second while Smelter input storage is still full: stuck items must NOT move at all!
  const snapshotDistances = beltItems.map((p) => p.distancePx);
  const frozenStep = stepSimulation(simNodes, simConns, 1.0);
  const frozenBelt = frozenStep.connections.find((c) => c.id === 'conn_miner_smelter')!;
  assert.deepEqual(
    frozenBelt.inFlightItems!.slice(0, 4).map((p) => p.distancePx),
    snapshotDistances.slice(0, 4),
    'Stuck items on belt must not move while destination input storage is full'
  );

  // Also verify that because the belt backed up all the way to the Miner's output port, the Miner's Output Storage started filling up!
  const minerAfterBackup = frozenStep.nodes.find((n) => n.id === miner.id)!;
  assert.ok(
    minerAfterBackup.storedCount > 0,
    `Expected Miner output storage to accumulate items once outgoing belt is jammed, got ${minerAfterBackup.storedCount}`
  );

  // Now free space in the Smelter's Input & Output Storage (e.g. player flushes storage or drains output)
  simNodes = frozenStep.nodes.map((n) =>
    n.id === smelter.id
      ? {
          ...n,
          storedCount: 0,
          inputStoredCount: 0,
          inputs: n.inputs.map((p) => ({ ...p, bufferedCount: 0 })),
          outputs: n.outputs.map((p) => ({ ...p, bufferedCount: 0 })),
        }
      : n
  );
  simConns = frozenStep.connections;

  // Step 0.5 seconds: the waiting front item enters the Smelter (+1 discrete item) and queued items on the belt immediately resume moving!
  const resumedStep = stepSimulation(simNodes, simConns, 0.5);
  const resumedBelt = resumedStep.connections.find((c) => c.id === 'conn_miner_smelter')!;
  const resumedSmelter = resumedStep.nodes.find((n) => n.id === smelter.id)!;
  assert.equal(resumedBelt.isBackedUp, false);
  assert.equal(resumedBelt.ratePerMin, 60);
  assert.equal(resumedBelt.inFlightItems![0].stalled, false);
  assert.ok(
    (resumedSmelter.inputs[0]?.bufferedCount ?? 0) >= 1,
    'Arriving belt item must increment destination input storage as a real discrete resource'
  );

  // Case B: Smelter Input Storage is 100/100 while Output Storage is 0/100 (actively smelting 1 ore every 2.0s)
  // During the 2.0s smelting cycle while IN is 100/100, arriving belt items CANNOT enter and must line up and wait!
  simNodes = resumedStep.nodes.map((n) =>
    n.id === smelter.id
      ? {
          ...n,
          progress: 0,
          storedCount: 0,
          inputStoredCount: 100,
          inputs: n.inputs.map((p) => ({ ...p, bufferedCount: 100 })),
          outputs: n.outputs.map((p) => ({ ...p, bufferedCount: 0 })),
        }
      : n
  );
  simConns = resumedStep.connections;

  // Step 1.5 seconds (1.0s + 0.5s; Smelter cycle is 2.0s, so at 1.5s progress = 0.75 and 0 items have been consumed yet -> IN is still 100/100!)
  const step1s = stepSimulation(simNodes, simConns, 1.0);
  const midCycleStep = stepSimulation(step1s.nodes, step1s.connections, 0.5);
  const midCycleSmelter = midCycleStep.nodes.find((n) => n.id === smelter.id)!;
  const midCycleBelt = midCycleStep.connections.find((c) => c.id === 'conn_miner_smelter')!;
  assert.equal(
    midCycleSmelter.inputs[0].bufferedCount,
    100,
    'Smelter input storage must remain an exact integer 100/100 during its 2.0s crafting cycle'
  );
  assert.equal(midCycleBelt.inFlightItems![0].distancePx, beltLen);
  assert.equal(midCycleBelt.inFlightItems![0].stalled, true);
  assert.equal(midCycleBelt.inFlightItems![1].distancePx, beltLen - 18);
  assert.equal(midCycleBelt.inFlightItems![1].stalled, true);

  // Step another 0.6 seconds (total 2.1s > 2.0s cycle): Smelter finishes 1 cycle (consuming 1 ore: 100 -> 99, producing 1 ingot: 0 -> 1),
  // and 1 waiting item from the front of the belt steps into that 1 free spot (99 -> 100)!
  const postCycleStep = stepSimulation(midCycleStep.nodes, midCycleStep.connections, 0.6);
  const postCycleSmelter = postCycleStep.nodes.find((n) => n.id === smelter.id)!;
  assert.equal(
    postCycleSmelter.storedCount,
    1,
    'Expected Smelter to produce 1 discrete Iron Ingot after completing 2.0s cycle'
  );
  assert.equal(
    postCycleSmelter.inputs[0].bufferedCount,
    100,
    'Expected 1 waiting belt item to enter the 99/100 free spot and bring input storage back to 100/100'
  );
});

test('Miner Mk.1 strictly stops mining when moved away from Resource Deposit (0/m extraction, starved status, no wireless mining)', () => {
  const deposit = createMachineNode('resource_deposit', 1000, 1000, 'deposit_node');
  deposit.purity = 'normal'; // 60/m

  // 1. Miner placed directly on top of the deposit
  const minerOn = createMachineNode('miner_mk1', 1000, 1000, 'miner_active');
  const smelter = createMachineNode('smelter', 1400, 1000, 'smelter_target');
  const belt = createConveyorConnection(
    minerOn.id,
    minerOn.outputs[0].id,
    smelter.id,
    smelter.inputs[0].id,
    1,
    'belt_active'
  );

  // Position is valid when sitting on the deposit
  assert.equal(isNodePositionValid([deposit], minerOn).valid, true);

  // Simulate on deposit: miner extracts at 60/m, optimal status
  const simMounted = stepSimulation([deposit, minerOn, smelter], [belt], 1.0);
  const mountedMiner = simMounted.nodes.find((n) => n.id === minerOn.id)!;
  assert.equal(mountedMiner.outputs[0].targetRatePerMin, 60);
  assert.equal(mountedMiner.outputs[0].actualRatePerMin, 60);
  assert.equal(mountedMiner.status, 'optimal');
  assert.equal(mountedMiner.efficiency, 100);

  // 2. Miner moved away from the deposit onto bare ground
  const minerOff = { ...minerOn, x: 2000, y: 2000, storedCount: 0 };
  const beltOff = createConveyorConnection(
    minerOff.id,
    minerOff.outputs[0].id,
    smelter.id,
    smelter.inputs[0].id,
    1,
    'belt_unmounted'
  );

  // Moving miner off deposit is blocked when deposits exist in world
  assert.equal(
    isNodePositionValid([deposit], minerOff).valid,
    false,
    'Miner Mk.1 must not be valid on bare terrain when deposits exist'
  );

  // Simulate unmounted miner: rate drops to 0/m, status becomes starved, 0% efficiency
  const simUnmounted = stepSimulation([deposit, minerOff, smelter], [beltOff], 1.0);
  const unmountedMiner = simUnmounted.nodes.find((n) => n.id === minerOff.id)!;
  assert.equal(
    unmountedMiner.outputs[0].targetRatePerMin,
    0,
    'Target extraction rate must drop to 0 when miner is off deposit'
  );
  assert.equal(
    unmountedMiner.outputs[0].actualRatePerMin,
    0,
    'Actual extraction rate must drop to 0 when buffer is empty and off deposit'
  );
  assert.equal(unmountedMiner.status, 'starved');
  assert.equal(unmountedMiner.efficiency, 0);
  assert.equal(unmountedMiner.progress, 0);

  // 3. Miner placed slightly offset from deposit (e.g. shifted 80px off-center)
  const minerOffset = { ...minerOn, x: 1000, y: 920, storedCount: 0 };
  assert.equal(
    isNodePositionValid([deposit], minerOffset).valid,
    false,
    'Miner Mk.1 must be directly and concentrically on top of deposit, not hovering offset'
  );

  const simOffset = stepSimulation([deposit, minerOffset, smelter], [belt], 1.0);
  const offsetMiner = simOffset.nodes.find((n) => n.id === minerOffset.id)!;
  assert.equal(offsetMiner.outputs[0].targetRatePerMin, 0);
  assert.equal(offsetMiner.status, 'starved');
  assert.equal(offsetMiner.efficiency, 0);

  // 4. Exactly 1 miner per deposit constraint
  const minerSecond = createMachineNode('miner_mk1', 1000, 1000, 'miner_second_attempt');
  assert.equal(
    isNodePositionValid([deposit, minerOn], minerSecond).valid,
    false,
    'Resource Deposit can only hold 1 miner'
  );

  // 5. Legacy save migration strips leftover Miner Mk.1 input ports and snaps offset miners concentrically onto deposit
  const legacySavedMiner: MachineNode = {
    ...minerOn,
    id: 'starter_miner',
    x: 2544,
    y: 2636, // 148px above starter_deposit (2544, 2784)
    inputs: [
      {
        id: 'legacy_in_0',
        index: 0,
        side: 'input',
        label: 'Iron Ore',
        itemName: 'Iron Ore',
        targetRatePerMin: 60,
        actualRatePerMin: 0,
      },
    ],
  };
  const migratedNodes = ensureWorldDepositsPresent([legacySavedMiner]);
  const migratedMiner = migratedNodes.find((n) => n.id === 'starter_miner')!;
  const starterDep = migratedNodes.find((n) => n.id === 'starter_deposit')!;
  assert.equal(migratedMiner.inputs.length, 0, 'Migrated Miner Mk.1 must have 0 input ports');
  assert.equal(migratedMiner.x, starterDep.x, 'Migrated Miner Mk.1 must snap concentrically to deposit X');
  assert.equal(migratedMiner.y, starterDep.y, 'Migrated Miner Mk.1 must snap concentrically to deposit Y');
});

test('distanceFromPointToSegment and distanceFromPointToPolyline accurately hit-test conveyor belt lines for direct in-world selection and upgrading', () => {
  // Horizontal belt segment from (100, 200) to (300, 200)
  assert.equal(distanceFromPointToSegment(200, 200, 100, 200, 300, 200), 0);
  assert.equal(distanceFromPointToSegment(200, 208, 100, 200, 300, 200), 8);
  assert.equal(distanceFromPointToSegment(50, 200, 100, 200, 300, 200), 50);

  // Orthogonal multi-segment conveyor polyline
  const beltPts = [
    { x: 100, y: 200 },
    { x: 250, y: 200 },
    { x: 250, y: 350 },
    { x: 400, y: 350 },
  ];
  assert.equal(distanceFromPointToPolyline(250, 275, beltPts), 0);
  assert.equal(distanceFromPointToPolyline(256, 275, beltPts), 6);
  assert.ok(distanceFromPointToPolyline(100, 350, beltPts) > 100);

  // Upgrading a single selected belt in place preserves items in transit and updates capacity
  const conn = createConveyorConnection('m1', 'm1_out_0', 's1', 's1_in_0', 1, 'belt_1');
  conn.inFlightItems = [{ id: 'pkt_1', itemName: 'Iron Ore', distancePx: 36, stalled: false }];
  const upgraded = upgradeConveyorBeltTier(conn, 3);
  assert.equal(upgraded.beltTier, 3);
  assert.equal(upgraded.maxCapacityPerMin, 270);
  assert.equal(upgraded.inFlightItems?.length, 1);
  assert.equal(upgraded.inFlightItems?.[0].distancePx, 36);
});

test('conveyor belts treat resource deposits as physical obstacles and route cleanly around them', () => {
  // Scenario 1: A conveyor belt between a smelter and constructor with an intervening natural resource deposit
  // Smelter right edge is at x = 100 + 268 = 368, y = 1000 + 96 = 1096
  // Constructor input is at x = 900, y = 1000 + 96 = 1096
  // Intervening resource deposit is at x = 450, y = 1000 (width: 268, height: 144)
  const smelter = createMachineNode('smelter', 100, 1000, 'test_smelter');
  const constructor = createMachineNode('constructor', 900, 1000, 'test_constructor');
  const obstacleDeposit = createMachineNode('resource_deposit', 450, 1000, 'obs_deposit');

  const p1 = getPortWorldPosition(smelter, 'output', 0, 1);
  const p2 = getPortWorldPosition(constructor, 'input', 0, 1);

  const beltPath = computeOrthogonalConveyorPath(
    p1.x,
    p1.y,
    p2.x,
    p2.y,
    [smelter, obstacleDeposit, constructor],
    smelter,
    constructor
  );

  // The belt must NOT intersect the intervening resource deposit (with standard 12px clearance)
  assert.equal(
    doesPathIntersectNode(beltPath, obstacleDeposit, 12),
    false,
    'Belt must cleanly route around intervening resource deposit'
  );
  // Must be 90-degree orthogonal polyline
  for (let i = 1; i < beltPath.length; i++) {
    const isH = Math.abs(beltPath[i].y - beltPath[i - 1].y) < 1e-4;
    const isV = Math.abs(beltPath[i].x - beltPath[i - 1].x) < 1e-4;
    assert.ok(isH || isV, 'Each segment must be strictly orthogonal');
  }

  // Scenario 2: A Miner Mk.1 mounted directly on its own Resource Deposit
  // The miner's exit belt can route outward without being blocked by its own base deposit
  const minerDeposit = createMachineNode('resource_deposit', 2000, 1000, 'miner_dep');
  const mountedMiner = createMachineNode('miner_mk1', 2000, 1000, 'miner_mk1');
  const targetSmelter = createMachineNode('smelter', 2600, 1000, 'target_smelter');

  const minerOut = getPortWorldPosition(mountedMiner, 'output', 0, 1);
  const targetIn = getPortWorldPosition(targetSmelter, 'input', 0, 1);

  const minerBelt = computeOrthogonalConveyorPath(
    minerOut.x,
    minerOut.y,
    targetIn.x,
    targetIn.y,
    [minerDeposit, mountedMiner, targetSmelter],
    mountedMiner,
    targetSmelter
  );

  assert.ok(minerBelt.length >= 2, 'Miner belt must generate a valid path');
  assert.equal(minerBelt[0].x, minerOut.x);
  assert.equal(minerBelt[0].y, minerOut.y);
  assert.equal(minerBelt[minerBelt.length - 1].x, targetIn.x);
  assert.equal(minerBelt[minerBelt.length - 1].y, targetIn.y);

  // Scenario 3: If an unrelated third-party deposit sits in front of the mounted miner,
  // the belt routes around that third deposit while leaving the miner base cleanly
  const thirdDeposit = createMachineNode('resource_deposit', 2350, 1000, 'third_dep');
  const targetSmelterFar = createMachineNode('smelter', 2900, 1000, 'target_smelter_far');
  const targetFarIn = getPortWorldPosition(targetSmelterFar, 'input', 0, 1);

  const routedAroundThird = computeOrthogonalConveyorPath(
    minerOut.x,
    minerOut.y,
    targetFarIn.x,
    targetFarIn.y,
    [minerDeposit, mountedMiner, thirdDeposit, targetSmelterFar],
    mountedMiner,
    targetSmelterFar
  );

  assert.equal(
    doesPathIntersectNode(routedAroundThird, thirdDeposit, 12),
    false,
    'Belt from miner must route around the intervening third-party deposit'
  );
});

test('Conveyor waypoints tool: computeConveyorPathWithWaypoints routes through user-placed points', () => {
  const startX = 100;
  const startY = 100;
  const endX = 800;
  const endY = 600;
  const waypoints = [
    { x: 300, y: 100 },
    { x: 300, y: 400 },
    { x: 600, y: 400 },
  ];

  const fullPath = computeConveyorPathWithWaypoints(
    startX,
    startY,
    endX,
    endY,
    [],
    undefined,
    undefined,
    waypoints
  );

  assert.ok(fullPath.length >= 4, 'Waypoints path must have multiple segments');
  assert.equal(fullPath[0].x, startX);
  assert.equal(fullPath[0].y, startY);
  assert.equal(fullPath[fullPath.length - 1].x, endX);
  assert.equal(fullPath[fullPath.length - 1].y, endY);

  // Check each waypoint is visited along the orthogonal polyline route
  for (const wp of waypoints) {
    const dist = distanceFromPointToPolyline(wp.x, wp.y, fullPath);
    assert.ok(dist <= 1e-3, `Conveyor belt must pass through waypoint (${wp.x}, ${wp.y}), dist was ${dist}`);
  }
});

test('FactoryHistoryManager: handles undo, redo, subscriptions, and snapshots', async () => {
  const { FactoryHistoryManager } = await import('./history');
  const history = new FactoryHistoryManager(20);

  let notifyCount = 0;
  const unsub = history.subscribe(() => {
    notifyCount++;
  });

  const nodeA = createMachineNode('constructor', 100, 100, 'node_a');
  const nodeB = createMachineNode('smelter', 500, 100, 'node_b');
  const conn1 = createConveyorConnection('node_a', nodeA.outputs[0].id, 'node_b', nodeB.inputs[0].id, 1);

  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), false);

  // Push snapshot before adding smelter
  history.pushSnapshot([nodeA], [], 'Place Smelter');
  assert.equal(history.canUndo(), true);
  assert.equal(history.getUndoDescription(), 'Place Smelter');
  assert.equal(notifyCount, 1);

  // Push snapshot before connecting belt
  history.pushSnapshot([nodeA, nodeB], [], 'Connect Conveyor Mk.1');
  assert.equal(history.getUndoDescription(), 'Connect Conveyor Mk.1');

  // State after connecting belt has [nodeA, nodeB] and [conn1]
  // Perform Undo: reverts to state before connecting belt (0 connections)
  const undoRes1 = history.undo([nodeA, nodeB], [conn1]);
  assert.ok(undoRes1);
  assert.equal(undoRes1.connections.length, 0);
  assert.equal(undoRes1.description, 'Connect Conveyor Mk.1');
  assert.equal(history.canRedo(), true);
  assert.equal(history.getRedoDescription(), 'Connect Conveyor Mk.1');

  // Perform Redo: restores state with 1 connection
  const redoRes1 = history.redo(undoRes1.nodes, undoRes1.connections);
  assert.ok(redoRes1);
  assert.equal(redoRes1.connections.length, 1);
  assert.equal(history.canRedo(), false);

  unsub();
});

test('25. computeConveyorPathWithWaypoints strictly enforces 90-degree corners at every waypoint dot', () => {
  const startX = 100;
  const startY = 200;
  const endX = 500;
  const endY = 200;
  // Waypoint dot offset in Y (e.g. at (300, 350))
  const waypoints = [{ x: 300, y: 350 }];
  const path = computeConveyorPathWithWaypoints(startX, startY, endX, endY, waypoints);

  assert.ok(path.length >= 4, `Expected at least 4 points in path, got ${path.length}`);
  // The waypoint dot must be in the path
  const containsWp = path.some((pt) => Math.abs(pt.x - 300) < 1e-4 && Math.abs(pt.y - 350) < 1e-4);
  assert.ok(containsWp, 'Waypoint (300, 350) must be preserved in path');

  // Verify all segments are orthogonal (strictly horizontal or vertical)
  for (let i = 0; i < path.length - 1; i++) {
    const dx = Math.abs(path[i + 1].x - path[i].x);
    const dy = Math.abs(path[i + 1].y - path[i].y);
    assert.ok(
      dx < 1e-4 || dy < 1e-4,
      `Segment ${i} -> ${i + 1} must be orthogonal: dx=${dx}, dy=${dy}`
    );
  }

  // Verify the corner at the waypoint is exactly 90 degrees
  const wpIndex = path.findIndex((pt) => Math.abs(pt.x - 300) < 1e-4 && Math.abs(pt.y - 350) < 1e-4);
  assert.ok(wpIndex > 0 && wpIndex < path.length - 1, 'Waypoint must have incoming and outgoing segments');
  const prev = path[wpIndex - 1];
  const curr = path[wpIndex];
  const next = path[wpIndex + 1];

  const inIsHorizontal = Math.abs(curr.y - prev.y) < 1e-4;
  const inIsVertical = Math.abs(curr.x - prev.x) < 1e-4;
  const outIsHorizontal = Math.abs(next.y - curr.y) < 1e-4;
  const outIsVertical = Math.abs(next.x - curr.x) < 1e-4;

  assert.ok(
    (inIsHorizontal && outIsVertical) || (inIsVertical && outIsHorizontal),
    'Corner at waypoint must form a 90-degree perpendicular turn'
  );
});

test('26. Multi-selection group dismantle correctly preserves natural resource deposits while dismantling machines', () => {
  const starter = createStarterFactory();
  const deposit = starter.nodes.find((n) => n.buildingId === 'resource_deposit')!;
  const miner = createMachineNode('miner_mk1', deposit.x + 24, deposit.y + 40, 'miner_1');
  const smelter = createMachineNode('smelter', 500, 100, 'smelter_1');
  const conn = createConveyorConnection('miner_1', miner.outputs[0].id, 'smelter_1', smelter.inputs[0].id, 1);

  const initialNodes = [deposit, miner, smelter];
  const initialConns = [conn];

  // User selects all 3 items (deposit, miner, smelter) and triggers dismantle
  const selectedIds = [deposit.id, miner.id, smelter.id];
  const idsToRemove = new Set(
    selectedIds.filter((id) => {
      const node = initialNodes.find((n) => n.id === id);
      return node && node.buildingId !== 'resource_deposit' && !node.isWorldDeposit;
    })
  );

  // Natural deposit must NOT be in idsToRemove
  assert.ok(!idsToRemove.has(deposit.id), 'Deposit must not be dismantled');
  assert.ok(idsToRemove.has(miner.id), 'Miner must be dismantled');
  assert.ok(idsToRemove.has(smelter.id), 'Smelter must be dismantled');

  const remainingNodes = initialNodes.filter((n) => !idsToRemove.has(n.id));
  const remainingConns = initialConns.filter(
    (c) => !idsToRemove.has(c.fromNodeId) && !idsToRemove.has(c.toNodeId)
  );

  assert.equal(remainingNodes.length, 1);
  assert.equal(remainingNodes[0].id, deposit.id);
  assert.equal(remainingConns.length, 0);
});

test('27. Belts with corner dots strictly avoid overlapping buildings and resource deposits', () => {
  const fromSmelter = createMachineNode('smelter', 100, 200, 'smelter_src');
  const toConstructor = createMachineNode('constructor', 900, 200, 'ctor_dst');
  // Place an obstacle building directly in the corridor between the waypoint and destination
  const blocker = createMachineNode('storage_container', 520, 300, 'blocker_box');

  const p1 = getPortWorldPosition(fromSmelter, 'output', 0, fromSmelter.outputs.length);
  const p2 = getPortWorldPosition(toConstructor, 'input', 0, toConstructor.inputs.length);

  // Waypoint at (400, 360) — horizontal line to endStubX would pass straight through blocker (y: 300..440)
  const waypoints = [{ x: 400, y: 360 }];
  const path = computeConveyorPathWithWaypoints(
    p1.x,
    p1.y,
    p2.x,
    p2.y,
    [fromSmelter, toConstructor, blocker],
    fromSmelter,
    toConstructor,
    waypoints
  );

  // Verify the belt with corner dot routes cleanly around the blocker and never overlaps it
  const intersectsBlocker = doesPathIntersectNode(path, blocker, 8);
  assert.equal(
    intersectsBlocker,
    false,
    'Expected belt with corner dot to route around obstacle building without overlapping it'
  );
});

test('28. Miner on Resource Deposit connected to Smelter below with 2 corner dots (below and above Miner) routes with 0 overlaps and 0 180-degree extra belt spikes', () => {
  const starter = createStarterFactory();
  const deposit = starter.nodes.find((n) => n.buildingId === 'resource_deposit')!;
  const miner = createMachineNode('miner_mk1', deposit.x, deposit.y, 'miner_src', 'mine_iron');
  // Place Smelter below Miner Mk.1 just like the mobile screenshot
  const smelter = createMachineNode(
    'smelter',
    deposit.x + 72,
    deposit.y + 336,
    'smelter_below',
    'smelt_iron'
  );

  const p1 = getPortWorldPosition(miner, 'output', 0, miner.outputs.length);
  const p2 = getPortWorldPosition(smelter, 'input', 0, smelter.inputs.length);

  // Corner 1 below Miner Mk.1, Corner 2 above Miner Mk.1
  const waypoints = [
    { x: deposit.x + 144, y: deposit.y + 264 },
    { x: deposit.x + 72, y: deposit.y - 24 },
  ];

  const path = computeConveyorPathWithWaypoints(
    p1.x,
    p1.y,
    p2.x,
    p2.y,
    [deposit, miner, smelter],
    miner,
    smelter,
    waypoints
  );

  const interiorPts = path.slice(1, path.length - 1);
  assert.equal(
    doesPathIntersectNode(interiorPts, miner, 6),
    false,
    'Interior belt path must never cut through Miner Mk.1'
  );
  assert.equal(
    doesPathIntersectNode(interiorPts, deposit, 6),
    false,
    'Interior belt path must never cut through Iron Ore Deposit'
  );
  assert.equal(
    doesPathIntersectNode(interiorPts, smelter, 6),
    false,
    'Interior belt path must never cut through Smelter'
  );

  // Verify zero 180-degree spikes / collinear reversals anywhere in the polyline
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const next = path[i + 1];
    const inH = Math.abs(curr.y - prev.y) < 1e-3;
    const inV = Math.abs(curr.x - prev.x) < 1e-3;
    const outH = Math.abs(next.y - curr.y) < 1e-3;
    const outV = Math.abs(next.x - curr.x) < 1e-3;
    assert.ok(
      (inH && outV) || (inV && outH),
      `Vertex ${i} at (${curr.x},${curr.y}) must be a strict 90° turn, not a 180° spike`
    );
  }
});

test('29. Satisfactory Productivity Display shows stable average efficiency without flickering to 100% on discrete item cycles or buffer boundaries', () => {
  // Part A: 60/m Miner Mk.1 feeding a 30/m Smelter once buffers are saturated (99/100 <-> 100/100)
  const deposit = createMachineNode('resource_deposit', 240, 2000, 'dep_norm', 'deposit_iron', {
    purity: 'normal', // 60/m
  });
  const miner = createMachineNode('miner_mk1', 240, 2000, 'miner_60', 'mine_iron');
  const smelter = createMachineNode('smelter', 600, 2000, 'smelter_30', 'smelt_iron');
  const storage = createMachineNode('storage_container', 960, 2000, 'storage_sink');

  const connMinerSmelter = createConveyorConnection(
    miner.id,
    miner.outputs[0].id,
    smelter.id,
    smelter.inputs[0].id,
    1,
    'conn_ms'
  );
  const connSmelterStorage = createConveyorConnection(
    smelter.id,
    smelter.outputs[0].id,
    storage.id,
    storage.inputs[0].id,
    1,
    'conn_ss'
  );

  // Pre-fill Miner output (100/100) and Smelter input (100/100) so the Miner is throttled to Smelter's 30/m consumption
  miner.storedCount = 100;
  miner.outputs[0].bufferedCount = 100;
  smelter.inputs[0].bufferedCount = 100;
  smelter.inputStoredCount = 100;

  let nodesA: MachineNode[] = [deposit, miner, smelter, storage];
  let connsA: ConveyorConnection[] = [
    { ...connMinerSmelter, firstItemArrived: true, inFlightItems: undefined },
    { ...connSmelterStorage, firstItemArrived: true, inFlightItems: undefined },
  ];

  // Warm up for 30s so belt queues pack and Productivity Display rolling average settles to 50%
  for (let i = 0; i < 60; i++) {
    const res = stepSimulation(nodesA, connsA, 0.5);
    nodesA = res.nodes;
    connsA = res.connections;
  }

  // Now step 40 fine-grained ticks (0.2s each = 8s across 4 full Smelter cycles) and assert zero flickering!
  for (let tick = 0; tick < 40; tick++) {
    const res = stepSimulation(nodesA, connsA, 0.2);
    nodesA = res.nodes;
    connsA = res.connections;

    const curMiner = nodesA.find((n) => n.id === miner.id)!;
    const curSmelter = nodesA.find((n) => n.id === smelter.id)!;
    const curBelt = connsA.find((c) => c.id === 'conn_ms')!;

    assert.equal(
      curMiner.efficiency,
      50,
      `Miner Mk.1 (60/m) throttled by 30/m Smelter must stay at 50% avg efficiency on tick ${tick} (stored=${curMiner.storedCount}), got ${curMiner.efficiency}%`
    );
    assert.equal(curMiner.status, 'working');
    assert.equal(
      curBelt.ratePerMin,
      30,
      `Packed belt feeding 30/m Smelter must stay at 30/m on tick ${tick}, got ${curBelt.ratePerMin}/m`
    );
    assert.equal(
      curSmelter.efficiency,
      100,
      `Smelter receiving full 30/m must stay at 100% OPTIMAL on tick ${tick}, got ${curSmelter.efficiency}%`
    );
    assert.equal(curSmelter.status, 'optimal');
  }

  // Part B: Under-supplied Smelter receiving 15/m (from an Impure 30/m Miner split across 2 Smelters)
  const impureDep = createMachineNode('resource_deposit', 240, 3000, 'dep_imp', 'deposit_iron', {
    purity: 'impure', // 30/m
  });
  const impMiner = createMachineNode('miner_mk1', 240, 3000, 'miner_30', 'mine_iron');
  const splitter = createMachineNode('splitter', 600, 3000, 'split_15');
  const smelt1 = createMachineNode('smelter', 960, 2820, 'smelt_half_1', 'smelt_iron');
  const smelt2 = createMachineNode('smelter', 960, 3180, 'smelt_half_2', 'smelt_iron');

  let nodesB: MachineNode[] = [impureDep, impMiner, splitter, smelt1, smelt2];
  let connsB: ConveyorConnection[] = [
    {
      ...createConveyorConnection(impMiner.id, impMiner.outputs[0].id, splitter.id, splitter.inputs[0].id, 1, 'c_m_sp'),
      firstItemArrived: true,
      inFlightItems: undefined,
    },
    {
      ...createConveyorConnection(splitter.id, splitter.outputs[0].id, smelt1.id, smelt1.inputs[0].id, 1, 'c_sp_s1'),
      firstItemArrived: true,
      inFlightItems: undefined,
    },
    {
      ...createConveyorConnection(splitter.id, splitter.outputs[1].id, smelt2.id, smelt2.inputs[0].id, 1, 'c_sp_s2'),
      firstItemArrived: true,
      inFlightItems: undefined,
    },
  ];

  // Clear initial buffered count on smelt1 & smelt2 so they only have discrete belt arrivals at 15/m
  nodesB = nodesB.map((n) =>
    n.id === smelt1.id || n.id === smelt2.id
      ? { ...n, inputs: n.inputs.map((p) => ({ ...p, bufferedCount: 0 })) }
      : n
  );

  // Warm up 20s and then check 40 ticks (0.25s each = 10s across multiple 4s item arrivals & 2s craft cycles)
  for (let i = 0; i < 40; i++) {
    const res = stepSimulation(nodesB, connsB, 0.5);
    nodesB = res.nodes;
    connsB = res.connections;
  }

  for (let tick = 0; tick < 40; tick++) {
    const res = stepSimulation(nodesB, connsB, 0.25);
    nodesB = res.nodes;
    connsB = res.connections;

    const s1 = nodesB.find((n) => n.id === smelt1.id)!;
    const s2 = nodesB.find((n) => n.id === smelt2.id)!;
    assert.equal(
      s1.efficiency,
      50,
      `Under-supplied Smelter 1 (15/30/m) must stay at 50% avg efficiency on tick ${tick} (buf=${s1.inputs[0].bufferedCount}), got ${s1.efficiency}%`
    );
    assert.equal(s1.status, 'working');
    assert.equal(
      s2.efficiency,
      50,
      `Under-supplied Smelter 2 (15/30/m) must stay at 50% avg efficiency on tick ${tick} (buf=${s2.inputs[0].bufferedCount}), got ${s2.efficiency}%`
    );
    assert.equal(s2.status, 'working');
  }
});

test('29. Satisfactory 250% Overclocking (0-3 Power Shards) and Standby Mode scale production rates, cycle times, and power MW accurately', async () => {
  const {
    getMaxClockSpeedPct,
    getBuildingPowerMw,
    getScaledCycleTimeSec,
    getScaledRatePerMin,
  } = await import('./rules');

  // Verify Power Shard capacity unlocking: 0 = 100%, 1 = 150%, 2 = 200%, 3 = 250%
  assert.equal(getMaxClockSpeedPct(0), 100);
  assert.equal(getMaxClockSpeedPct(1), 150);
  assert.equal(getMaxClockSpeedPct(2), 200);
  assert.equal(getMaxClockSpeedPct(3), 250);

  // Verify linear production scaling & inverse cycle time at 250%
  assert.equal(getScaledRatePerMin(60, 250), 150);
  assert.equal(getScaledRatePerMin(30, 250), 75);
  assert.equal(getScaledCycleTimeSec(2.0, 250), 0.8);

  // Verify exponential power scaling: baseMw * (clock / 100)^1.321928
  assert.equal(getBuildingPowerMw('miner_mk1', 100, false), 5.0);
  assert.ok(getBuildingPowerMw('miner_mk1', 250, false) > 16.5);
  assert.equal(getBuildingPowerMw('miner_mk1', 250, true), 0.1); // Standby uses 0.1 MW

  // Verify simulation scales Miner Mk.1 extraction to 150/m at 250% clock speed with 3 Power Shards
  const deposit = createMachineNode('resource_deposit', 480, 2000, 'dep_oc', 'deposit_iron', {
    purity: 'normal', // 60/m base
  });
  const miner = {
    ...createMachineNode('miner_mk1', 480, 2000, 'miner_oc', 'mine_iron'),
    powerShards: 3,
    clockSpeedPct: 250,
    storedCount: 0,
  };

  // Step two 1.0s ticks (2.0 seconds total) at 250% (150 items/min = 2.5 items/sec -> 5 items in 2.0s)
  const simTick1 = stepSimulation([deposit, miner], [], 1.0);
  const simActive = stepSimulation(simTick1.nodes, simTick1.connections, 1.0);
  const updatedMiner = simActive.nodes.find((n) => n.id === 'miner_oc')!;
  assert.equal(updatedMiner.outputs[0].targetRatePerMin, 150);
  assert.equal(updatedMiner.storedCount, 5);
  assert.equal(updatedMiner.efficiency, 100);

  // Toggle Standby mode on the miner: production pauses and efficiency drops to 0%
  const standbyMiner = { ...updatedMiner, isStandby: true };
  const simStandby = stepSimulation([deposit, standbyMiner], [], 1.0);
  const pausedMiner = simStandby.nodes.find((n) => n.id === 'miner_oc')!;
  assert.equal(pausedMiner.storedCount, 5, 'Standby miner must not extract additional ore');
  assert.equal(pausedMiner.efficiency, 0);
  assert.equal(pausedMiner.status, 'idle');
});

test('30. Exterior Miner Mk.1 STANDBY switch hit-testing and exact node storage save/load persistence', async () => {
  const { isPointOnMinerStandbySwitch } = await import('../components/canvasHitTesting');

  const miner = createMachineNode('miner_mk1', 1000, 1000, 'miner_ext');
  // Bottom-right STANDBY switch region on Miner Mk.1 (relX ~0.88, relY ~0.84)
  const switchX = miner.x + miner.width * 0.88;
  const switchY = miner.y + miner.height * 0.84;
  assert.equal(isPointOnMinerStandbySwitch(switchX, switchY, miner, 1.0), true);
  // Center of Miner Mk.1 is NOT the STANDBY switch
  assert.equal(
    isPointOnMinerStandbySwitch(miner.x + miner.width * 0.5, miner.y + miner.height * 0.5, miner, 1.0),
    false
  );

  // Verify node input & output storages survive save/load round-trip without draining a single item
  const smelter = createMachineNode('smelter', 1500, 1000, 'smelter_saved', 'smelt_iron');
  smelter.inputs[0].bufferedCount = 42;
  smelter.inputStoredCount = 42;
  smelter.storedCount = 77;
  smelter.outputs[0].bufferedCount = 77;

  const hub = createMachineNode('the_hub', 1900, 1000, 'hub_saved', null);
  hub.inputs[0].itemName = 'Iron Plate';
  hub.inputs[0].bufferedCount = 15;
  hub.inputStoredCount = 15;
  hub.storedCount = 380;

  const slotJson = serializeSaveExport({
    id: 'test_storage_slot',
    sessionName: 'Storage Test',
    slotName: 'Test Slot',
    kind: 'manual',
    updatedAt: Date.now(),
    nodes: [smelter, hub],
    connections: [],
    camera: { x: 0, y: 0, zoom: 1 },
  });

  const imported = parseSaveImport(slotJson);
  assert.ok(imported.slot, 'Expected imported slot to parse cleanly');
  const loadedSmelter = imported.slot!.nodes.find((n) => n.id === 'smelter_saved')!;
  const loadedHub = imported.slot!.nodes.find((n) => n.id === 'hub_saved')!;

  assert.equal(loadedSmelter.inputs[0].bufferedCount, 42);
  assert.equal(loadedSmelter.inputStoredCount, 42);
  assert.equal(loadedSmelter.storedCount, 77);
  assert.equal(loadedSmelter.outputs[0].bufferedCount, 77);
  assert.equal(loadedHub.storedCount, 380);
  assert.equal(loadedHub.inputs[0].bufferedCount, 15);
});

test('Rate Display Format setting defaults to "per_minute" (60 per minute) and supports "compact" (60/m)', () => {
  assert.equal(DEFAULT_SETTINGS.rateDisplayFormat, 'per_minute');
  assert.equal(formatRatePerMin(60), '60 per minute');
  assert.equal(formatRatePerMin(60, DEFAULT_SETTINGS), '60 per minute');
  assert.equal(formatRatePerMin(30, 'per_minute'), '30 per minute');
  assert.equal(formatRatePerMin(30, 'compact'), '30/m');
  assert.equal(formatDualRatePerMin(30, 60, 'per_minute'), '30/60 per minute');
  assert.equal(formatDualRatePerMin(30, 60, 'compact'), '30/60/m');

  // Verify Power Shard and Somersloop authentic game icons are registered
  assert.equal(ITEM_ICON_PATHS.power_shard, './icons/items/power_shard.png');
  assert.equal(ITEM_ICON_PATHS.somersloop, './icons/items/somersloop.png');
});

test('Machine storages for 200-stack and 500-stack items and multi-input Assemblers survive save/load and cloneSaveGraph', () => {
  // Constructor making Screws (stack size 500) with 385 buffered output screws
  const screwConstructor = createMachineNode('constructor', 1200, 1200, 'ctor_screws', 'construct_screws');
  screwConstructor.inputs[0].bufferedCount = 88;
  screwConstructor.inputStoredCount = 88;
  screwConstructor.storedCount = 385;
  screwConstructor.outputs[0].bufferedCount = 385;
  screwConstructor.progress = 0.64;

  // Constructor making Iron Plates (stack size 200) with 175 buffered output plates
  const plateConstructor = createMachineNode('constructor', 1600, 1200, 'ctor_plates', 'construct_iron_plate');
  plateConstructor.inputs[0].bufferedCount = 92;
  plateConstructor.inputStoredCount = 92;
  plateConstructor.storedCount = 175;
  plateConstructor.outputs[0].bufferedCount = 175;

  // Multi-input Assembler making Reinforced Iron Plates (Iron Plate input up to 200, Screw input up to 500)
  const assembler = createMachineNode('assembler', 2000, 1200, 'asm_rip', 'assemble_reinforced_plate');
  assembler.inputs[0].bufferedCount = 140; // Iron Plate (max 200)
  assembler.inputs[1].bufferedCount = 410; // Screw (max 500)
  assembler.inputStoredCount = 550;
  assembler.storedCount = 65;
  assembler.outputs[0].bufferedCount = 65;

  const cloned = cloneSaveGraph([screwConstructor, plateConstructor, assembler], []);
  const slotJson = serializeSaveExport({
    id: 'test_high_stack_storage',
    sessionName: 'High Stack Storage Test',
    slotName: 'High Stack Slot',
    kind: 'manual',
    updatedAt: Date.now(),
    nodes: cloned.nodes,
    connections: cloned.connections,
    camera: { x: 0, y: 0, zoom: 1 },
  });

  const imported = parseSaveImport(slotJson);
  assert.ok(imported.slot);
  const loadedScrews = imported.slot!.nodes.find((n) => n.id === 'ctor_screws')!;
  const loadedPlates = imported.slot!.nodes.find((n) => n.id === 'ctor_plates')!;
  const loadedAsm = imported.slot!.nodes.find((n) => n.id === 'asm_rip')!;

  assert.equal(loadedScrews.storedCount, 385);
  assert.equal(loadedScrews.outputs[0].bufferedCount, 385);
  assert.equal(loadedScrews.inputs[0].bufferedCount, 88);
  assert.equal(loadedScrews.progress, 0.64);

  assert.equal(loadedPlates.storedCount, 175);
  assert.equal(loadedPlates.outputs[0].bufferedCount, 175);
  assert.equal(loadedPlates.inputs[0].bufferedCount, 92);

  assert.equal(loadedAsm.inputs[0].bufferedCount, 140);
  assert.equal(loadedAsm.inputs[1].bufferedCount, 410);
  assert.equal(loadedAsm.inputStoredCount, 550);
  assert.equal(loadedAsm.storedCount, 65);
  assert.equal(loadedAsm.outputs[0].bufferedCount, 65);
});

test('Dense 20-machine factory with multi-waypoint belts routes in under 50ms without hanging startup', () => {
  const nodes: MachineNode[] = [];
  for (let i = 0; i < 20; i++) {
    nodes.push(
      createMachineNode(
        'smelter',
        2000 + (i % 5) * 380,
        2000 + Math.floor(i / 5) * 320,
        `dense_m_${i}`,
        'smelt_iron'
      )
    );
  }
  const conn = createConveyorConnection(
    nodes[0].id,
    nodes[0].outputs[0].id,
    nodes[19].id,
    nodes[19].inputs[0].id,
    1,
    'dense_wp_belt'
  );
  conn.waypoints = [
    { x: 2300, y: 2150 },
    { x: 2800, y: 2450 },
    { x: 3100, y: 2750 },
  ];

  const t0 = Date.now();
  const sim = stepSimulation(nodes, [conn], 0);
  const elapsedMs = Date.now() - t0;

  assert.ok(
    elapsedMs < 50,
    `Expected dense waypoint belt simulation to complete in < 50ms, took ${elapsedMs}ms`
  );
  assert.ok((sim.connections[0].lengthPx ?? 0) > 100);
});

test('Native Godot 4 (GDScript 2.0 + gl_compatibility) project in /godot maintains 1:1 asset and script parity', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const root = process.cwd();

  const requiredFiles = [
    'godot/project.godot',
    'godot/export_presets.cfg',
    'godot/scenes/Main.tscn',
    'godot/scripts/Catalog.gd',
    'godot/scripts/SynthAudio.gd',
    'godot/scripts/Router.gd',
    'godot/scripts/FactorySim.gd',
    'godot/scripts/GameState.gd',
    'godot/scripts/SectorWorld.gd',
    'godot/scripts/HUDController.gd',
    'godot/assets/icons/buildings/miner_top_bay_clean.png',
    'godot/assets/icons/buildings/processor_top_bay_clean.png',
    'godot/assets/icons/buildings/machine_lower_bay_clean.png',
    'godot/assets/icons/buildings/miner_mk1.png',
    'godot/assets/icons/items/power_shard.png',
  ];

  for (const rel of requiredFiles) {
    assert.ok(fs.existsSync(path.join(root, rel)), `Expected ${rel} to exist in native Godot 4 project`);
  }

  const projectCfg = fs.readFileSync(path.join(root, 'godot/project.godot'), 'utf8');
  assert.ok(projectCfg.includes('gl_compatibility'), 'Godot 4 project must target gl_compatibility (GLES3) renderer for low-end Android');
  assert.ok(projectCfg.includes('config/version="0.0.2"'), 'Godot 4 project version must match 0.0.2');
});

