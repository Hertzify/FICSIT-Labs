import React, { useEffect, useRef, useState } from 'react';
import { BUILDINGS, RECIPES } from '../game/catalog';
import { playSynthSfx } from '../game/audio';
import {
  canConnectPorts,
  changeNodeRecipe,
  clampCameraToWorld,
  clampNodeToWorld,
  createMachineNode,
  MAX_ZOOM,
  MIN_ZOOM,
  snapToGrid,
  stepSimulation,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../game/rules';
import {
  CameraState,
  ConveyorConnection,
  MachineNode,
  PortSocket,
  SettingsConfig,
} from '../game/types';

interface NodeCanvasProps {
  mode: 'background' | 'interactive';
  nodesRef: React.MutableRefObject<MachineNode[]>;
  connectionsRef: React.MutableRefObject<ConveyorConnection[]>;
  cameraRef: React.MutableRefObject<CameraState>;
  settings: SettingsConfig;
  pendingBuildId: string | null;
  onClearPendingBuild: () => void;
  onGraphMutated: () => void;
}

interface PortHit {
  nodeId: string;
  port: PortSocket;
  x: number;
  y: number;
}

function getPortWorldCoords(
  node: MachineNode,
  side: 'input' | 'output',
  index: number,
  total: number
): { x: number; y: number } {
  const topArea = 56;
  const bottomArea = node.height - 24;
  const usableHeight = Math.max(32, bottomArea - topArea);
  const step = usableHeight / (total + 1);
  const py = node.y + topArea + step * (index + 1);
  const px = side === 'input' ? node.x : node.x + node.width;
  return { x: px, y: py };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export const NodeCanvas: React.FC<NodeCanvasProps> = ({
  mode,
  nodesRef,
  connectionsRef,
  cameraRef,
  settings,
  pendingBuildId,
  onClearPendingBuild,
  onGraphMutated,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const settingsRef = useRef<SettingsConfig>(settings);
  settingsRef.current = settings;

  const pendingBuildRef = useRef<string | null>(pendingBuildId);
  pendingBuildRef.current = pendingBuildId;

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeSnapshot, setSelectedNodeSnapshot] = useState<MachineNode | null>(null);
  const [tapSourcePort, setTapSourcePort] = useState<{
    nodeId: string;
    portId: string;
    label: string;
  } | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const interactionRef = useRef<{
    isPanning: boolean;
    draggingNodeId: string | null;
    dragOffsetX: number;
    dragOffsetY: number;
    panStartX: number;
    panStartY: number;
    camStartX: number;
    camStartY: number;
    pointerMoved: boolean;
    wiringFrom: PortHit | null;
    pointerWorldX: number;
    pointerWorldY: number;
    pulsePhase: number;
    // Google Maps-style Pinch & Double-Tap Zoom state
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
    // Smooth animated zoom target (for wheel / double-tap glide)
    smoothZoomTarget: number | null;
    smoothZoomAnchorX: number;
    smoothZoomAnchorY: number;
  }>({
    isPanning: false,
    draggingNodeId: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    panStartX: 0,
    panStartY: 0,
    camStartX: 0,
    camStartY: 0,
    pointerMoved: false,
    wiringFrom: null,
    pointerWorldX: 0,
    pointerWorldY: 0,
    pulsePhase: 0,
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
  });

  const showToast = (msg: string) => {
    setStatusToast(msg);
  };

  useEffect(() => {
    if (!statusToast) return;
    const t = window.setTimeout(() => setStatusToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [statusToast]);

  useEffect(() => {
    if (!selectedNodeId) {
      setSelectedNodeSnapshot(null);
      return;
    }
    const found = nodesRef.current.find((n) => n.id === selectedNodeId) ?? null;
    setSelectedNodeSnapshot(found ? { ...found } : null);
  }, [selectedNodeId, nodesRef]);

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
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId = 0;
    let lastTime = performance.now();

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      if (mode === 'interactive') {
        cameraRef.current = clampCameraToWorld(
          cameraRef.current,
          rect.width,
          rect.height
        );
      }
    };

    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(canvas);

    let timerId = 0;
    const scheduleNext = () => {
      timerId = window.setTimeout(() => {
        animationFrameId = window.requestAnimationFrame(renderLoop);
      }, 28);
    };

    const renderLoop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      const simResult = stepSimulation(nodesRef.current, connectionsRef.current, dt);
      nodesRef.current = simResult.nodes;
      connectionsRef.current = simResult.connections;

      interactionRef.current.pulsePhase = (interactionRef.current.pulsePhase + dt * 0.85) % 1;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      // Ambient pan in background mode, or smooth Google Maps-like zoom interpolation in interactive mode
      if (mode === 'background') {
        cameraRef.current.x = 60 + Math.sin(now * 0.00025) * 90;
        cameraRef.current.y = 80 + Math.cos(now * 0.0002) * 35;
        cameraRef.current.zoom = 0.82;
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
          const stepZ = curZ + diff * Math.min(1, dt * 14);
          applyZoomAboutScreenPoint(
            stepZ,
            interactionRef.current.smoothZoomAnchorX,
            interactionRef.current.smoothZoomAnchorY,
            width,
            height
          );
        }
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Out-of-Bounds Deep Void Fill
      ctx.fillStyle = '#06090F';
      ctx.fillRect(0, 0, width, height);

      const cam = cameraRef.current;
      const cfg = settingsRef.current;

      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.scale(cam.zoom, cam.zoom);

      // 2. Bounded Sector 01 Playfield Surface ([0, 0] to [WORLD_WIDTH, WORLD_HEIGHT])
      ctx.fillStyle = '#0B0F17';
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      // Bounded Blueprint Coordinate Grid (strictly inside Sector Bounds)
      const gridStep = cfg.gridSize || 24;
      const majorStep = gridStep * 4;
      const startWorldX = Math.max(
        0,
        Math.floor(-cam.x / cam.zoom / majorStep) * majorStep
      );
      const endWorldX = Math.min(
        WORLD_WIDTH,
        startWorldX + width / cam.zoom + majorStep * 2
      );
      const startWorldY = Math.max(
        0,
        Math.floor(-cam.y / cam.zoom / majorStep) * majorStep
      );
      const endWorldY = Math.min(
        WORLD_HEIGHT,
        startWorldY + height / cam.zoom + majorStep * 2
      );

      ctx.lineWidth = 1 / cam.zoom;
      ctx.strokeStyle = '#131B2A';
      ctx.beginPath();
      for (let gx = startWorldX; gx <= endWorldX; gx += gridStep) {
        ctx.moveTo(gx, startWorldY);
        ctx.lineTo(gx, endWorldY);
      }
      for (let gy = startWorldY; gy <= endWorldY; gy += gridStep) {
        ctx.moveTo(startWorldX, gy);
        ctx.lineTo(endWorldX, gy);
      }
      ctx.stroke();

      ctx.strokeStyle = '#1B263B';
      ctx.beginPath();
      for (let gx = startWorldX; gx <= endWorldX; gx += majorStep) {
        ctx.moveTo(gx, startWorldY);
        ctx.lineTo(gx, endWorldY);
      }
      for (let gy = startWorldY; gy <= endWorldY; gy += majorStep) {
        ctx.moveTo(startWorldX, gy);
        ctx.lineTo(endWorldX, gy);
      }
      ctx.stroke();

      // Sector Perimeter Border & Corner Telemetry Markers
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2 / cam.zoom;
      ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      ctx.font = '600 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(
        `SECTOR 01 BOUNDARY [0, 0 — ${WORLD_WIDTH} × ${WORLD_HEIGHT}] · EXPANDABLE`,
        16,
        14
      );

      // 3. Render Conveyor Connections (Curved Bezier vs 90-Degree Orthogonal)
      const nodeById = new Map<string, MachineNode>();
      for (const n of nodesRef.current) {
        nodeById.set(n.id, n);
      }

      const drawConveyorPath = (
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        style: 'bezier' | 'orthogonal'
      ) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        if (style === 'orthogonal') {
          const midX = x1 + (x2 - x1) * 0.5;
          ctx.lineTo(midX, y1);
          ctx.lineTo(midX, y2);
          ctx.lineTo(x2, y2);
        } else {
          const dx = Math.max(60, Math.abs(x2 - x1) * 0.48);
          ctx.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2, y2);
        }
      };

      const sampleConveyorPoint = (
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        t: number,
        style: 'bezier' | 'orthogonal'
      ): { x: number; y: number } => {
        if (style === 'orthogonal') {
          const midX = x1 + (x2 - x1) * 0.5;
          const seg1 = Math.abs(midX - x1);
          const seg2 = Math.abs(y2 - y1);
          const seg3 = Math.abs(x2 - midX);
          const total = Math.max(1, seg1 + seg2 + seg3);
          const dist = t * total;
          if (dist <= seg1) {
            const localT = seg1 > 0 ? dist / seg1 : 0;
            return { x: x1 + (midX - x1) * localT, y: y1 };
          } else if (dist <= seg1 + seg2) {
            const localT = seg2 > 0 ? (dist - seg1) / seg2 : 0;
            return { x: midX, y: y1 + (y2 - y1) * localT };
          } else {
            const localT = seg3 > 0 ? (dist - seg1 - seg2) / seg3 : 0;
            return { x: midX + (x2 - midX) * localT, y: y2 };
          }
        } else {
          const dx = Math.max(60, Math.abs(x2 - x1) * 0.48);
          const cx1 = x1 + dx;
          const cy1 = y1;
          const cx2 = x2 - dx;
          const cy2 = y2;
          const u = 1 - t;
          const tt = t * t;
          const uu = u * u;
          const uuu = uu * u;
          const ttt = tt * t;
          return {
            x: uuu * x1 + 3 * uu * t * cx1 + 3 * u * tt * cx2 + ttt * x2,
            y: uuu * y1 + 3 * uu * t * cy1 + 3 * u * tt * cy2 + ttt * y2,
          };
        }
      };

      for (const conn of connectionsRef.current) {
        const fromNode = nodeById.get(conn.fromNodeId);
        const toNode = nodeById.get(conn.toNodeId);
        if (!fromNode || !toNode) continue;

        const outIdx = fromNode.outputs.findIndex((p) => p.id === conn.fromPortId);
        const inIdx = toNode.inputs.findIndex((p) => p.id === conn.toPortId);
        if (outIdx < 0 || inIdx < 0) continue;

        const p1 = getPortWorldCoords(fromNode, 'output', outIdx, fromNode.outputs.length);
        const p2 = getPortWorldCoords(toNode, 'input', inIdx, toNode.inputs.length);

        const isFlowing = conn.ratePerMin > 0;

        drawConveyorPath(p1.x, p1.y, p2.x, p2.y, cfg.conveyorStyle);
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        drawConveyorPath(p1.x, p1.y, p2.x, p2.y, cfg.conveyorStyle);
        ctx.strokeStyle = isFlowing ? '#F59E0B' : '#475569';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        if (isFlowing) {
          const pulseCount = 4;
          for (let i = 0; i < pulseCount; i++) {
            const t = (interactionRef.current.pulsePhase + i / pulseCount) % 1;
            const pt = sampleConveyorPoint(p1.x, p1.y, p2.x, p2.y, t, cfg.conveyorStyle);
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#FEF3C7';
            ctx.fill();
            ctx.strokeStyle = '#D97706';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }

        if (cfg.showPortRates && conn.itemName) {
          const mid = sampleConveyorPoint(p1.x, p1.y, p2.x, p2.y, 0.5, cfg.conveyorStyle);
          const badgeText = `${conn.ratePerMin}/m`;
          ctx.font = '600 10px "JetBrains Mono", monospace';
          const tw = ctx.measureText(badgeText).width + 12;
          drawRoundedRect(ctx, mid.x - tw / 2, mid.y - 9, tw, 18, 4);
          ctx.fillStyle = '#0F172A';
          ctx.fill();
          ctx.strokeStyle = isFlowing ? '#F59E0B' : '#334155';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = isFlowing ? '#FDE68A' : '#94A3B8';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, mid.x, mid.y);
        }
      }

      if (interactionRef.current.wiringFrom) {
        const wf = interactionRef.current.wiringFrom;
        drawConveyorPath(
          wf.x,
          wf.y,
          interactionRef.current.pointerWorldX,
          interactionRef.current.pointerWorldY,
          cfg.conveyorStyle
        );
        ctx.strokeStyle = '#06B6D4';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 4. Render Upload Labs-Style Machine Node Cards
      for (const node of nodesRef.current) {
        const bDef = BUILDINGS[node.buildingId];
        const accent = bDef?.accentColor ?? '#F59E0B';
        const isSelected = node.id === selectedNodeId;
        const recipe = node.recipeId ? RECIPES[node.recipeId] : null;

        drawRoundedRect(ctx, node.x + 3, node.y + 6, node.width, node.height, 10);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
        ctx.fill();

        drawRoundedRect(ctx, node.x, node.y, node.width, node.height, 10);
        ctx.fillStyle = '#131B2E';
        ctx.fill();

        drawRoundedRect(ctx, node.x, node.y, node.width, node.height, 10);
        ctx.strokeStyle = isSelected ? '#F59E0B' : '#26334D';
        ctx.lineWidth = isSelected ? 2.2 : 1.2;
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(node.x + 10, node.y);
        ctx.lineTo(node.x + node.width - 10, node.y);
        ctx.quadraticCurveTo(node.x + node.width, node.y, node.x + node.width, node.y + 10);
        ctx.lineTo(node.x + node.width, node.y + 34);
        ctx.lineTo(node.x, node.y + 34);
        ctx.lineTo(node.x, node.y + 10);
        ctx.quadraticCurveTo(node.x, node.y, node.x + 10, node.y);
        ctx.closePath();
        ctx.fillStyle = '#1A2540';
        ctx.fill();

        ctx.fillStyle = accent;
        ctx.fillRect(node.x + 10, node.y, node.width - 20, 2.5);
        ctx.restore();

        ctx.fillStyle = '#F8FAFC';
        ctx.font = '700 13px "Outfit", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.title, node.x + 12, node.y + 18);

        let statusText = 'IDLE';
        let statusColor = '#64748B';
        if (node.status === 'optimal') {
          statusText = `${node.efficiency}% OPTIMAL`;
          statusColor = '#10B981';
        } else if (node.status === 'working') {
          statusText = `${node.efficiency}% ACTIVE`;
          statusColor = '#F59E0B';
        } else if (node.status === 'starved') {
          statusText = 'STARVED';
          statusColor = '#EF4444';
        }

        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.fillStyle = statusColor;
        ctx.textAlign = 'right';
        ctx.fillText(statusText, node.x + node.width - 12, node.y + 18);

        const recipeTitle =
          recipe?.name ??
          (node.buildingId === 'the_hub'
            ? `Stored: ${Math.floor(node.storedCount)} Parts`
            : node.buildingId === 'storage_container'
            ? `Buffer: ${Math.floor(node.storedCount)} Items`
            : 'Logistics Pass-Through');

        ctx.font = '500 11.5px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#CBD5E1';
        ctx.textAlign = 'left';
        ctx.fillText(recipeTitle, node.x + 14, node.y + 50);

        const barX = node.x + 14;
        const barY = node.y + node.height - 20;
        const barW = node.width - 28;
        const barH = 7;

        drawRoundedRect(ctx, barX, barY, barW, barH, 3.5);
        ctx.fillStyle = '#0B0F17';
        ctx.fill();
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 1;
        ctx.stroke();

        const fillRatio =
          node.buildingId === 'splitter' ||
          node.buildingId === 'merger' ||
          node.buildingId === 'storage_container' ||
          node.buildingId === 'the_hub'
            ? node.efficiency > 0
              ? 1
              : 0
            : Math.max(0, Math.min(1, node.progress));

        if (fillRatio > 0.01) {
          drawRoundedRect(ctx, barX, barY, Math.max(6, barW * fillRatio), barH, 3.5);
          ctx.fillStyle = accent;
          ctx.fill();
        }

        // Input Port Dots & Stacked Rate Readouts
        for (let i = 0; i < node.inputs.length; i++) {
          const port = node.inputs[i];
          const pt = getPortWorldCoords(node, 'input', i, node.inputs.length);
          const isConnected = connectionsRef.current.some(
            (c) => c.toNodeId === node.id && c.toPortId === port.id
          );

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 7.5, 0, Math.PI * 2);
          ctx.fillStyle = isConnected ? '#06B6D4' : '#0B0F17';
          ctx.fill();
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = isConnected ? '#FFFFFF' : '#38BDF8';
          ctx.fill();

          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          if (cfg.showPortRates) {
            ctx.font = '600 10.5px "Plus Jakarta Sans", sans-serif';
            ctx.fillStyle = '#CBD5E1';
            ctx.fillText(port.label, pt.x + 13, pt.y - 6);

            ctx.font = '600 9.5px "JetBrains Mono", monospace';
            ctx.fillStyle = '#38BDF8';
            ctx.fillText(
              `${port.actualRatePerMin}/${port.targetRatePerMin}/m`,
              pt.x + 13,
              pt.y + 7
            );
          } else {
            ctx.font = '600 10.5px "Plus Jakarta Sans", sans-serif';
            ctx.fillStyle = '#CBD5E1';
            ctx.fillText(port.label, pt.x + 13, pt.y);
          }
        }

        // Output Port Dots & Stacked Rate Readouts
        for (let i = 0; i < node.outputs.length; i++) {
          const port = node.outputs[i];
          const pt = getPortWorldCoords(node, 'output', i, node.outputs.length);
          const isConnected = connectionsRef.current.some(
            (c) => c.fromNodeId === node.id && c.fromPortId === port.id
          );
          const isTapSelected =
            tapSourcePort?.nodeId === node.id && tapSourcePort?.portId === port.id;

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, isTapSelected ? 9.5 : 7.5, 0, Math.PI * 2);
          ctx.fillStyle = isTapSelected
            ? '#F59E0B'
            : isConnected
            ? '#F59E0B'
            : '#0B0F17';
          ctx.fill();
          ctx.strokeStyle = '#FBBF24';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = isConnected || isTapSelected ? '#0B0F17' : '#FBBF24';
          ctx.fill();

          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          if (cfg.showPortRates) {
            ctx.font = '600 10.5px "Plus Jakarta Sans", sans-serif';
            ctx.fillStyle = '#F8FAFC';
            ctx.fillText(port.label, pt.x - 13, pt.y - 6);

            ctx.font = '600 9.5px "JetBrains Mono", monospace';
            ctx.fillStyle = '#FBBF24';
            ctx.fillText(`${port.actualRatePerMin}/m`, pt.x - 13, pt.y + 7);
          } else {
            ctx.font = '600 10.5px "Plus Jakarta Sans", sans-serif';
            ctx.fillStyle = '#F8FAFC';
            ctx.fillText(port.label, pt.x - 13, pt.y);
          }
        }
      }

      ctx.restore();
      ctx.restore();

      scheduleNext();
    };

    animationFrameId = window.requestAnimationFrame(renderLoop);
    return () => {
      window.clearTimeout(timerId);
      window.cancelAnimationFrame(animationFrameId);
      ro.disconnect();
    };
  }, [mode, nodesRef, connectionsRef, cameraRef, selectedNodeId, tapSourcePort]);

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
    const hitRadius = 18;
    for (let nIdx = nodesRef.current.length - 1; nIdx >= 0; nIdx--) {
      const node = nodesRef.current[nIdx];
      for (let i = 0; i < node.outputs.length; i++) {
        const pt = getPortWorldCoords(node, 'output', i, node.outputs.length);
        if (Math.hypot(wx - pt.x, wy - pt.y) <= hitRadius) {
          return { nodeId: node.id, port: node.outputs[i], x: pt.x, y: pt.y };
        }
      }
      for (let i = 0; i < node.inputs.length; i++) {
        const pt = getPortWorldCoords(node, 'input', i, node.inputs.length);
        if (Math.hypot(wx - pt.x, wy - pt.y) <= hitRadius) {
          return { nodeId: node.id, port: node.inputs[i], x: pt.x, y: pt.y };
        }
      }
    }
    return null;
  };

  const findNodeAtWorld = (wx: number, wy: number): MachineNode | null => {
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i];
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

    const newConn: ConveyorConnection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fromNodeId,
      fromPortId,
      toNodeId,
      toPortId,
      itemName: null,
      ratePerMin: 0,
      maxCapacityPerMin: 60,
    };
    connectionsRef.current = [...connectionsRef.current, newConn];
    playSynthSfx('connect', settingsRef.current);
    onGraphMutated();
    showToast('Conveyor line connected');
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

    // Google Maps 2-Finger Pinch-to-Zoom Initiation
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

    // 1. Place Pending Building from Build Menu (clamped to Sector Bounds)
    if (pendingBuildRef.current) {
      const bId = pendingBuildRef.current;
      const bDef = BUILDINGS[bId];
      if (bDef) {
        const rawX = snapToGrid(
          world.x - bDef.width / 2,
          settingsRef.current.gridSize,
          settingsRef.current.gridSnap
        );
        const rawY = snapToGrid(
          world.y - bDef.height / 2,
          settingsRef.current.gridSize,
          settingsRef.current.gridSnap
        );
        const clamped = clampNodeToWorld(rawX, rawY, bDef.width, bDef.height);
        const newNode = createMachineNode(bId, clamped.x, clamped.y);
        nodesRef.current = [...nodesRef.current, newNode];
        playSynthSfx('place', settingsRef.current);
        onClearPendingBuild();
        onGraphMutated();
        setSelectedNodeId(newNode.id);
        showToast(`Placed ${bDef.name}`);
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

    // 3. Node Card Body Drag / Select
    const hitNode = findNodeAtWorld(world.x, world.y);
    if (hitNode) {
      interactionRef.current.draggingNodeId = hitNode.id;
      interactionRef.current.dragOffsetX = world.x - hitNode.x;
      interactionRef.current.dragOffsetY = world.y - hitNode.y;
      setSelectedNodeId(hitNode.id);
      setSelectedNodeSnapshot({ ...hitNode });
      return;
    }

    // 4. Empty Canvas: Check for Google Maps Double-Tap / Double-Tap-Hold-Drag Zoom!
    const now = performance.now();
    const dtTap = now - interactionRef.current.lastTapTime;
    const tapDist = Math.hypot(
      sx - interactionRef.current.lastTapX,
      sy - interactionRef.current.lastTapY
    );

    if (dtTap < 320 && tapDist < 36) {
      // Enter Google Maps one-finger Double-Tap + Vertical Drag Zoom mode
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
    setSelectedNodeId(null);
    setTapSourcePort(null);
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

    // 1. Google Maps 2-Finger Pinch-to-Zoom + Simultaneous Midpoint Pan
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

      // Anchor zoom at previous pinch midpoint and translate by midpoint movement
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
      return;
    }

    // 2. Google Maps 1-Finger Double-Tap + Hold Vertical Drag Zoom
    if (interactionRef.current.isDoubleTapZooming) {
      const dy = sy - interactionRef.current.doubleTapStartY;
      if (Math.abs(dy) > 4) {
        interactionRef.current.pointerMoved = true;
      }
      // Dragging down zooms IN, dragging up zooms OUT (Google Maps convention)
      const zoomFactor = Math.pow(1.006, dy);
      const nextZoom = interactionRef.current.doubleTapStartZoom * zoomFactor;
      applyZoomAboutScreenPoint(
        nextZoom,
        interactionRef.current.doubleTapAnchorX,
        interactionRef.current.doubleTapAnchorY,
        rect.width,
        rect.height
      );
      return;
    }

    const world = screenToWorld(e.clientX, e.clientY);
    interactionRef.current.pointerWorldX = world.x;
    interactionRef.current.pointerWorldY = world.y;

    if (interactionRef.current.wiringFrom) {
      interactionRef.current.pointerMoved = true;
      return;
    }

    if (interactionRef.current.draggingNodeId) {
      interactionRef.current.pointerMoved = true;
      const nodeId = interactionRef.current.draggingNodeId;
      const rawX = world.x - interactionRef.current.dragOffsetX;
      const rawY = world.y - interactionRef.current.dragOffsetY;
      const snappedX = snapToGrid(
        rawX,
        settingsRef.current.gridSize,
        settingsRef.current.gridSnap
      );
      const snappedY = snapToGrid(
        rawY,
        settingsRef.current.gridSize,
        settingsRef.current.gridSnap
      );

      nodesRef.current = nodesRef.current.map((n) => {
        if (n.id !== nodeId) return n;
        const clamped = clampNodeToWorld(snappedX, snappedY, n.width, n.height);
        return { ...n, x: clamped.x, y: clamped.y };
      });
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

    // If user double-tapped without dragging vertically, smoothly zoom in 1.35x toward tap point
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
    }

    if (interactionRef.current.draggingNodeId && interactionRef.current.pointerMoved) {
      onGraphMutated();
    }

    interactionRef.current.draggingNodeId = null;
    interactionRef.current.isPanning = false;
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
    const factor = Math.exp(-e.deltaY * 0.0016);
    const nextTarget = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, baseZoom * factor));

    interactionRef.current.smoothZoomTarget = nextTarget;
    interactionRef.current.smoothZoomAnchorX = mx;
    interactionRef.current.smoothZoomAnchorY = my;
  };

  const selectedBuildingDef = selectedNodeSnapshot
    ? BUILDINGS[selectedNodeSnapshot.buildingId]
    : null;

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
          className="fixed top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#131B2E] border border-amber-500/60 shadow-xl"
        >
          <span className="text-xs font-medium text-amber-300 whitespace-nowrap">
            Tap anywhere inside Sector 01 to place{' '}
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
          className="fixed top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2 rounded-xl bg-[#131B2E] border border-cyan-500/60 shadow-xl"
        >
          <span className="text-xs text-cyan-200 whitespace-nowrap">
            Wiring Output ({tapSourcePort.label}) · Tap any Left Input Port to connect
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

      {/* Selected Machine Node Recipe & Action Popover */}
      {mode === 'interactive' && selectedNodeSnapshot && selectedBuildingDef && (
        <div
          style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'bottom right' }}
          className="fixed bottom-4 right-4 z-20 w-80 rounded-2xl bg-[#131B2E] border border-[#26334D] shadow-2xl p-4"
        >
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#26334D]">
            <div>
              <h3 className="text-sm font-bold font-display text-white">
                {selectedNodeSnapshot.title}
              </h3>
              <p className="text-xs text-slate-400">{selectedBuildingDef.subcategory}</p>
            </div>
            <button
              type="button"
              aria-label="Close Node Inspector"
              onClick={() => setSelectedNodeId(null)}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70"
            >
              ✕
            </button>
          </div>

          {selectedBuildingDef.availableRecipeIds.length > 0 && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Active Machine Recipe
              </label>
              <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1">
                {selectedBuildingDef.availableRecipeIds.map((rId) => {
                  const r = RECIPES[rId];
                  if (!r) return null;
                  const active = selectedNodeSnapshot.recipeId === rId;
                  return (
                    <button
                      key={rId}
                      type="button"
                      onClick={() => {
                        nodesRef.current = nodesRef.current.map((n) =>
                          n.id === selectedNodeSnapshot.id ? changeNodeRecipe(n, rId) : n
                        );
                        const updated =
                          nodesRef.current.find((n) => n.id === selectedNodeSnapshot.id) ??
                          null;
                        setSelectedNodeSnapshot(updated ? { ...updated } : null);
                        playSynthSfx('click', settings);
                        onGraphMutated();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        active
                          ? 'bg-amber-500/20 border border-amber-500 text-amber-200'
                          : 'bg-[#0B0F17] border border-[#26334D] text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span className="truncate">{r.name}</span>
                      <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0 ml-2">
                        {r.outputs[0]?.ratePerMin ?? 0}/m
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-[#26334D] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                connectionsRef.current = connectionsRef.current.filter(
                  (c) =>
                    c.fromNodeId !== selectedNodeSnapshot.id &&
                    c.toNodeId !== selectedNodeSnapshot.id
                );
                playSynthSfx('disconnect', settings);
                onGraphMutated();
                showToast('Cleared attached conveyor lines');
              }}
              className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-[#0B0F17] hover:bg-slate-800 border border-[#26334D] text-xs font-medium text-slate-300 whitespace-nowrap"
            >
              Unwire Ports
            </button>
            <button
              type="button"
              onClick={() => {
                const targetId = selectedNodeSnapshot.id;
                nodesRef.current = nodesRef.current.filter((n) => n.id !== targetId);
                connectionsRef.current = connectionsRef.current.filter(
                  (c) => c.fromNodeId !== targetId && c.toNodeId !== targetId
                );
                setSelectedNodeId(null);
                playSynthSfx('disconnect', settings);
                onGraphMutated();
                showToast('Machine dismantled');
              }}
              className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-red-950/60 hover:bg-red-900/70 border border-red-800/60 text-xs font-medium text-red-200 whitespace-nowrap"
            >
              Dismantle
            </button>
          </div>
        </div>
      )}

      {statusToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg bg-[#131B2E] border border-[#26334D] text-xs text-slate-200 shadow-lg pointer-events-none whitespace-nowrap">
          {statusToast}
        </div>
      )}
    </div>
  );
};
