/**
 * MODULE INDEX (`src/components/NodeCanvas.tsx`)
 * -----------------------------------------------------------------------------
 * 60 FPS interactive HTML5 Canvas controller for Sector 01: orchestrates the
 * 20 Hz simulation tick + 60 FPS render loop, history/selection reconciliation,
 * keyboard shortcuts (`Escape`, `Ctrl/Cmd+Z`, `Ctrl/Cmd+Y`), pointer handlers
 * (`canvasPointerDown.ts` & `canvasPointerMoveUp.ts`), and `<CanvasOverlays />`.
 *
 * Line Map:
 * - [L35–L125]  `NodeCanvasProps` & component state/refs initialization
 * - [L127–L225] Toast, selection snapshot sync, and `factoryHistory` reconciliation hooks
 * - [L227–L395] 60 FPS `requestAnimationFrame` simulation & rendering loop + `ResizeObserver`
 * - [L397–L495] Pointer event delegation, dismantle helpers, keyboard shortcuts, and JSX render
 */

import React, { useEffect, useRef, useState } from 'react';
import { playSynthSfx } from '../game/audio';
import { factoryHistory } from '../game/history';
import {
  clampCameraToWorld,
  invalidateAllConveyorCaches,
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
  hasBeltSnapshotChanged,
  hasInspectorSnapshotChanged,
} from './canvasHitTesting';
import { CanvasOverlays, CopiedMachineSettings } from './CanvasOverlays';
import {
  CanvasInteractionState,
  CanvasPointerContext,
  createInitialInteractionState,
  executeCanvasPointerDown,
} from './canvasPointerDown';
import {
  applyZoomAboutScreenPoint,
  executeCanvasPointerMove,
  executeCanvasPointerUpOrCancel,
  executeCanvasWheel,
} from './canvasPointerMoveUp';
import { renderFactoryScene } from './canvasRenderer';

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
  const [copiedMachineSettings, setCopiedMachineSettings] =
    useState<CopiedMachineSettings | null>(null);
  const drawNowRef = useRef<(() => void) | null>(null);

  const interactionRef = useRef<CanvasInteractionState>(
    createInitialInteractionState()
  );

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

      let ranSimStep = false;
      if (modeRef.current === 'interactive') {
        simAccumulatorSec = Math.min(simAccumulatorSec + frameDt, FIXED_SIM_DT * 3);
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
      } else {
        simAccumulatorSec = 0;
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

      if (
        modeRef.current === 'background' &&
        document.body.dataset.state === 'title'
      ) {
        cameraRef.current.x = -1820 + Math.sin(now * 0.00025) * 90;
        cameraRef.current.y = -1920 + Math.cos(now * 0.0002) * 35;
        cameraRef.current.zoom = 0.74;
      } else if (interactionRef.current.smoothZoomTarget !== null) {
        const curZ = cameraRef.current.zoom;
        const targetZ = interactionRef.current.smoothZoomTarget;
        const diff = targetZ - curZ;
        if (Math.abs(diff) < 0.002) {
          applyZoomAboutScreenPoint(
            cameraRef,
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
            cameraRef,
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

  const buildPointerContext = (): CanvasPointerContext | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return {
      canvas,
      nodesRef,
      connectionsRef,
      cameraRef,
      settingsRef,
      activeBeltTierRef,
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
      drawNow: () => drawNowRef.current?.(),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'interactive') return;
    const ctx = buildPointerContext();
    if (!ctx) return;
    executeCanvasPointerDown(e, ctx);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'interactive') return;
    const ctx = buildPointerContext();
    if (!ctx) return;
    executeCanvasPointerMove(e, ctx);
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'interactive') return;
    const ctx = buildPointerContext();
    if (!ctx) return;
    executeCanvasPointerUpOrCancel(e, ctx);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (mode !== 'interactive') return;
    const ctx = buildPointerContext();
    if (!ctx) return;
    executeCanvasWheel(e, ctx);
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
    invalidateAllConveyorCaches();
    const simResult = stepSimulation(nodesRef.current, connectionsRef.current, 0);
    nodesRef.current = simResult.nodes;
    connectionsRef.current = simResult.connections;
    setSelectedNodeIds([]);
    setSelectedNodeId(null);
    setSelectedNodeSnapshot(null);
    playSynthSfx('disconnect', settings);
    onGraphMutated();
    showToast(`Dismantled ${idsToRemove.size} building${idsToRemove.size > 1 ? 's' : ''}`);
    drawNowRef.current?.();
  };

  // Keyboard shortcuts for Undo/Redo, Escape cancel, and Tool switching
  useEffect(() => {
    if (mode !== 'interactive') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (pendingBuildRef.current) {
          onClearPendingBuild();
          return;
        }
        if (tapSourcePortRef.current) {
          setTapSourcePort(null);
          return;
        }
        if (selectedWaypointRef.current) {
          setSelectedWaypoint(null);
          return;
        }
        if (selectedNodeIdsRef.current.length > 0) {
          setSelectedNodeIds([]);
        }
        if (selectedNodeIdRef.current) {
          setSelectedNodeId(null);
        }
        if (selectedConnectionIdRef.current) {
          setSelectedConnectionId(null);
        }
        if (activeToolRef.current !== 'edit' && onSelectTool) {
          onSelectTool('edit');
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo?.();
        } else {
          onUndo?.();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        onRedo?.();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedWaypointRef.current) {
          dismantleSelectedWaypoint();
          return;
        }
        if (selectedNodeIdsRef.current.length > 1) {
          dismantleSelectedGroup();
          return;
        }
        if (selectedConnectionIdRef.current) {
          const targetConnId = selectedConnectionIdRef.current;
          factoryHistory.pushSnapshot(
            nodesRef.current,
            connectionsRef.current,
            'Dismantle Conveyor Belt'
          );
          connectionsRef.current = connectionsRef.current.filter(
            (c) => c.id !== targetConnId
          );
          invalidateAllConveyorCaches();
          const simResult = stepSimulation(
            nodesRef.current,
            connectionsRef.current,
            0
          );
          nodesRef.current = simResult.nodes;
          connectionsRef.current = simResult.connections;
          setSelectedConnectionId(null);
          playSynthSfx('disconnect', settingsRef.current);
          onGraphMutated();
          showToast('Conveyor belt dismantled');
          drawNowRef.current?.();
          return;
        }
        if (selectedNodeIdRef.current) {
          const targetId = selectedNodeIdRef.current;
          const targetNode = nodesRef.current.find((n) => n.id === targetId);
          if (
            targetNode &&
            targetNode.buildingId !== 'resource_deposit' &&
            !targetNode.isWorldDeposit
          ) {
            factoryHistory.pushSnapshot(
              nodesRef.current,
              connectionsRef.current,
              `Dismantle ${targetNode.title}`
            );
            nodesRef.current = nodesRef.current.filter((n) => n.id !== targetId);
            connectionsRef.current = connectionsRef.current.filter(
              (c) => c.fromNodeId !== targetId && c.toNodeId !== targetId
            );
            invalidateAllConveyorCaches();
            const simResult = stepSimulation(
              nodesRef.current,
              connectionsRef.current,
              0
            );
            nodesRef.current = simResult.nodes;
            connectionsRef.current = simResult.connections;
            setSelectedNodeId(null);
            setSelectedNodeIds([]);
            playSynthSfx('disconnect', settingsRef.current);
            onGraphMutated();
            showToast(`Dismantled ${targetNode.title}`);
            drawNowRef.current?.();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, onClearPendingBuild, onUndo, onRedo, onSelectTool]);

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

      <CanvasOverlays
        mode={mode}
        settings={settings}
        nodesRef={nodesRef}
        connectionsRef={connectionsRef}
        selectedWaypoint={selectedWaypoint}
        setSelectedWaypoint={setSelectedWaypoint}
        selectedNodeIds={selectedNodeIds}
        setSelectedNodeIds={setSelectedNodeIds}
        selectedNodeSnapshot={selectedNodeSnapshot}
        setSelectedNodeSnapshot={setSelectedNodeSnapshot}
        setSelectedNodeId={setSelectedNodeId}
        selectedConnectionSnapshot={selectedConnectionSnapshot}
        setSelectedConnectionSnapshot={setSelectedConnectionSnapshot}
        setSelectedConnectionId={setSelectedConnectionId}
        pendingBuildId={pendingBuildId}
        onClearPendingBuild={onClearPendingBuild}
        tapSourcePort={tapSourcePort}
        setTapSourcePort={setTapSourcePort}
        copiedMachineSettings={copiedMachineSettings}
        setCopiedMachineSettings={setCopiedMachineSettings}
        statusToast={statusToast}
        showToast={showToast}
        dismantleSelectedWaypoint={dismantleSelectedWaypoint}
        dismantleSelectedGroup={dismantleSelectedGroup}
        onGraphMutated={onGraphMutated}
        drawNow={() => drawNowRef.current?.()}
      />
    </div>
  );
};
