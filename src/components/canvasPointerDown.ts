/**
 * MODULE INDEX (`src/components/canvasPointerDown.ts`)
 * -----------------------------------------------------------------------------
 * Shared `CanvasInteractionState` definition, `createInitialInteractionState()`,
 * `tryCreateConnection()`, and `executeCanvasPointerDown()` for `NodeCanvas`.
 *
 * Line Map:
 * - [L20–L125]  `CanvasInteractionState`, `CanvasPointerContext`, and `createInitialInteractionState()`
 * - [L127–L175] `tryCreateConnection()` (validates and creates a ConveyorConnection between two ports)
 * - [L177–L535] `executeCanvasPointerDown()` (pinch start, Move tool, Select marquee, Waypoint corner dot, Build placement, Port wiring, Node drag/select, Belt select, Double-tap zoom, Pan start)
 */

import React from 'react';
import { playSynthSfx } from '../game/audio';
import { BUILDINGS } from '../game/catalog';
import { factoryHistory } from '../game/history';
import {
  canConnectPorts,
  clampNodeToWorld,
  computeNodeSnapAlignment,
  createConveyorConnection,
  createMachineNode,
  getBeltTierDef,
  invalidateAllConveyorCaches,
  isMinerDirectlyOnDeposit,
  isNodePositionValid,
  isPointInsideObstacle,
  SnapGuideline,
  stepSimulation,
} from '../game/rules';
import {
  ActiveCanvasTool,
  CameraState,
  ConveyorBeltTier,
  ConveyorConnection,
  MachineNode,
  SettingsConfig,
} from '../game/types';
import {
  doesCandidateNodeOverlapBeltsOrDots,
  findBeltAtWorld,
  findNodeAtWorld,
  findPortAtWorld,
  findWaypointAtWorld,
  getClosestPointOnBelt,
  isPointOnMinerStandbySwitch,
  PortHit,
} from './canvasHitTesting';

export interface CanvasInteractionState {
  isPanning: boolean;
  draggingNodeId: string | null;
  dragOffsetX: number;
  dragOffsetY: number;
  dragStartNodeX: number;
  dragStartNodeY: number;
  dragHasCollision: boolean;
  panStartX: number;
  panStartY: number;
  camStartX: number;
  camStartY: number;
  pointerMoved: boolean;
  wiringFrom: PortHit | null;
  pointerWorldX: number;
  pointerWorldY: number;
  elapsedTime: number;
  activePointers: Map<number, { x: number; y: number }>;
  lastPinchDist: number | null;
  lastPinchMidX: number | null;
  lastPinchMidY: number | null;
  lastTapTime: number;
  lastTapX: number;
  lastTapY: number;
  isDoubleTapZooming: boolean;
  doubleTapAnchorX: number;
  doubleTapAnchorY: number;
  doubleTapStartY: number;
  doubleTapStartZoom: number;
  smoothZoomTarget: number | null;
  smoothZoomAnchorX: number;
  smoothZoomAnchorY: number;
  activeGuidelines: SnapGuideline[];
  hoveredConnectionId: string | null;
  draggingWaypoint: {
    connId: string;
    index: number;
    startX: number;
    startY: number;
    isNew?: boolean;
  } | null;
  hoveredWaypoint: { connId: string; index: number } | null;
  previewWaypoint: { connId: string; x: number; y: number } | null;
  isMarqueeSelecting: boolean;
  marqueeStartX: number;
  marqueeStartY: number;
  marqueeCurrentX: number;
  marqueeCurrentY: number;
  draggingGroupPositions: Map<string, { startX: number; startY: number }> | null;
}

export function createInitialInteractionState(): CanvasInteractionState {
  return {
    isPanning: false,
    draggingNodeId: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    dragStartNodeX: 0,
    dragStartNodeY: 0,
    dragHasCollision: false,
    panStartX: 0,
    panStartY: 0,
    camStartX: 0,
    camStartY: 0,
    pointerMoved: false,
    wiringFrom: null,
    pointerWorldX: 0,
    pointerWorldY: 0,
    elapsedTime: 0,
    activePointers: new Map(),
    lastPinchDist: null,
    lastPinchMidX: null,
    lastPinchMidY: null,
    lastTapTime: 0,
    lastTapX: 0,
    lastTapY: 0,
    isDoubleTapZooming: false,
    doubleTapAnchorX: 0,
    doubleTapAnchorY: 0,
    doubleTapStartY: 0,
    doubleTapStartZoom: 1,
    smoothZoomTarget: null,
    smoothZoomAnchorX: 0,
    smoothZoomAnchorY: 0,
    activeGuidelines: [],
    hoveredConnectionId: null,
    draggingWaypoint: null,
    hoveredWaypoint: null,
    previewWaypoint: null,
    isMarqueeSelecting: false,
    marqueeStartX: 0,
    marqueeStartY: 0,
    marqueeCurrentX: 0,
    marqueeCurrentY: 0,
    draggingGroupPositions: null,
  };
}

