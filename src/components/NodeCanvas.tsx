import React, { useEffect, useRef, useState } from 'react';
import { BUILDINGS } from '../game/catalog';
import { playSynthSfx } from '../game/audio';
import {
  canConnectPorts,
  changeNodeRecipe,
  clampCameraToWorld,
  clampNodeToWorld,
  computeNodeSnapAlignment,
  createConveyorConnection,
  createMachineNode,
  distanceFromPointToPolyline,
  doesPathIntersectNode,
  getBeltTierDef,
  getCachedConveyorRoute,
  getPortWorldPosition,
  invalidateAllConveyorCaches,
  isMacroIconZoom,
  isNodePositionValid,
  MAX_ZOOM,
  MIN_ZOOM,
  sampleOrthogonalPath,
  SnapGuideline,
  stepSimulation,
  upgradeConveyorBeltTier,
  isMinerDirectlyOnDeposit,
  isPointInsideObstacle,
} from '../game/rules';
import { factoryHistory } from '../game/history';
import {
  ActiveCanvasTool,
  CameraState,
  ConveyorBeltTier,
  ConveyorConnection,
  MachineNode,
  SettingsConfig,
} from '../game/types';
import { BeltInspectorPanel } from './BeltInspectorPanel';
import {
  doesCandidateNodeOverlapBeltsOrDots,
  findBeltAtWorld,
  findNodeAtWorld,
  findPortAtWorld,
  findWaypointAtWorld,
  getClosestPointOnBelt,
  hasBeltSnapshotChanged,
  hasInspectorSnapshotChanged,
  PortHit,
} from './canvasHitTesting';
import { renderFactoryScene } from './canvasRenderer';
import { NodeInspectorPanel } from './NodeInspectorPanel';

interface NodeCanvasProps {
  mode: 'background' | 'interactive';
  nodesRef: React.MutableRefObject<MachineNode[]>;
  connectionsRef: React.MutableRefObject<ConveyorConnection[]>;
  cameraRef: React.MutableRefObject<CameraState>;
  settings: SettingsConfig;
  activeBeltTier: ConveyorBeltTier;
  activeTool?: ActiveCanvasTool;
  onSelectTool?: (tool: ActiveCanvasTool) => void;
  pendingBuildId: string | null;
  onClearPendingBuild: () => void;
  onGraphMutated: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const NodeCanvas: React.FC<NodeCanvasProps> = ({
  mode,
  nodesRef,
  connectionsRef,
  cameraRef,
  settings,
  activeBeltTier,
  activeTool = 'edit',
  onSelectTool,
  pendingBuildId,
  onClearPendingBuild,
  onGraphMutated,
  onUndo,
  onRedo,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const modeRef = useRef<'background' | 'interactive'>(mode);
  modeRef.current = mode;

  const settingsRef = useRef<SettingsConfig>(settings);
  settingsRef.current = settings;

  const activeBeltTierRef = useRef<ConveyorBeltTier>(activeBeltTier);
  activeBeltTierRef.current = activeBeltTier;

  const activeToolRef = useRef<ActiveCanvasTool>(activeTool);
  activeToolRef.current = activeTool;

  const preDragGraphRef = useRef<{
    nodes: MachineNode[];
    connections: ConveyorConnection[];
  } | null>(null);

  const pendingBuildRef = useRef<string | null>(pendingBuildId);
  pendingBuildRef.current = pendingBuildId;

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNodeIdRef = useRef<string | null>(null);
  selectedNodeIdRef.current = selectedNodeId;

  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const selectedNodeIdsRef = useRef<string[]>([]);
  selectedNodeIdsRef.current = selectedNodeIds;

  const [selectedNodeSnapshot, setSelectedNodeSnapshot] = useState<MachineNode | null>(null);
  const selectedNodeSnapshotRef = useRef<MachineNode | null>(null);
  selectedNodeSnapshotRef.current = selectedNodeSnapshot;

  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const selectedConnectionIdRef = useRef<string | null>(null);
  selectedConnectionIdRef.current = selectedConnectionId;

  const [selectedConnectionSnapshot, setSelectedConnectionSnapshot] =
    useState<ConveyorConnection | null>(null);
  const selectedConnectionSnapshotRef = useRef<ConveyorConnection | null>(null);
  selectedConnectionSnapshotRef.current = selectedConnectionSnapshot;

  const [selectedWaypoint, setSelectedWaypoint] = useState<{
    connId: string;
    index: number;
  } | null>(null);
  const selectedWaypointRef = useRef<{
    connId: string;
    index: number;
  } | null>(null);
  selectedWaypointRef.current = selectedWaypoint;

  const [tapSourcePort, setTapSourcePort] = useState<{
    nodeId: string;
    portId: string;
    label: string;
  } | null>(null);
  const tapSourcePortRef = useRef<{
    nodeId: string;
    portId: string;
    label: string;
  } | null>(null);
  tapSourcePortRef.current = tapSourcePort;

  const [statusToast, setStatusToast] = useState<string | null>(null);
  const drawNowRef = useRef<(() => void) | null>(null);

  const interactionRef = useRef<{
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
  }>({
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
  });

  const showToast = (msg: string) => {
    setStatusToast(msg);
  };

  useEffect(() => {
    if (!statusToast) return;
    const t = window.setTimeout(() => setStatusToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [statusToast]);

  useEffect(() => {
    if (!selectedNodeId) {
      setSelectedNodeSnapshot(null);
    } else {
      const found = nodesRef.current.find((n) => n.id === selectedNodeId) ?? null;
      setSelectedNodeSnapshot(found ? { ...found } : null);
    }
    drawNowRef.current?.();
  }, [selectedNodeId, nodesRef]);

  useEffect(() => {
    if (!selectedConnectionId) {
      setSelectedConnectionSnapshot(null);
    } else {
      const found =
        connectionsRef.current.find((c) => c.id === selectedConnectionId) ?? null;
      setSelectedConnectionSnapshot(
        found
          ? {
              ...found,
              inFlightItems: found.inFlightItems?.map((p) => ({ ...p })),
            }
          : null
      );
    }
    drawNowRef.current?.();
  }, [selectedConnectionId, connectionsRef]);

  // Reconcile selected node, belt, multi-select, and corner dot states when Undo/Redo or Save Load mutates the graph
  useEffect(() => {
    return factoryHistory.subscribe(() => {
      const curNodes = nodesRef.current;
      const curConns = connectionsRef.current;

      if (selectedNodeIdRef.current) {
        const liveNode = curNodes.find((n) => n.id === selectedNodeIdRef.current);
        if (!liveNode) {
          setSelectedNodeId(null);
          setSelectedNodeSnapshot(null);
        } else {
          setSelectedNodeSnapshot({
            ...liveNode,
            inputs: liveNode.inputs.map((p) => ({ ...p })),
            outputs: liveNode.outputs.map((p) => ({ ...p })),
          });
        }
      }

      if (selectedNodeIdsRef.current.length > 0) {
        const validIds = selectedNodeIdsRef.current.filter((id) =>
          curNodes.some((n) => n.id === id)
        );
        if (validIds.length !== selectedNodeIdsRef.current.length) {
          setSelectedNodeIds(validIds);
        }
      }

      if (selectedConnectionIdRef.current) {
        const liveConn = curConns.find((c) => c.id === selectedConnectionIdRef.current);
        if (!liveConn) {
          setSelectedConnectionId(null);
          setSelectedConnectionSnapshot(null);
        } else {
          setSelectedConnectionSnapshot({
            ...liveConn,
            inFlightItems: liveConn.inFlightItems?.map((p) => ({ ...p })),
          });
        }
      }

      if (selectedWaypointRef.current) {
        const { connId, index } = selectedWaypointRef.current;
        const liveConn = curConns.find((c) => c.id === connId);
        if (!liveConn || !liveConn.waypoints || !liveConn.waypoints[index]) {
          setSelectedWaypoint(null);
        }
      }

      drawNowRef.current?.();
    });
  }, [nodesRef, connectionsRef]);

  const resizeCanvasRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    resizeCanvasRef.current?.();
    drawNowRef.current?.();
  }, [tapSourcePort, mode, settings]);

  const applyZoomAboutScreenPoint = (
    nextZoomRaw: number,
    screenX: number,
    screenY: number,
    viewportW: number,
    viewportH: number
  ) => {
    const cam = cameraRef.current;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoomRaw));
    const worldX = (screenX - cam.x) / cam.zoom;
    const worldY = (screenY - cam.y) / cam.zoom;
    const rawCam: CameraState = {
      x: screenX - worldX * nextZoom,
      y: screenY - worldY * nextZoom,
      zoom: nextZoom,
    };
    cameraRef.current = clampCameraToWorld(rawCam, viewportW, viewportH);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId = 0;
    let lastTime = performance.now();
    let simAccumulatorSec = 0;
    let lastRenderTime = 0;
    const FIXED_SIM_DT = 0.05; // Fixed 20 Hz simulation tick (50ms) decoupled from 60 FPS render loop

    const getEffectiveDpr = () =>
      settingsRef.current.performanceMode === 'battery_saver'
        ? 1
        : Math.min(window.devicePixelRatio || 1, 2);

    const drawScene = () => {
      const dpr = getEffectiveDpr();
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      renderFactoryScene({
        ctx,
        width,
        height,
        dpr,
        cam: cameraRef.current,
        cfg: settingsRef.current,
        nodes: nodesRef.current,
        connections: connectionsRef.current,
        selectedNodeId: selectedNodeIdRef.current,
        selectedConnectionId: selectedConnectionIdRef.current,
        hoveredConnectionId: interactionRef.current.hoveredConnectionId,
        tapSourcePort: tapSourcePortRef.current,
        activeBeltTier: activeBeltTierRef.current,
        pendingBuildId: pendingBuildRef.current,
        draggingNodeId: interactionRef.current.draggingNodeId,
        dragHasCollision: interactionRef.current.dragHasCollision,
        wiringFrom: interactionRef.current.wiringFrom,
        pointerWorldX: interactionRef.current.pointerWorldX,
        pointerWorldY: interactionRef.current.pointerWorldY,
        elapsedTime: interactionRef.current.elapsedTime,
        activeGuidelines: interactionRef.current.activeGuidelines,
        activeTool: activeToolRef.current,
        hoveredWaypoint: interactionRef.current.hoveredWaypoint,
        selectedWaypoint: selectedWaypointRef.current,
        previewWaypoint: interactionRef.current.previewWaypoint,
        selectedNodeIds: selectedNodeIdsRef.current,
        marqueeRect: interactionRef.current.isMarqueeSelecting
          ? {
              x: Math.min(
                interactionRef.current.marqueeStartX,
                interactionRef.current.marqueeCurrentX
              ),
              y: Math.min(
                interactionRef.current.marqueeStartY,
                interactionRef.current.marqueeCurrentY
              ),
              width: Math.abs(
                interactionRef.current.marqueeCurrentX -
                  interactionRef.current.marqueeStartX
              ),
              height: Math.abs(
                interactionRef.current.marqueeCurrentY -
                  interactionRef.current.marqueeStartY
              ),
            }
          : null,
      });
    };

    drawNowRef.current = drawScene;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = getEffectiveDpr();
      const targetW = Math.max(1, Math.floor(rect.width * dpr));
      const targetH = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      if (modeRef.current === 'interactive') {
        cameraRef.current = clampCameraToWorld(
          cameraRef.current,
          rect.width,
          rect.height
        );
      }
      drawScene();
    };

