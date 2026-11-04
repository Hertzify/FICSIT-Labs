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
  doesPathIntersectNode,
  getBeltTierDef,
  getCachedConveyorRoute,
  getPortWorldPosition,
  isMacroIconZoom,
  isNodePositionValid,
  MAX_ZOOM,
  MIN_ZOOM,
  SnapGuideline,
  stepSimulation,
  upgradeConveyorBeltTier,
  isMinerDirectlyOnDeposit,
} from '../game/rules';
import {
  CameraState,
  ConveyorBeltTier,
  ConveyorConnection,
  MachineNode,
  SettingsConfig,
} from '../game/types';
import { PortHit, renderFactoryScene } from './canvasRenderer';
import { NodeInspectorPanel } from './NodeInspectorPanel';

interface NodeCanvasProps {
  mode: 'background' | 'interactive';
  nodesRef: React.MutableRefObject<MachineNode[]>;
  connectionsRef: React.MutableRefObject<ConveyorConnection[]>;
  cameraRef: React.MutableRefObject<CameraState>;
  settings: SettingsConfig;
  activeBeltTier: ConveyorBeltTier;
  pendingBuildId: string | null;
  onClearPendingBuild: () => void;
  onGraphMutated: () => void;
}

/**
 * Checks if any visible property in the Node Inspector panel has changed since the last snapshot,
 * preventing 35 FPS React DOM re-renders when integer counts, rates, and status are unchanged.
 */
function hasInspectorSnapshotChanged(
  prev: MachineNode | null,
  next: MachineNode
): boolean {
  if (!prev) return true;
  if (
    prev.id !== next.id ||
    prev.buildingId !== next.buildingId ||
    prev.recipeId !== next.recipeId ||
    prev.status !== next.status ||
    prev.efficiency !== next.efficiency ||
    prev.maxStoredCount !== next.maxStoredCount ||
    Math.floor(prev.storedCount ?? 0) !== Math.floor(next.storedCount ?? 0) ||
    prev.inputs.length !== next.inputs.length ||
    prev.outputs.length !== next.outputs.length
  ) {
    return true;
  }

  for (let i = 0; i < next.inputs.length; i++) {
    const pA = prev.inputs[i];
    const pB = next.inputs[i];
    if (
      pA.actualRatePerMin !== pB.actualRatePerMin ||
      pA.targetRatePerMin !== pB.targetRatePerMin ||
      pA.itemName !== pB.itemName ||
      pA.label !== pB.label ||
      pA.maxBuffer !== pB.maxBuffer ||
      Math.floor(pA.bufferedCount ?? 0) !== Math.floor(pB.bufferedCount ?? 0)
    ) {
      return true;
    }
  }

  for (let i = 0; i < next.outputs.length; i++) {
    const pA = prev.outputs[i];
    const pB = next.outputs[i];
    if (
      pA.actualRatePerMin !== pB.actualRatePerMin ||
      pA.targetRatePerMin !== pB.targetRatePerMin ||
      pA.itemName !== pB.itemName ||
      pA.label !== pB.label ||
      pA.maxBuffer !== pB.maxBuffer ||
      Math.floor(pA.bufferedCount ?? 0) !== Math.floor(pB.bufferedCount ?? 0)
    ) {
      return true;
    }
  }

  return false;
}