export interface CanvasPointerContext {
  canvas: HTMLCanvasElement;
  nodesRef: React.MutableRefObject<MachineNode[]>;
  connectionsRef: React.MutableRefObject<ConveyorConnection[]>;
  cameraRef: React.MutableRefObject<CameraState>;
  settingsRef: React.MutableRefObject<SettingsConfig>;
  activeBeltTierRef: React.MutableRefObject<ConveyorBeltTier>;
  activeToolRef: React.MutableRefObject<ActiveCanvasTool>;
  pendingBuildRef: React.MutableRefObject<string | null>;
  preDragGraphRef: React.MutableRefObject<{
    nodes: MachineNode[];
    connections: ConveyorConnection[];
  } | null>;
  interactionRef: React.MutableRefObject<CanvasInteractionState>;
  selectedNodeIdRef: React.MutableRefObject<string | null>;
  selectedNodeIdsRef: React.MutableRefObject<string[]>;
  selectedConnectionIdRef: React.MutableRefObject<string | null>;
  selectedWaypointRef: React.MutableRefObject<{
    connId: string;
    index: number;
  } | null>;
  tapSourcePortRef: React.MutableRefObject<{
    nodeId: string;
    portId: string;
    label: string;
  } | null>;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedNodeSnapshot: React.Dispatch<React.SetStateAction<MachineNode | null>>;
  setSelectedConnectionId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedConnectionSnapshot: React.Dispatch<
    React.SetStateAction<ConveyorConnection | null>
  >;
  setSelectedWaypoint: React.Dispatch<
    React.SetStateAction<{ connId: string; index: number } | null>
  >;
  setTapSourcePort: React.Dispatch<
    React.SetStateAction<{ nodeId: string; portId: string; label: string } | null>
  >;
  onClearPendingBuild: () => void;
  onGraphMutated: () => void;
  showToast: (msg: string) => void;
  drawNow: () => void;
}

export function screenToWorldPoint(
  canvas: HTMLCanvasElement,
  cam: CameraState,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  return {
    x: (sx - cam.x) / cam.zoom,
    y: (sy - cam.y) / cam.zoom,
  };
}

export function tryCreateConnection(
  ctx: CanvasPointerContext,
  fromNodeId: string,
  fromPortId: string,
  toNodeId: string,
  toPortId: string
): boolean {
  const {
    nodesRef,
    connectionsRef,
    settingsRef,
    activeBeltTierRef,
    onGraphMutated,
    showToast,
    drawNow,
  } = ctx;

  const check = canConnectPorts(
    nodesRef.current,
    connectionsRef.current,
    fromNodeId,
    fromPortId,
    toNodeId,
    toPortId
  );
  if (!check.valid) {
    playSynthSfx('error', settingsRef.current);
    if (check.reason) showToast(check.reason);
    return false;
  }

  const tierDef = getBeltTierDef(activeBeltTierRef.current);
  factoryHistory.pushSnapshot(
    nodesRef.current,
    connectionsRef.current,
    `Connect ${tierDef.name}`
  );
  const newConn = createConveyorConnection(
    fromNodeId,
    fromPortId,
    toNodeId,
    toPortId,
    tierDef.tier
  );
  const nextConns = [...connectionsRef.current, newConn];
  const simRes = stepSimulation(nodesRef.current, nextConns, 0);
  nodesRef.current = simRes.nodes;
  connectionsRef.current = simRes.connections;
  playSynthSfx('connect', settingsRef.current);
  onGraphMutated();
  showToast(`Connected ${tierDef.name} (${tierDef.capacityPerMin}/m)`);
  drawNow();
  return true;
}