    resizeCanvasRef.current = resizeCanvas;
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(canvas);

    const renderLoop = (now: number) => {
      animationFrameId = window.requestAnimationFrame(renderLoop);

      const isBatterySaver = settingsRef.current.performanceMode === 'battery_saver';
      // In Battery Saver mode when not actively dragging/panning, cap visual redraws to ~30 FPS
      const isInteracting =
        interactionRef.current.isPanning ||
        interactionRef.current.draggingNodeId !== null ||
        interactionRef.current.wiringFrom !== null ||
        interactionRef.current.smoothZoomTarget !== null;
      if (isBatterySaver && !isInteracting && now - lastRenderTime < 31) {
        return;
      }
      lastRenderTime = now;

      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const frameDt = Math.min(Math.max(rawDt, 0.001), 0.15);

      simAccumulatorSec = Math.min(simAccumulatorSec + frameDt, FIXED_SIM_DT * 3);
      let ranSimStep = false;
      while (simAccumulatorSec >= FIXED_SIM_DT) {
        const simResult = stepSimulation(
          nodesRef.current,
          connectionsRef.current,
          FIXED_SIM_DT
        );
        nodesRef.current = simResult.nodes;
        connectionsRef.current = simResult.connections;
        simAccumulatorSec -= FIXED_SIM_DT;
        ranSimStep = true;
      }

      if (ranSimStep && selectedNodeIdRef.current) {
        const liveNode = nodesRef.current.find(
          (n) => n.id === selectedNodeIdRef.current
        );
        if (
          liveNode &&
          hasInspectorSnapshotChanged(selectedNodeSnapshotRef.current, liveNode)
        ) {
          setSelectedNodeSnapshot({
            ...liveNode,
            inputs: liveNode.inputs.map((p) => ({ ...p })),
            outputs: liveNode.outputs.map((p) => ({ ...p })),
          });
        }
      }

      if (ranSimStep && selectedConnectionIdRef.current) {
        const liveConn = connectionsRef.current.find(
          (c) => c.id === selectedConnectionIdRef.current
        );
        if (
          liveConn &&
          hasBeltSnapshotChanged(selectedConnectionSnapshotRef.current, liveConn)
        ) {
          setSelectedConnectionSnapshot({
            ...liveConn,
            inFlightItems: liveConn.inFlightItems?.map((p) => ({ ...p })),
          });
        }
      }

      interactionRef.current.elapsedTime += frameDt;

      const dpr = getEffectiveDpr();
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      if (modeRef.current === 'background') {
        cameraRef.current.x = -1820 + Math.sin(now * 0.00025) * 90;
        cameraRef.current.y = -1920 + Math.cos(now * 0.0002) * 35;
        cameraRef.current.zoom = 0.74;
      } else if (interactionRef.current.smoothZoomTarget !== null) {
        const curZ = cameraRef.current.zoom;
        const targetZ = interactionRef.current.smoothZoomTarget;
        const diff = targetZ - curZ;
        if (Math.abs(diff) < 0.002) {
          applyZoomAboutScreenPoint(
            targetZ,
            interactionRef.current.smoothZoomAnchorX,
            interactionRef.current.smoothZoomAnchorY,
            width,
            height
          );
          interactionRef.current.smoothZoomTarget = null;
        } else {
          const stepZ = curZ + diff * Math.min(1, frameDt * 14);
          applyZoomAboutScreenPoint(
            stepZ,
            interactionRef.current.smoothZoomAnchorX,
            interactionRef.current.smoothZoomAnchorY,
            width,
            height
          );
        }
      }

      drawScene();
    };