export const NodeCanvas: React.FC<NodeCanvasProps> = ({
  mode,
  nodesRef,
  connectionsRef,
  cameraRef,
  settings,
  activeBeltTier,
  pendingBuildId,
  onClearPendingBuild,
  onGraphMutated,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const modeRef = useRef<'background' | 'interactive'>(mode);
  modeRef.current = mode;

  const settingsRef = useRef<SettingsConfig>(settings);
  settingsRef.current = settings;

  const activeBeltTierRef = useRef<ConveyorBeltTier>(activeBeltTier);
  activeBeltTierRef.current = activeBeltTier;

  const pendingBuildRef = useRef<string | null>(pendingBuildId);
  pendingBuildRef.current = pendingBuildId;

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNodeIdRef = useRef<string | null>(null);
  selectedNodeIdRef.current = selectedNodeId;

  const [selectedNodeSnapshot, setSelectedNodeSnapshot] = useState<MachineNode | null>(null);
  const selectedNodeSnapshotRef = useRef<MachineNode | null>(null);
  selectedNodeSnapshotRef.current = selectedNodeSnapshot;

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

  const findPortAtWorld = (wx: number, wy: number): PortHit | null => {
    const hitRadius = isMacroIconZoom(cameraRef.current.zoom) ? 24 : 18;
    for (let nIdx = nodesRef.current.length - 1; nIdx >= 0; nIdx--) {
      const node = nodesRef.current[nIdx];
      for (let i = 0; i < node.outputs.length; i++) {
        const pt = getPortWorldPosition(node, 'output', i, node.outputs.length);
        if (Math.hypot(wx - pt.x, wy - pt.y) <= hitRadius) {
          return { nodeId: node.id, port: node.outputs[i], x: pt.x, y: pt.y };
        }
      }
      for (let i = 0; i < node.inputs.length; i++) {
        const pt = getPortWorldPosition(node, 'input', i, node.inputs.length);
        if (Math.hypot(wx - pt.x, wy - pt.y) <= hitRadius) {
          return { nodeId: node.id, port: node.inputs[i], x: pt.x, y: pt.y };
        }
      }
    }
    return null;
  };

  const findNodeAtWorld = (wx: number, wy: number): MachineNode | null => {
    const macro = isMacroIconZoom(cameraRef.current.zoom);
    // Pass 1: Check non-deposit factory buildings first (so a Miner Mk.1 mounted on a deposit is always hit first!)
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i];
      if (n.buildingId === 'resource_deposit') continue;
      if (wx >= n.x && wx <= n.x + n.width && wy >= n.y && wy <= n.y + n.height) {
        return n;
      }
    }
    // Pass 2: Check natural ground resource deposits
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i];
      if (n.buildingId !== 'resource_deposit') continue;
      if (macro) {
        const cx = n.x + n.width * 0.5;
        const cy = n.y + n.height * 0.5;
        if (Math.hypot(wx - cx, wy - cy) <= 125) {
          return n;
        }
      }
      if (wx >= n.x && wx <= n.x + n.width && wy >= n.y && wy <= n.y + n.height) {
        return n;
      }
    }
    return null;
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

        // Belt overlap rule: machine cannot be placed directly across active conveyor paths
        const currentNodes = nodesRef.current;
        const blocksBelts = connectionsRef.current.some((c) => {
          const fn = currentNodes.find((n) => n.id === c.fromNodeId);
          const tn = currentNodes.find((n) => n.id === c.toNodeId);
          if (!fn || !tn) return false;
          const outIdx = fn.outputs.findIndex((p) => p.id === c.fromPortId);
          const inIdx = tn.inputs.findIndex((p) => p.id === c.toPortId);
          if (outIdx < 0 || inIdx < 0) return false;
          const route = getCachedConveyorRoute(fn, outIdx, tn, inIdx, currentNodes);
          return doesPathIntersectNode(route.pts, candidateNode as any, 16);
        });

        if (blocksBelts) {
          playSynthSfx('error', settingsRef.current);
          showToast('Cannot place: Conveyor line cuts through this position!');
          return;
        }

        const newNode = createMachineNode(bId, clamped.x, clamped.y);
        nodesRef.current = [...nodesRef.current, newNode];
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
    const portHit = findPortAtWorld(world.x, world.y);
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
          connectionsRef.current = connectionsRef.current.filter(
            (c) => c.id !== existingConn.id
          );
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
    const hitNode = findNodeAtWorld(world.x, world.y);
    if (hitNode) {
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

      interactionRef.current.draggingNodeId = hitNode.id;
      interactionRef.current.dragOffsetX = world.x - hitNode.x;
      interactionRef.current.dragOffsetY = world.y - hitNode.y;
      interactionRef.current.dragStartNodeX = hitNode.x;
      interactionRef.current.dragStartNodeY = hitNode.y;
      interactionRef.current.dragHasCollision = false;
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
    if (selectedNodeIdRef.current !== null) {
      setSelectedNodeId(null);
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

    if (interactionRef.current.wiringFrom) {
      interactionRef.current.pointerMoved = true;
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
        const check = isNodePositionValid(
          nodesRef.current,
          { ...targetNode, x: clamped.x, y: clamped.y },
          4
        );
        interactionRef.current.dragHasCollision = !check.valid;

        if (moved) {
          nodesRef.current = nodesRef.current.map((n) => {
            if (n.id !== nodeId) return n;
            return { ...n, x: clamped.x, y: clamped.y };
          });
        }
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

    if (interactionRef.current.wiringFrom) {
      const wf = interactionRef.current.wiringFrom;
      const targetPort = findPortAtWorld(world.x, world.y);
      if (targetPort && targetPort.port.side === 'input') {
        tryCreateConnection(wf.nodeId, wf.port.id, targetPort.nodeId, targetPort.port.id);
        setTapSourcePort(null);
      }
      interactionRef.current.wiringFrom = null;
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
        playSynthSfx('error', settingsRef.current);
        if (draggedNode?.buildingId === 'miner_mk1') {
          showToast('Miner Mk.1 must be positioned directly on top of an unoccupied Resource Deposit! (1 miner per deposit)');
        } else {
          showToast('Buildings cannot overlap! Returned to original position.');
        }
      } else {
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
          pendingBuildId ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
        }`}
      />

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

      {statusToast && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-lg bg-[#131B2E] border border-[#26334D] text-xs text-slate-200 shadow-lg pointer-events-none whitespace-nowrap">
          {statusToast}
        </div>
      )}
    </div>
  );
};