export function executeCanvasPointerDown(
  e: React.PointerEvent<HTMLCanvasElement>,
  ctx: CanvasPointerContext
): void {
  const {
    canvas,
    nodesRef,
    connectionsRef,
    cameraRef,
    settingsRef,
    activeToolRef,
    pendingBuildRef,
    preDragGraphRef,
    interactionRef,
    selectedNodeIdRef,
    selectedNodeIdsRef,
    selectedConnectionIdRef,
    selectedWaypointRef,
    tapSourcePortRef,
    setSelectedNodeId,
    setSelectedNodeIds,
    setSelectedNodeSnapshot,
    setSelectedConnectionId,
    setSelectedConnectionSnapshot,
    setSelectedWaypoint,
    setTapSourcePort,
    onClearPendingBuild,
    onGraphMutated,
    showToast,
    drawNow,
  } = ctx;

  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  e.currentTarget.setPointerCapture(e.pointerId);
  interactionRef.current.activePointers.set(e.pointerId, { x: sx, y: sy });
  interactionRef.current.smoothZoomTarget = null;

  if (interactionRef.current.activePointers.size === 2) {
    const pts = Array.from(interactionRef.current.activePointers.values());
    const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    const midX = (pts[0].x + pts[1].x) * 0.5;
    const midY = (pts[0].y + pts[1].y) * 0.5;
    interactionRef.current.lastPinchDist = Math.max(10, dist);
    interactionRef.current.lastPinchMidX = midX;
    interactionRef.current.lastPinchMidY = midY;
    interactionRef.current.isPanning = false;
    interactionRef.current.draggingNodeId = null;
    interactionRef.current.wiringFrom = null;
    interactionRef.current.isDoubleTapZooming = false;
    return;
  }

  const world = screenToWorldPoint(canvas, cameraRef.current, e.clientX, e.clientY);
  interactionRef.current.pointerWorldX = world.x;
  interactionRef.current.pointerWorldY = world.y;
  interactionRef.current.pointerMoved = false;

  // A. Move Tool Safe-Pan: Only pan the camera without accidentally changing buildings or belts
  if (activeToolRef.current === 'move') {
    interactionRef.current.isPanning = true;
    interactionRef.current.panStartX = e.clientX;
    interactionRef.current.panStartY = e.clientY;
    interactionRef.current.camStartX = cameraRef.current.x;
    interactionRef.current.camStartY = cameraRef.current.y;
    return;
  }

  // B. Multi-Select Marquee Tool: Drag box to select multiple buildings
  if (activeToolRef.current === 'select') {
    interactionRef.current.isMarqueeSelecting = true;
    interactionRef.current.marqueeStartX = world.x;
    interactionRef.current.marqueeStartY = world.y;
    interactionRef.current.marqueeCurrentX = world.x;
    interactionRef.current.marqueeCurrentY = world.y;
    return;
  }

  // C. Conveyor Corner Dot Interaction: Movable in BOTH Edit Tool ('edit') and Waypoint Tool ('waypoint')
  const hitWp = findWaypointAtWorld(
    world.x,
    world.y,
    connectionsRef.current,
    cameraRef.current.zoom
  );
  if (hitWp) {
    preDragGraphRef.current = {
      nodes: nodesRef.current.map((n) => ({ ...n })),
      connections: connectionsRef.current.map((c) => ({
        ...c,
        waypoints: c.waypoints ? c.waypoints.map((w) => ({ ...w })) : undefined,
      })),
    };
    interactionRef.current.draggingWaypoint = {
      connId: hitWp.conn.id,
      index: hitWp.index,
      startX: hitWp.point.x,
      startY: hitWp.point.y,
      isNew: false,
    };
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedConnectionId(hitWp.conn.id);
    setSelectedWaypoint({ connId: hitWp.conn.id, index: hitWp.index });
    playSynthSfx('click', settingsRef.current);
    drawNow();
    return;
  }

  // D. Conveyor Waypoint Tool: Tap conveyor line to add a new 90° corner point
  if (activeToolRef.current === 'waypoint') {
    const hitBelt = findBeltAtWorld(
      world.x,
      world.y,
      nodesRef.current,
      connectionsRef.current,
      cameraRef.current.zoom,
      settingsRef.current.showPortRates
    );
    if (hitBelt) {
      const closest = getClosestPointOnBelt(
        world.x,
        world.y,
        hitBelt,
        nodesRef.current
      );
      if (closest) {
        const snappedX = Math.round(closest.x / 24) * 24;
        const snappedY = Math.round(closest.y / 24) * 24;
        if (isPointInsideObstacle(snappedX, snappedY, nodesRef.current, 14)) {
          playSynthSfx('error', settingsRef.current);
          showToast('Cannot place corner dot inside a building or deposit!');
          return;
        }
        factoryHistory.pushSnapshot(
          nodesRef.current,
          connectionsRef.current,
          'Add Conveyor Corner'
        );
        const existingWps = hitBelt.waypoints ? [...hitBelt.waypoints] : [];
        const newIndex = Math.min(
          existingWps.length,
          Math.max(0, closest.insertIndex ?? existingWps.length)
        );
        existingWps.splice(newIndex, 0, { x: snappedX, y: snappedY });

        connectionsRef.current = connectionsRef.current.map((c) => {
          if (c.id !== hitBelt.id) return c;
          return { ...c, waypoints: existingWps };
        });
        invalidateAllConveyorCaches();
        playSynthSfx('connect', settingsRef.current);
        onGraphMutated();
        showToast('Added conveyor 90° corner · Tap dot again to dismantle');

        preDragGraphRef.current = {
          nodes: nodesRef.current.map((n) => ({ ...n })),
          connections: connectionsRef.current.map((c) => ({
            ...c,
            waypoints: c.waypoints ? c.waypoints.map((w) => ({ ...w })) : undefined,
          })),
        };
        interactionRef.current.draggingWaypoint = {
          connId: hitBelt.id,
          index: newIndex,
          startX: snappedX,
          startY: snappedY,
          isNew: true,
        };
        setSelectedWaypoint({ connId: hitBelt.id, index: newIndex });
        drawNow();
        return;
      }
    }

    setSelectedWaypoint(null);
    interactionRef.current.isPanning = true;
    interactionRef.current.panStartX = e.clientX;
    interactionRef.current.panStartY = e.clientY;
    interactionRef.current.camStartX = cameraRef.current.x;
    interactionRef.current.camStartY = cameraRef.current.y;
    return;
  }

  // 1. Place Pending Building from Build Menu
  if (pendingBuildRef.current) {
    const bId = pendingBuildRef.current;
    const bDef = BUILDINGS[bId];
    if (bDef) {
      const snapRes = computeNodeSnapAlignment(
        {
          buildingId: bDef.id,
          x: world.x - bDef.width / 2,
          y: world.y - bDef.height / 2,
          width: bDef.width,
          height: bDef.height,
        },
        nodesRef.current,
        connectionsRef.current,
        settingsRef.current
      );
      const clamped = clampNodeToWorld(snapRes.x, snapRes.y, bDef.width, bDef.height);
      const candidateNode = {
        id: 'candidate',
        buildingId: bId,
        x: clamped.x,
        y: clamped.y,
        width: bDef.width,
        height: bDef.height,
      };

      const nodeCheck = isNodePositionValid(nodesRef.current, candidateNode, 4);
      if (!nodeCheck.valid) {
        playSynthSfx('error', settingsRef.current);
        if (bId === 'miner_mk1') {
          const anyDepositNear = nodesRef.current.find(
            (n) =>
              n.buildingId === 'resource_deposit' &&
              Math.hypot(
                world.x - (n.x + n.width * 0.5),
                world.y - (n.y + n.height * 0.5)
              ) <= 160
          );
          if (anyDepositNear) {
            const alreadyHasMiner = nodesRef.current.some(
              (m) =>
                m.buildingId === 'miner_mk1' &&
                isMinerDirectlyOnDeposit(m, anyDepositNear, 24)
            );
            if (alreadyHasMiner) {
              showToast('This Resource Deposit already holds a Miner Mk.1! (Limit: 1 per deposit)');
              return;
            }
          }
          showToast('Miner Mk.1 must be built directly on top of an unoccupied Resource Deposit!');
        } else {
          showToast('Cannot place: Overlaps existing building!');
        }
        return;
      }

      const blocksBelts = doesCandidateNodeOverlapBeltsOrDots(
        candidateNode as MachineNode,
        nodesRef.current,
        connectionsRef.current
      );

      if (blocksBelts) {
        playSynthSfx('error', settingsRef.current);
        showToast('Cannot place: Conveyor line or corner dot occupies this position!');
        return;
      }

      factoryHistory.pushSnapshot(
        nodesRef.current,
        connectionsRef.current,
        `Build ${bDef.name}`
      );
      const newNode = createMachineNode(bId, clamped.x, clamped.y);
      const nextNodes = [...nodesRef.current, newNode];
      const simRes = stepSimulation(nextNodes, connectionsRef.current, 0);
      nodesRef.current = simRes.nodes;
      connectionsRef.current = simRes.connections;
      playSynthSfx('place', settingsRef.current);
      onClearPendingBuild();
      onGraphMutated();
      setSelectedNodeId(newNode.id);
      showToast(`Placed ${bDef.name}`);
      drawNow();
    }
    return;
  }

  // 2. Port Dot Interaction
  const portHit = findPortAtWorld(
    world.x,
    world.y,
    nodesRef.current,
    cameraRef.current.zoom
  );
  if (portHit) {
    const wMode = settingsRef.current.wiringMode;
    const tapSource = tapSourcePortRef.current;

    if (tapSource && portHit.port.side === 'input') {
      tryCreateConnection(
        ctx,
        tapSource.nodeId,
        tapSource.portId,
        portHit.nodeId,
        portHit.port.id
      );
      setTapSourcePort(null);
      return;
    }

    if (portHit.port.side === 'input') {
      const existingConn = connectionsRef.current.find(
        (c) => c.toNodeId === portHit.nodeId && c.toPortId === portHit.port.id
      );
      if (existingConn) {
        factoryHistory.pushSnapshot(
          nodesRef.current,
          connectionsRef.current,
          'Disconnect Conveyor'
        );
        const nextConns = connectionsRef.current.filter(
          (c) => c.id !== existingConn.id
        );
        invalidateAllConveyorCaches();
        const simRes = stepSimulation(nodesRef.current, nextConns, 0);
        nodesRef.current = simRes.nodes;
        connectionsRef.current = simRes.connections;
        playSynthSfx('disconnect', settingsRef.current);
        onGraphMutated();
        showToast('Conveyor line disconnected');
        drawNow();
        return;
      }
    }

    if (portHit.port.side === 'output') {
      if (wMode === 'tap' || wMode === 'both') {
        setTapSourcePort({
          nodeId: portHit.nodeId,
          portId: portHit.port.id,
          label: portHit.port.label,
        });
        playSynthSfx('click', settingsRef.current);
      }
      if (wMode === 'drag' || wMode === 'both') {
        interactionRef.current.wiringFrom = portHit;
      }
      return;
    }
  }

  // 3. Node Card Body Drag / Select (World Resource Deposits are fixed on the map!)
  const hitNode = findNodeAtWorld(
    world.x,
    world.y,
    nodesRef.current,
    cameraRef.current.zoom
  );
  if (hitNode) {
    // 3a. Exterior STANDBY rocker switch on Miner Mk.1: toggle standby directly from outside without opening inspector!
    if (isPointOnMinerStandbySwitch(world.x, world.y, hitNode, cameraRef.current.zoom)) {
      factoryHistory.pushSnapshot(
        nodesRef.current,
        connectionsRef.current,
        'Toggle Machine Standby'
      );
      const nextStandby = !hitNode.isStandby;
      const nextNodes = nodesRef.current.map((n) =>
        n.id === hitNode.id ? { ...n, isStandby: nextStandby } : n
      );
      const simRes = stepSimulation(nextNodes, connectionsRef.current, 0);
      nodesRef.current = simRes.nodes;
      connectionsRef.current = simRes.connections;
      if (selectedNodeIdRef.current === hitNode.id) {
        const updated = nodesRef.current.find((n) => n.id === hitNode.id) ?? null;
        setSelectedNodeSnapshot(updated ? { ...updated } : null);
      }
      playSynthSfx('click', settingsRef.current);
      onGraphMutated();
      showToast(
        nextStandby
          ? `${hitNode.title} switched to STANDBY`
          : `${hitNode.title} resumed operation`
      );
      drawNow();
      return;
    }

    setSelectedWaypoint(null);
    if (selectedConnectionIdRef.current !== null) {
      setSelectedConnectionId(null);
    }
    if (selectedNodeIdRef.current !== hitNode.id) {
      setSelectedNodeId(hitNode.id);
    }
    setSelectedNodeSnapshot({ ...hitNode });

    if (hitNode.buildingId === 'resource_deposit' || hitNode.isWorldDeposit) {
      interactionRef.current.isPanning = true;
      interactionRef.current.panStartX = e.clientX;
      interactionRef.current.panStartY = e.clientY;
      interactionRef.current.camStartX = cameraRef.current.x;
      interactionRef.current.camStartY = cameraRef.current.y;
      return;
    }

    preDragGraphRef.current = {
      nodes: nodesRef.current.map((n) => ({ ...n })),
      connections: connectionsRef.current.map((c) => ({
        ...c,
        waypoints: c.waypoints ? c.waypoints.map((w) => ({ ...w })) : undefined,
      })),
    };
    interactionRef.current.draggingNodeId = hitNode.id;
    interactionRef.current.dragOffsetX = world.x - hitNode.x;
    interactionRef.current.dragOffsetY = world.y - hitNode.y;
    interactionRef.current.dragStartNodeX = hitNode.x;
    interactionRef.current.dragStartNodeY = hitNode.y;
    interactionRef.current.dragHasCollision = false;

    if (
      selectedNodeIdsRef.current.length > 1 &&
      selectedNodeIdsRef.current.includes(hitNode.id)
    ) {
      const groupPos = new Map<string, { startX: number; startY: number }>();
      for (const sId of selectedNodeIdsRef.current) {
        const sNode = nodesRef.current.find((n) => n.id === sId);
        if (sNode && sNode.buildingId !== 'resource_deposit' && !sNode.isWorldDeposit) {
          groupPos.set(sId, { startX: sNode.x, startY: sNode.y });
        }
      }
      interactionRef.current.draggingGroupPositions = groupPos;
    } else {
      interactionRef.current.draggingGroupPositions = null;
      if (!selectedNodeIdsRef.current.includes(hitNode.id)) {
        setSelectedNodeIds([hitNode.id]);
      }
    }
    return;
  }

  // 3.5 Direct In-World Conveyor Belt Selection & Inspection
  const hitBelt = findBeltAtWorld(
    world.x,
    world.y,
    nodesRef.current,
    connectionsRef.current,
    cameraRef.current.zoom,
    settingsRef.current.showPortRates
  );
  if (hitBelt) {
    setSelectedWaypoint(null);
    if (selectedNodeIdRef.current !== null) {
      setSelectedNodeId(null);
    }
    setSelectedNodeIds([]);
    if (selectedConnectionIdRef.current !== hitBelt.id) {
      setSelectedConnectionId(hitBelt.id);
    }
    setSelectedConnectionSnapshot({
      ...hitBelt,
      inFlightItems: hitBelt.inFlightItems?.map((p) => ({ ...p })),
    });
    playSynthSfx('click', settingsRef.current);
    interactionRef.current.isPanning = true;
    interactionRef.current.panStartX = e.clientX;
    interactionRef.current.panStartY = e.clientY;
    interactionRef.current.camStartX = cameraRef.current.x;
    interactionRef.current.camStartY = cameraRef.current.y;
    drawNow();
    return;
  }

  // 4. Empty Canvas Double-Tap Zoom
  const now = performance.now();
  const dtTap = now - interactionRef.current.lastTapTime;
  const tapDist = Math.hypot(
    sx - interactionRef.current.lastTapX,
    sy - interactionRef.current.lastTapY
  );

  if (dtTap < 320 && tapDist < 36) {
    interactionRef.current.isDoubleTapZooming = true;
    interactionRef.current.doubleTapAnchorX = sx;
    interactionRef.current.doubleTapAnchorY = sy;
    interactionRef.current.doubleTapStartY = sy;
    interactionRef.current.doubleTapStartZoom = cameraRef.current.zoom;
    interactionRef.current.lastTapTime = 0;
    return;
  }

  interactionRef.current.lastTapTime = now;
  interactionRef.current.lastTapX = sx;
  interactionRef.current.lastTapY = sy;

  // 5. Standard Pan
  if (selectedWaypointRef.current !== null) {
    setSelectedWaypoint(null);
  }
  if (selectedNodeIdRef.current !== null) {
    setSelectedNodeId(null);
  }
  if (selectedNodeIdsRef.current.length > 0) {
    setSelectedNodeIds([]);
  }
  if (selectedConnectionIdRef.current !== null) {
    setSelectedConnectionId(null);
  }
  if (tapSourcePortRef.current !== null) {
    setTapSourcePort(null);
  }
  interactionRef.current.isPanning = true;
  interactionRef.current.panStartX = e.clientX;
  interactionRef.current.panStartY = e.clientY;
  interactionRef.current.camStartX = cameraRef.current.x;
  interactionRef.current.camStartY = cameraRef.current.y;
}