    animationFrameId = window.requestAnimationFrame(renderLoop);
    return () => {
      drawNowRef.current = null;
      resizeCanvasRef.current = null;
      window.cancelAnimationFrame(animationFrameId);
      ro.disconnect();
    };
  }, [nodesRef, connectionsRef, cameraRef]);

  const screenToWorld = (clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const cam = cameraRef.current;
    return {
      x: (sx - cam.x) / cam.zoom,
      y: (sy - cam.y) / cam.zoom,
    };
  };

  const tryCreateConnection = (
    fromNodeId: string,
    fromPortId: string,
    toNodeId: string,
    toPortId: string
  ) => {
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
    connectionsRef.current = [...connectionsRef.current, newConn];
    playSynthSfx('connect', settingsRef.current);
    onGraphMutated();
    showToast(`Connected ${tierDef.name} (${tierDef.capacityPerMin}/m)`);
    drawNowRef.current?.();
    return true;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'interactive') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
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

    const world = screenToWorld(e.clientX, e.clientY);
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
      drawNowRef.current?.();
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
          drawNowRef.current?.();
          return;
        }
      }

      // If clicked empty space in waypoint mode, clear selected waypoint and pan the camera
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

        // Belt & corner-dot overlap rule: machine cannot be placed across active conveyor paths or corner dots
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
        drawNowRef.current?.();
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

      if (tapSourcePort && portHit.port.side === 'input') {
        tryCreateConnection(
          tapSourcePort.nodeId,
          tapSourcePort.portId,
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
          connectionsRef.current = connectionsRef.current.filter(
            (c) => c.id !== existingConn.id
          );
          invalidateAllConveyorCaches();
          playSynthSfx('disconnect', settingsRef.current);
          onGraphMutated();
          showToast('Conveyor line disconnected');
          drawNowRef.current?.();
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
      drawNowRef.current?.();
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
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'interactive') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (interactionRef.current.activePointers.has(e.pointerId)) {
      interactionRef.current.activePointers.set(e.pointerId, { x: sx, y: sy });
    }

    if (interactionRef.current.activePointers.size === 2) {
      const pts = Array.from(interactionRef.current.activePointers.values());
      const dist = Math.max(10, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
      const midX = (pts[0].x + pts[1].x) * 0.5;
      const midY = (pts[0].y + pts[1].y) * 0.5;

      const prevDist = interactionRef.current.lastPinchDist ?? dist;
      const prevMidX = interactionRef.current.lastPinchMidX ?? midX;
      const prevMidY = interactionRef.current.lastPinchMidY ?? midY;

      const scaleRatio = dist / prevDist;
      const cam = cameraRef.current;
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * scaleRatio));

      const worldMidX = (prevMidX - cam.x) / cam.zoom;
      const worldMidY = (prevMidY - cam.y) / cam.zoom;

      const rawCam: CameraState = {
        x: midX - worldMidX * nextZoom,
        y: midY - worldMidY * nextZoom,
        zoom: nextZoom,
      };
      cameraRef.current = clampCameraToWorld(rawCam, rect.width, rect.height);

      interactionRef.current.lastPinchDist = dist;
      interactionRef.current.lastPinchMidX = midX;
      interactionRef.current.lastPinchMidY = midY;
      drawNowRef.current?.();
      return;
    }

    if (interactionRef.current.isDoubleTapZooming) {
      const dy = sy - interactionRef.current.doubleTapStartY;
      if (Math.abs(dy) > 4) {
        interactionRef.current.pointerMoved = true;
      }
      const zoomFactor = Math.pow(1.006, dy);
      const nextZoom = interactionRef.current.doubleTapStartZoom * zoomFactor;
      applyZoomAboutScreenPoint(
        nextZoom,
        interactionRef.current.doubleTapAnchorX,
        interactionRef.current.doubleTapAnchorY,
        rect.width,
        rect.height
      );
      drawNowRef.current?.();
      return;
    }

    const world = screenToWorld(e.clientX, e.clientY);
    interactionRef.current.pointerWorldX = world.x;
    interactionRef.current.pointerWorldY = world.y;

    if (interactionRef.current.isMarqueeSelecting) {
      interactionRef.current.pointerMoved = true;
      interactionRef.current.marqueeCurrentX = world.x;
      interactionRef.current.marqueeCurrentY = world.y;
      drawNowRef.current?.();
      return;
    }

    if (interactionRef.current.wiringFrom) {
      interactionRef.current.pointerMoved = true;
      drawNowRef.current?.();
      return;
    }

    if (interactionRef.current.draggingWaypoint) {
      const dw = interactionRef.current.draggingWaypoint;
      if (Math.hypot(world.x - dw.startX, world.y - dw.startY) > 6) {
        interactionRef.current.pointerMoved = true;
      }
      if (!interactionRef.current.pointerMoved) {
        return;
      }
      const snappedX = Math.round(world.x / 24) * 24;
      const snappedY = Math.round(world.y / 24) * 24;

      // Prevent dragging a corner dot inside any building or resource deposit
      if (isPointInsideObstacle(snappedX, snappedY, nodesRef.current, 14)) {
        return;
      }

      // Also verify that the belt path with this candidate waypoint does not cut through any building or deposit
      const targetConn = connectionsRef.current.find((c) => c.id === dw.connId);
      if (targetConn) {
        const fn = nodesRef.current.find((n) => n.id === targetConn.fromNodeId);
        const tn = nodesRef.current.find((n) => n.id === targetConn.toNodeId);
        if (fn && tn) {
          const outIdx = fn.outputs.findIndex((p) => p.id === targetConn.fromPortId);
          const inIdx = tn.inputs.findIndex((p) => p.id === targetConn.toPortId);
          const candidateWps = targetConn.waypoints ? [...targetConn.waypoints] : [];
          if (candidateWps[dw.index]) {
            candidateWps[dw.index] = { x: snappedX, y: snappedY };
          }
          if (outIdx >= 0 && inIdx >= 0) {
            const candidateRoute = getCachedConveyorRoute(
              fn,
              outIdx,
              tn,
              inIdx,
              nodesRef.current,
              candidateWps
            );
            const srcDeposit =
              fn.buildingId === 'miner_mk1'
                ? nodesRef.current.find(
                    (n) =>
                      n.buildingId === 'resource_deposit' &&
                      isMinerDirectlyOnDeposit(fn, n, 8)
                  )
                : undefined;
            const dstDeposit =
              tn.buildingId === 'miner_mk1'
                ? nodesRef.current.find(
                    (n) =>
                      n.buildingId === 'resource_deposit' &&
                      isMinerDirectlyOnDeposit(tn, n, 8)
                  )
                : undefined;
            const interiorPts =
              candidateRoute.pts.length >= 4
                ? candidateRoute.pts.slice(1, candidateRoute.pts.length - 1)
                : candidateRoute.pts;
            const hitsAnyNode = nodesRef.current.some((obs) => {
              const isEndpointNode =
                obs.id === fn.id ||
                obs.id === tn.id ||
                obs.id === srcDeposit?.id ||
                obs.id === dstDeposit?.id;
              if (isEndpointNode) {
                return doesPathIntersectNode(interiorPts, obs, 6);
              }
              return doesPathIntersectNode(candidateRoute.pts, obs, 8);
            });
            if (hitsAnyNode) {
              return;
            }
          }
        }
      }

      connectionsRef.current = connectionsRef.current.map((c) => {
        if (c.id !== dw.connId) return c;
        const nextWps = c.waypoints ? [...c.waypoints] : [];
        if (nextWps[dw.index]) {
          nextWps[dw.index] = { x: snappedX, y: snappedY };
        }
        return { ...c, waypoints: nextWps };
      });
      invalidateAllConveyorCaches();
      drawNowRef.current?.();
      return;
    }

    if (interactionRef.current.draggingGroupPositions && interactionRef.current.draggingNodeId) {
      interactionRef.current.pointerMoved = true;
      const leaderId = interactionRef.current.draggingNodeId;
      const leaderStartPos = interactionRef.current.draggingGroupPositions.get(leaderId);
      if (leaderStartPos) {
        const rawLeaderX = world.x - interactionRef.current.dragOffsetX;
        const rawLeaderY = world.y - interactionRef.current.dragOffsetY;
        const snappedLeaderX = Math.round(rawLeaderX / 24) * 24;
        const snappedLeaderY = Math.round(rawLeaderY / 24) * 24;
        const dx = snappedLeaderX - leaderStartPos.startX;
        const dy = snappedLeaderY - leaderStartPos.startY;

        const nextNodes = nodesRef.current.map((n) => {
          const sp = interactionRef.current.draggingGroupPositions?.get(n.id);
          if (!sp) return n;
          const clamped = clampNodeToWorld(sp.startX + dx, sp.startY + dy, n.width, n.height);
          return { ...n, x: clamped.x, y: clamped.y };
        });
        nodesRef.current = nextNodes;
        invalidateAllConveyorCaches();

        let groupCollision = false;
        for (const [gId] of interactionRef.current.draggingGroupPositions.entries()) {
          const gNode = nextNodes.find((n) => n.id === gId);
          if (!gNode) continue;
          const check = isNodePositionValid(nextNodes, gNode, 4);
          if (
            !check.valid ||
            doesCandidateNodeOverlapBeltsOrDots(
              gNode,
              nextNodes,
              connectionsRef.current
            )
          ) {
            groupCollision = true;
            break;
          }
        }
        interactionRef.current.dragHasCollision = groupCollision;
      }
      drawNowRef.current?.();
      return;
    }

    if (interactionRef.current.draggingNodeId) {
      interactionRef.current.pointerMoved = true;
      const nodeId = interactionRef.current.draggingNodeId;
      const rawX = world.x - interactionRef.current.dragOffsetX;
      const rawY = world.y - interactionRef.current.dragOffsetY;

      const targetNode = nodesRef.current.find((n) => n.id === nodeId);
      if (targetNode) {
        const snapRes = computeNodeSnapAlignment(
          {
            id: targetNode.id,
            buildingId: targetNode.buildingId,
            x: rawX,
            y: rawY,
            width: targetNode.width,
            height: targetNode.height,
          },
          nodesRef.current,
          connectionsRef.current,
          settingsRef.current
        );
        interactionRef.current.activeGuidelines = snapRes.guidelines;

        const clamped = clampNodeToWorld(
          snapRes.x,
          snapRes.y,
          targetNode.width,
          targetNode.height
        );
        const moved = clamped.x !== targetNode.x || clamped.y !== targetNode.y;
        const candidateNode: MachineNode = { ...targetNode, x: clamped.x, y: clamped.y };
        const nextNodes = nodesRef.current.map((n) =>
          n.id === nodeId ? candidateNode : n
        );
        if (moved) {
          nodesRef.current = nextNodes;
          invalidateAllConveyorCaches();
        }
        const check = isNodePositionValid(nextNodes, candidateNode, 4);
        const hitsBeltOrDot = doesCandidateNodeOverlapBeltsOrDots(
          candidateNode,
          nextNodes,
          connectionsRef.current
        );
        interactionRef.current.dragHasCollision = !check.valid || hitsBeltOrDot;
      }
      drawNowRef.current?.();
      return;
    }

    if (interactionRef.current.isPanning) {
      const dx = e.clientX - interactionRef.current.panStartX;
      const dy = e.clientY - interactionRef.current.panStartY;
      if (Math.hypot(dx, dy) > 4) {
        interactionRef.current.pointerMoved = true;
      }
      cameraRef.current = clampCameraToWorld(
        {
          x: interactionRef.current.camStartX + dx,
          y: interactionRef.current.camStartY + dy,
          zoom: cameraRef.current.zoom,
        },
        rect.width,
        rect.height
      );
      drawNowRef.current?.();
      return;
    }

    // Hover feedback for conveyor belts and waypoint pins when moving pointer across canvas
    const hitWpHover = findWaypointAtWorld(
      world.x,
      world.y,
      connectionsRef.current,
      cameraRef.current.zoom
    );
    interactionRef.current.hoveredWaypoint = hitWpHover
      ? { connId: hitWpHover.conn.id, index: hitWpHover.index }
      : null;

    if (activeToolRef.current === 'waypoint' && !hitWpHover) {
      const hitB = findBeltAtWorld(
        world.x,
        world.y,
        nodesRef.current,
        connectionsRef.current,
        cameraRef.current.zoom,
        settingsRef.current.showPortRates
      );
      if (hitB) {
        const closest = getClosestPointOnBelt(
          world.x,
          world.y,
          hitB,
          nodesRef.current
        );
        if (closest && closest.dist <= 30) {
          const sx = Math.round(closest.x / 24) * 24;
          const sy = Math.round(closest.y / 24) * 24;
          if (!isPointInsideObstacle(sx, sy, nodesRef.current, 14)) {
            interactionRef.current.previewWaypoint = {
              connId: hitB.id,
              x: sx,
              y: sy,
            };
          } else {
            interactionRef.current.previewWaypoint = null;
          }
        } else {
          interactionRef.current.previewWaypoint = null;
        }
      } else {
        interactionRef.current.previewWaypoint = null;
      }
    } else {
      interactionRef.current.previewWaypoint = null;
    }

    const overPort = findPortAtWorld(
      world.x,
      world.y,
      nodesRef.current,
      cameraRef.current.zoom
    );
    const overNode = overPort
      ? null
      : findNodeAtWorld(
          world.x,
          world.y,
          nodesRef.current,
          cameraRef.current.zoom
        );
    const overBelt =
      !overPort && !overNode
        ? findBeltAtWorld(
            world.x,
            world.y,
            nodesRef.current,
            connectionsRef.current,
            cameraRef.current.zoom,
            settingsRef.current.showPortRates
          )
        : null;
    const nextHoverBeltId = overBelt?.id ?? null;
    if (interactionRef.current.hoveredConnectionId !== nextHoverBeltId) {
      interactionRef.current.hoveredConnectionId = nextHoverBeltId;
      drawNowRef.current?.();
    }
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'interactive') return;
    interactionRef.current.activePointers.delete(e.pointerId);

    if (interactionRef.current.activePointers.size < 2) {
      interactionRef.current.lastPinchDist = null;
      interactionRef.current.lastPinchMidX = null;
      interactionRef.current.lastPinchMidY = null;
    }

    if (interactionRef.current.isDoubleTapZooming) {
      if (!interactionRef.current.pointerMoved) {
        const nextTarget = Math.min(MAX_ZOOM, cameraRef.current.zoom * 1.35);
        interactionRef.current.smoothZoomTarget = nextTarget;
        interactionRef.current.smoothZoomAnchorX = interactionRef.current.doubleTapAnchorX;
        interactionRef.current.smoothZoomAnchorY = interactionRef.current.doubleTapAnchorY;
      }
      interactionRef.current.isDoubleTapZooming = false;
      onGraphMutated();
      return;
    }

    const world = screenToWorld(e.clientX, e.clientY);

    if (interactionRef.current.isMarqueeSelecting) {
      const minX = Math.min(
        interactionRef.current.marqueeStartX,
        interactionRef.current.marqueeCurrentX
      );
      const maxX = Math.max(
        interactionRef.current.marqueeStartX,
        interactionRef.current.marqueeCurrentX
      );
      const minY = Math.min(
        interactionRef.current.marqueeStartY,
        interactionRef.current.marqueeCurrentY
      );
      const maxY = Math.max(
        interactionRef.current.marqueeStartY,
        interactionRef.current.marqueeCurrentY
      );
      const marqueeW = maxX - minX;
      const marqueeH = maxY - minY;

      if (marqueeW < 12 && marqueeH < 12) {
        const hitNode = findNodeAtWorld(
          world.x,
          world.y,
          nodesRef.current,
          cameraRef.current.zoom
        );
        if (hitNode && hitNode.buildingId !== 'resource_deposit' && !hitNode.isWorldDeposit) {
          setSelectedNodeIds((prev) =>
            prev.includes(hitNode.id)
              ? prev.filter((id) => id !== hitNode.id)
              : [...prev, hitNode.id]
          );
          setSelectedNodeId(hitNode.id);
          playSynthSfx('click', settingsRef.current);
        } else {
          setSelectedNodeIds([]);
          setSelectedNodeId(null);
        }
      } else {
        const selected = nodesRef.current.filter((n) => {
          if (n.buildingId === 'resource_deposit' || n.isWorldDeposit) return false;
          return (
            n.x < maxX &&
            n.x + n.width > minX &&
            n.y < maxY &&
            n.y + n.height > minY
          );
        });
        const ids = selected.map((n) => n.id);
        setSelectedNodeIds(ids);
        if (ids.length > 0) {
          setSelectedNodeId(ids[0]);
          playSynthSfx('click', settingsRef.current);
          showToast(`Selected ${ids.length} building${ids.length > 1 ? 's' : ''}`);
        } else {
          setSelectedNodeId(null);
        }
      }

      interactionRef.current.isMarqueeSelecting = false;
      drawNowRef.current?.();
      return;
    }

    if (interactionRef.current.draggingGroupPositions) {
      if (interactionRef.current.pointerMoved) {
        if (interactionRef.current.dragHasCollision) {
          const groupMap = interactionRef.current.draggingGroupPositions;
          nodesRef.current = nodesRef.current.map((n) => {
            const sp = groupMap.get(n.id);
            if (!sp) return n;
            return { ...n, x: sp.startX, y: sp.startY };
          });
          invalidateAllConveyorCaches();
          playSynthSfx('error', settingsRef.current);
          showToast('Buildings cannot overlap nodes, belts, or corner dots! Returned to start.');
        } else if (preDragGraphRef.current) {
          factoryHistory.pushSnapshot(
            preDragGraphRef.current.nodes,
            preDragGraphRef.current.connections,
            `Move ${interactionRef.current.draggingGroupPositions.size} Buildings`
          );
          const simResult = stepSimulation(nodesRef.current, connectionsRef.current, 0);
          nodesRef.current = simResult.nodes;
          connectionsRef.current = simResult.connections;
          onGraphMutated();
        }
      }
      interactionRef.current.draggingGroupPositions = null;
      interactionRef.current.draggingNodeId = null;
      interactionRef.current.dragHasCollision = false;
      interactionRef.current.activeGuidelines = [];
      preDragGraphRef.current = null;
      drawNowRef.current?.();
      return;
    }

    if (interactionRef.current.wiringFrom) {
      const wf = interactionRef.current.wiringFrom;
      const targetPort = findPortAtWorld(
        world.x,
        world.y,
        nodesRef.current,
        cameraRef.current.zoom
      );
      if (targetPort && targetPort.port.side === 'input') {
        tryCreateConnection(wf.nodeId, wf.port.id, targetPort.nodeId, targetPort.port.id);
        setTapSourcePort(null);
      }
      interactionRef.current.wiringFrom = null;
      drawNowRef.current?.();
    }

    if (interactionRef.current.draggingWaypoint) {
      const dw = interactionRef.current.draggingWaypoint;
      if (interactionRef.current.pointerMoved && preDragGraphRef.current) {
        if (!dw.isNew) {
          factoryHistory.pushSnapshot(
            preDragGraphRef.current.nodes,
            preDragGraphRef.current.connections,
            'Move Conveyor Corner'
          );
        }
        const simResult = stepSimulation(nodesRef.current, connectionsRef.current, 0);
        nodesRef.current = simResult.nodes;
        connectionsRef.current = simResult.connections;
        onGraphMutated();
      } else if (!interactionRef.current.pointerMoved && !dw.isNew) {
        // In the Corner Dot tool ('waypoint'), tapping an existing dot without dragging dismantles it!
        if (activeToolRef.current === 'waypoint') {
          factoryHistory.pushSnapshot(
            nodesRef.current,
            connectionsRef.current,
            'Dismantle Conveyor Corner'
          );
          connectionsRef.current = connectionsRef.current.map((c) => {
            if (c.id !== dw.connId) return c;
            const nextWps = (c.waypoints ?? []).filter((_, idx) => idx !== dw.index);
            return { ...c, waypoints: nextWps.length > 0 ? nextWps : undefined };
          });
          invalidateAllConveyorCaches();
          const simResult = stepSimulation(nodesRef.current, connectionsRef.current, 0);
          nodesRef.current = simResult.nodes;
          connectionsRef.current = simResult.connections;
          setSelectedWaypoint(null);
          playSynthSfx('disconnect', settingsRef.current);
          onGraphMutated();
          showToast('Dismantled conveyor corner dot');
        }
      }
      interactionRef.current.draggingWaypoint = null;
      preDragGraphRef.current = null;
      drawNowRef.current?.();
    }

    if (interactionRef.current.draggingNodeId && interactionRef.current.pointerMoved) {
      const draggedId = interactionRef.current.draggingNodeId;
      if (interactionRef.current.dragHasCollision) {
        const draggedNode = nodesRef.current.find((n) => n.id === draggedId);
        nodesRef.current = nodesRef.current.map((n) => {
          if (n.id !== draggedId) return n;
          return {
            ...n,
            x: interactionRef.current.dragStartNodeX,
            y: interactionRef.current.dragStartNodeY,
          };
        });
        invalidateAllConveyorCaches();
        playSynthSfx('error', settingsRef.current);
        if (draggedNode?.buildingId === 'miner_mk1') {
          showToast('Miner Mk.1 must be positioned directly on top of an unoccupied Resource Deposit! (1 miner per deposit)');
        } else {
          showToast('Buildings cannot overlap nodes, belts, or corner dots! Returned to original position.');
        }
      } else {
        if (preDragGraphRef.current) {
          const draggedNode = nodesRef.current.find((n) => n.id === draggedId);
          const initialX = interactionRef.current.dragStartNodeX;
          const initialY = interactionRef.current.dragStartNodeY;
          if (draggedNode && (draggedNode.x !== initialX || draggedNode.y !== initialY)) {
            factoryHistory.pushSnapshot(
              preDragGraphRef.current.nodes,
              preDragGraphRef.current.connections,
              `Move ${BUILDINGS[draggedNode.buildingId]?.name ?? 'Machine'}`
            );
          }
        }
        const simResult = stepSimulation(nodesRef.current, connectionsRef.current, 0);
        nodesRef.current = simResult.nodes;
        connectionsRef.current = simResult.connections;
        onGraphMutated();
      }
    }

    interactionRef.current.activeGuidelines = [];
    interactionRef.current.dragHasCollision = false;
    interactionRef.current.draggingNodeId = null;
    interactionRef.current.isPanning = false;
    preDragGraphRef.current = null;
    drawNowRef.current?.();
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (mode !== 'interactive') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const baseZoom =
      interactionRef.current.smoothZoomTarget ?? cameraRef.current.zoom;
    const factor = Math.exp(-e.deltaY * 0.0018);
    const nextTarget = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, baseZoom * factor));

    interactionRef.current.smoothZoomTarget = nextTarget;
    interactionRef.current.smoothZoomAnchorX = mx;
    interactionRef.current.smoothZoomAnchorY = my;
  };

  const dismantleSelectedWaypoint = () => {
    if (!selectedWaypoint) return;
    const { connId, index } = selectedWaypoint;
    factoryHistory.pushSnapshot(
      nodesRef.current,
      connectionsRef.current,
      'Dismantle Conveyor Corner'
    );
    connectionsRef.current = connectionsRef.current.map((c) => {
      if (c.id !== connId) return c;
      const nextWps = (c.waypoints ?? []).filter((_, idx) => idx !== index);
      return { ...c, waypoints: nextWps.length > 0 ? nextWps : undefined };
    });
    invalidateAllConveyorCaches();
    const simResult = stepSimulation(nodesRef.current, connectionsRef.current, 0);
    nodesRef.current = simResult.nodes;
    connectionsRef.current = simResult.connections;
    setSelectedWaypoint(null);
    playSynthSfx('disconnect', settings);
    onGraphMutated();
    showToast('Dismantled conveyor corner dot');
    drawNowRef.current?.();
  };

  const dismantleSelectedGroup = () => {
    if (selectedNodeIds.length === 0) return;
    const idsToRemove = new Set(
      selectedNodeIds.filter((id) => {
        const node = nodesRef.current.find((n) => n.id === id);
        return node && node.buildingId !== 'resource_deposit' && !node.isWorldDeposit;
      })
    );
    if (idsToRemove.size === 0) {
      showToast('Natural resource deposits cannot be dismantled');
      return;
    }
    factoryHistory.pushSnapshot(
      nodesRef.current,
      connectionsRef.current,
      `Dismantle ${idsToRemove.size} Buildings`
    );
    nodesRef.current = nodesRef.current.filter((n) => !idsToRemove.has(n.id));
    connectionsRef.current = connectionsRef.current.filter(
      (c) => !idsToRemove.has(c.fromNodeId) && !idsToRemove.has(c.toNodeId)
    );
    setSelectedNodeIds([]);
    setSelectedNodeId(null);
    setSelectedNodeSnapshot(null);
    playSynthSfx('disconnect', settings);
    onGraphMutated();
    showToast(`Dismantled ${idsToRemove.size} building${idsToRemove.size > 1 ? 's' : ''}`);
    drawNowRef.current?.();
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        data-testid="factory-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        onWheel={handleWheel}
        className={`w-full h-full block touch-none ${
          pendingBuildId
            ? 'cursor-crosshair'
            : activeTool === 'move'
            ? 'cursor-grab active:cursor-grabbing'
            : activeTool === 'select'
            ? 'cursor-crosshair'
            : activeTool === 'waypoint'
            ? 'cursor-crosshair'
            : 'cursor-default'
        }`}
      />

      {/* Selected Corner Dot Floating Action Bar (Mobile-first Touch Bar) */}
      {mode === 'interactive' && selectedWaypoint && selectedNodeIds.length <= 1 && (
        <div
          style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'top center' }}
          className="fixed top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0E1524]/95 border border-amber-500/80 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>CORNER #{selectedWaypoint.index + 1}</span>
          </div>
          <button
            type="button"
            onClick={dismantleSelectedWaypoint}
            className="min-h-[38px] px-3 py-1.5 text-xs font-bold text-rose-300 hover:text-white bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 rounded-lg active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Dismantle Dot
          </button>
          <button
            type="button"
            onClick={() => setSelectedWaypoint(null)}
            className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg active:scale-95 transition-all"
          >
            Done
          </button>
        </div>
      )}

      {/* Multi-Selection Floating Action Bar (Mobile-first Touch Bar) */}
      {mode === 'interactive' && selectedNodeIds.length > 1 && (
        <div
          style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'top center' }}
          className="fixed top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0E1524]/95 border border-amber-500/80 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>{selectedNodeIds.length} SELECTED</span>
          </div>
          <button
            type="button"
            onClick={dismantleSelectedGroup}
            className="min-h-[38px] px-3 py-1.5 text-xs font-bold text-rose-300 hover:text-white bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 rounded-lg active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Dismantle All
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedNodeIds([]);
              setSelectedNodeId(null);
            }}
            className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg active:scale-95 transition-all"
          >
            Deselect
          </button>
        </div>
      )}

      {/* Placement Mode Banner */}
      {mode === 'interactive' && pendingBuildId && BUILDINGS[pendingBuildId] && (
        <div
          style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'top center' }}
          className="fixed top-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-[#131B2E] border border-amber-500/70 shadow-xl"
        >
          <span className="text-xs font-medium text-amber-300 whitespace-nowrap">
            Tap inside Sector 01 to place{' '}
            <strong className="font-display text-white">
              {BUILDINGS[pendingBuildId].name}
            </strong>
          </span>
          <button
            type="button"
            onClick={onClearPendingBuild}
            className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-md whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Tap-to-Tap Active Port Prompt */}
      {mode === 'interactive' && tapSourcePort && !pendingBuildId && (
        <div
          style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'top center' }}
          className="fixed top-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-[#131B2E] border border-cyan-500/70 shadow-xl"
        >
          <span className="text-xs text-cyan-200 whitespace-nowrap">
            Wiring Output ({tapSourcePort.label}) · Tap any Input Port
          </span>
          <button
            type="button"
            onClick={() => setTapSourcePort(null)}
            className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-md whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Selected Machine Node / Natural Deposit Inspector Popover */}
      {mode === 'interactive' && selectedNodeSnapshot && (
        <NodeInspectorPanel
          node={selectedNodeSnapshot}
          connections={connectionsRef.current}
          nodes={nodesRef.current}
          settings={settings}
          onClose={() => setSelectedNodeId(null)}
          onSelectRecipe={(rId) => {
            factoryHistory.pushSnapshot(
              nodesRef.current,
              connectionsRef.current,
              'Change Recipe'
            );
            nodesRef.current = nodesRef.current.map((n) =>
              n.id === selectedNodeSnapshot.id ? changeNodeRecipe(n, rId) : n
            );
            const updated =
              nodesRef.current.find((n) => n.id === selectedNodeSnapshot.id) ?? null;
            setSelectedNodeSnapshot(updated ? { ...updated } : null);
            playSynthSfx('click', settings);
            onGraphMutated();
            drawNowRef.current?.();
          }}
          onFlushBuffer={() => {
            factoryHistory.pushSnapshot(
              nodesRef.current,
              connectionsRef.current,
              'Flush Machine Storage'
            );
            nodesRef.current = nodesRef.current.map((n) => {
              if (n.id !== selectedNodeSnapshot.id) return n;
              return {
                ...n,
                inputStoredCount: 0,
                storedCount: 0,
                inputs: n.inputs.map((p) => ({ ...p, bufferedCount: 0 })),
                outputs: n.outputs.map((p) => ({ ...p, bufferedCount: 0 })),
              };
            });
            const updated =
              nodesRef.current.find((n) => n.id === selectedNodeSnapshot.id) ?? null;
            setSelectedNodeSnapshot(updated ? { ...updated } : null);
            playSynthSfx('click', settings);
            onGraphMutated();
            showToast('Flushed internal input & output storages');
            drawNowRef.current?.();
          }}
          onFillInputBuffer={() => {
            nodesRef.current = nodesRef.current.map((n) => {
              if (n.id !== selectedNodeSnapshot.id) return n;
              const isPassThrough =
                n.buildingId === 'storage_container' ||
                n.buildingId === 'the_hub' ||
                n.buildingId === 'splitter' ||
                n.buildingId === 'merger';
              const maxOut = n.maxStoredCount ?? 100;
              const filledInputs = n.inputs.map((p) => {
                const pMax = p.maxBuffer ?? 100;
                return { ...p, bufferedCount: pMax };
              });
              const totalIn = filledInputs.reduce(
                (acc, p) => acc + (p.bufferedCount ?? 0),
                0
              );
              return {
                ...n,
                progress: 0,
                inputStoredCount: totalIn,
                storedCount: isPassThrough ? maxOut : n.storedCount,
                inputs: filledInputs,
                outputs: isPassThrough
                  ? n.outputs.map((p) => ({ ...p, bufferedCount: maxOut }))
                  : n.outputs,
              };
            });
            const updated =
              nodesRef.current.find((n) => n.id === selectedNodeSnapshot.id) ?? null;
            setSelectedNodeSnapshot(updated ? { ...updated } : null);
            playSynthSfx('click', settings);
            onGraphMutated();
            showToast('Filled node input storage to 100%');
            drawNowRef.current?.();
          }}
          onFillOutputBuffer={() => {
            nodesRef.current = nodesRef.current.map((n) => {
              if (n.id !== selectedNodeSnapshot.id) return n;
              const maxOut = n.maxStoredCount ?? 100;
              return {
                ...n,
                progress: 0,
                storedCount: maxOut,
                outputs: n.outputs.map((p) => ({ ...p, bufferedCount: maxOut })),
              };
            });
            const updated =
              nodesRef.current.find((n) => n.id === selectedNodeSnapshot.id) ?? null;
            setSelectedNodeSnapshot(updated ? { ...updated } : null);
            playSynthSfx('click', settings);
            onGraphMutated();
            showToast('Filled node output storage to 100%');
            drawNowRef.current?.();
          }}
          onUpgradeConnectedBelts={(tier, shortLabel, capacityPerMin) => {
            factoryHistory.pushSnapshot(
              nodesRef.current,
              connectionsRef.current,
              `Upgrade Belts to ${shortLabel}`
            );
            let count = 0;
            connectionsRef.current = connectionsRef.current.map((c) => {
              if (
                c.fromNodeId === selectedNodeSnapshot.id ||
                c.toNodeId === selectedNodeSnapshot.id
              ) {
                count++;
                return upgradeConveyorBeltTier(c, tier);
              }
              return c;
            });
            setSelectedNodeSnapshot({ ...selectedNodeSnapshot });
            playSynthSfx('click', settings);
            onGraphMutated();
            showToast(
              count > 0
                ? `Upgraded ${count} belt(s) to ${shortLabel} (${capacityPerMin}/m)`
                : `Connect a belt first to upgrade to ${shortLabel}`
            );
            drawNowRef.current?.();
          }}
          onUnwireBelts={() => {
            factoryHistory.pushSnapshot(
              nodesRef.current,
              connectionsRef.current,
              'Disconnect Machine Belts'
            );
            connectionsRef.current = connectionsRef.current.filter(
              (c) =>
                c.fromNodeId !== selectedNodeSnapshot.id &&
                c.toNodeId !== selectedNodeSnapshot.id
            );
            setSelectedNodeSnapshot({ ...selectedNodeSnapshot });
            playSynthSfx('disconnect', settings);
            onGraphMutated();
            showToast('Cleared attached conveyor lines');
            drawNowRef.current?.();
          }}
          onDismantleNode={() => {
            const targetId = selectedNodeSnapshot.id;
            factoryHistory.pushSnapshot(
              nodesRef.current,
              connectionsRef.current,
              `Dismantle ${BUILDINGS[selectedNodeSnapshot.buildingId]?.name ?? 'Machine'}`
            );
            nodesRef.current = nodesRef.current.filter((n) => n.id !== targetId);
            connectionsRef.current = connectionsRef.current.filter(
              (c) => c.fromNodeId !== targetId && c.toNodeId !== targetId
            );
            setSelectedNodeId(null);
            playSynthSfx('disconnect', settings);
            onGraphMutated();
            showToast('Machine dismantled');
            drawNowRef.current?.();
          }}
        />
      )}

      {/* Selected Conveyor Belt Inspector Popover */}
      {mode === 'interactive' &&
        selectedConnectionSnapshot &&
        !selectedNodeSnapshot && (
          <BeltInspectorPanel
            connection={selectedConnectionSnapshot}
            nodes={nodesRef.current}
            settings={settings}
            onClose={() => setSelectedConnectionId(null)}
            onUpgradeBeltTier={(tier, shortLabel, capacityPerMin) => {
              factoryHistory.pushSnapshot(
                nodesRef.current,
                connectionsRef.current,
                `Upgrade Belt to ${shortLabel}`
              );
              connectionsRef.current = connectionsRef.current.map((c) =>
                c.id === selectedConnectionSnapshot.id
                  ? upgradeConveyorBeltTier(c, tier)
                  : c
              );
              const updated =
                connectionsRef.current.find(
                  (c) => c.id === selectedConnectionSnapshot.id
                ) ?? null;
              setSelectedConnectionSnapshot(
                updated
                  ? {
                      ...updated,
                      inFlightItems: updated.inFlightItems?.map((p) => ({
                        ...p,
                      })),
                    }
                  : null
              );
              playSynthSfx('place', settings);
              onGraphMutated();
              showToast(
                `Upgraded belt to ${shortLabel} (${capacityPerMin}/m)`
              );
              drawNowRef.current?.();
            }}
            onClearBeltItems={() => {
              factoryHistory.pushSnapshot(
                nodesRef.current,
                connectionsRef.current,
                'Clear Belt Items'
              );
              connectionsRef.current = connectionsRef.current.map((c) =>
                c.id === selectedConnectionSnapshot.id
                  ? { ...c, inFlightItems: [], isBackedUp: false }
                  : c
              );
              const updated =
                connectionsRef.current.find(
                  (c) => c.id === selectedConnectionSnapshot.id
                ) ?? null;
              setSelectedConnectionSnapshot(updated ? { ...updated } : null);
              playSynthSfx('click', settings);
              onGraphMutated();
              showToast('Cleared in-transit items from conveyor belt');
              drawNowRef.current?.();
            }}
            onResetWaypoints={() => {
              factoryHistory.pushSnapshot(
                nodesRef.current,
                connectionsRef.current,
                'Reset Conveyor Route'
              );
              connectionsRef.current = connectionsRef.current.map((c) =>
                c.id === selectedConnectionSnapshot.id
                  ? { ...c, waypoints: undefined }
                  : c
              );
              invalidateAllConveyorCaches();
              const updated =
                connectionsRef.current.find(
                  (c) => c.id === selectedConnectionSnapshot.id
                ) ?? null;
              setSelectedConnectionSnapshot(updated ? { ...updated } : null);
              playSynthSfx('click', settings);
              onGraphMutated();
              showToast('Reset belt route to default orthogonal path');
              drawNowRef.current?.();
            }}
            onDismantleBelt={() => {
              const targetId = selectedConnectionSnapshot.id;
              factoryHistory.pushSnapshot(
                nodesRef.current,
                connectionsRef.current,
                'Dismantle Conveyor Belt'
              );
              connectionsRef.current = connectionsRef.current.filter(
                (c) => c.id !== targetId
              );
              setSelectedConnectionId(null);
              playSynthSfx('disconnect', settings);
              onGraphMutated();
              showToast('Conveyor belt dismantled');
              drawNowRef.current?.();
            }}
          />
        )}

      {statusToast && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-lg bg-[#131B2E] border border-[#26334D] text-xs text-slate-200 shadow-lg pointer-events-none whitespace-nowrap">
          {statusToast}
        </div>
      )}
    </div>
  );
};
