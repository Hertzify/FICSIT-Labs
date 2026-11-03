import React, { useEffect, useRef, useState } from 'react';
import {
  BUILDINGS,
  CONVEYOR_BELT_TIER_LIST,
  PURITY_CONFIG,
  RECIPES,
} from '../game/catalog';
import { playSynthSfx } from '../game/audio';
import {
  getBuildingIconUrl,
  getCanvasBuildingImage,
  getCanvasItemImage,
  getItemAccentColor,
  getItemIconUrl,
} from '../game/icons';
import {
  canConnectPorts,
  changeNodeRecipe,
  clampCameraToWorld,
  clampNodeToWorld,
  createConveyorConnection,
  createMachineNode,
  getBeltTierDef,
  isMacroIconZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  snapToGrid,
  stepSimulation,
  upgradeConveyorBeltTier,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../game/rules';
import {
  CameraState,
  ConveyorBeltTier,
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
  activeBeltTier: ConveyorBeltTier;
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

/**
 * Fallback vector icon if image is still decoding.
 */
function drawMachineVectorIcon(
  ctx: CanvasRenderingContext2D,
  buildingId: string,
  cx: number,
  cy: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.11);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const r = size * 0.5;

  switch (buildingId) {
    case 'the_hub': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.55, cy + r * 0.75);
      ctx.lineTo(cx, cy - r * 0.55);
      ctx.lineTo(cx + r * 0.55, cy + r * 0.75);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.55, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'resource_deposit': {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 3) * i - Math.PI / 6;
        const px = cx + Math.cos(ang) * r * 0.85;
        const py = cy + Math.sin(ang) * r * 0.85;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'miner_mk1': {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.65, cy - r * 0.65);
      ctx.lineTo(cx + r * 0.65, cy - r * 0.65);
      ctx.lineTo(cx + r * 0.35, cy + r * 0.1);
      ctx.lineTo(cx, cy + r * 0.8);
      ctx.lineTo(cx - r * 0.35, cy + r * 0.1);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'smelter': {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.82);
      ctx.bezierCurveTo(
        cx + r * 0.75,
        cy - r * 0.2,
        cx + r * 0.65,
        cy + r * 0.55,
        cx,
        cy + r * 0.82
      );
      ctx.bezierCurveTo(
        cx - r * 0.65,
        cy + r * 0.55,
        cx - r * 0.75,
        cy - r * 0.2,
        cx,
        cy - r * 0.82
      );
      ctx.closePath();
      ctx.stroke();
      break;
    }
    default: {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  ctx.restore();
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
    let timerId = 0;
    let lastTime = performance.now();

    const drawScene = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      if (width <= 0 || height <= 0) return;

      const cam = cameraRef.current;
      const cfg = settingsRef.current;
      const curSelectedId = selectedNodeIdRef.current;
      const curTapPort = tapSourcePortRef.current;
      const macroMode = isMacroIconZoom(cam.zoom);

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Out-of-Bounds Deep Void Fill
      ctx.fillStyle = '#06090F';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.scale(cam.zoom, cam.zoom);

      // 2. Bounded Sector 01 Playfield Surface ([0, 0] to [WORLD_WIDTH, WORLD_HEIGHT])
      ctx.fillStyle = '#0B0F17';
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      // Topographic Terrain Contours & Oasis Features (inspired by Rocky Desert map)
      ctx.save();
      ctx.strokeStyle = '#141E30';
      ctx.lineWidth = Math.max(1.5, 1.5 / cam.zoom);
      const ridgeCenters = [
        { x: 2300, y: 1100, rx: 620, ry: 420 },
        { x: 3650, y: 1450, rx: 850, ry: 520 },
        { x: 2700, y: 2950, rx: 920, ry: 600 },
        { x: 6400, y: 1380, rx: 880, ry: 540 },
        { x: 6150, y: 4080, rx: 780, ry: 480 },
        { x: 3250, y: 6050, rx: 940, ry: 560 },
        { x: 9300, y: 2250, rx: 860, ry: 540 },
        { x: 9600, y: 5300, rx: 1100, ry: 640 },
      ];
      for (const rc of ridgeCenters) {
        for (let ring = 1; ring <= 3; ring++) {
          ctx.beginPath();
          ctx.ellipse(
            rc.x,
            rc.y,
            rc.rx * (0.55 + ring * 0.28),
            rc.ry * (0.55 + ring * 0.28),
            0.18,
            0,
            Math.PI * 2
          );
          ctx.stroke();
        }
      }

      // Subtle Oasis Pond in West Rocky Desert (matching screenshot landmark)
      ctx.beginPath();
      ctx.ellipse(1380, 3360, 260, 145, -0.45, 0, Math.PI * 2);
      ctx.fillStyle = '#0D283A';
      ctx.fill();
      ctx.strokeStyle = '#1E4E68';
      ctx.lineWidth = Math.max(2, 2 / cam.zoom);
      ctx.stroke();
      ctx.restore();

      // Bounded Blueprint Coordinate Grid
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
      if (!macroMode && cam.zoom >= 0.42) {
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
      }

      if (cam.zoom >= 0.14) {
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
      }

      // Sector Perimeter Border
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = Math.max(2, 2.5 / cam.zoom);
      ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      ctx.font = `600 ${Math.max(12, Math.round(12 / Math.min(1, cam.zoom * 1.4)))}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(
        `SECTOR 01 BOUNDARY [0, 0 — ${WORLD_WIDTH} × ${WORLD_HEIGHT}] · 32 NATURAL RESOURCE DEPOSITS`,
        24,
        20
      );

      // 3. Render Conveyor Connections with Single-Digit Adaptive Speed, Density & Item Icons
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

        const tierDef = getBeltTierDef(conn.beltTier, conn.maxCapacityPerMin);
        const enteringRate = conn.sourceRatePerMin ?? conn.ratePerMin;
        const isFlowing = conn.ratePerMin > 0;
        const isInTransit = !conn.firstItemArrived && enteringRate > 0;
        const itemColor = getItemAccentColor(conn.itemName);
        const lengthPx = Math.max(72, conn.lengthPx ?? 240);

        // Outer Industrial Conveyor Track Rails (16px wide bed so 16x16 items sit snugly inside)
        drawConveyorPath(p1.x, p1.y, p2.x, p2.y, cfg.conveyorStyle);
        ctx.strokeStyle = tierDef.tier >= 2 ? tierDef.accentColor : '#334155';
        ctx.lineWidth = macroMode ? Math.max(6, 4.5 / cam.zoom) : 16;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Inner Dark Metallic Conveyor Roller Bed
        drawConveyorPath(p1.x, p1.y, p2.x, p2.y, cfg.conveyorStyle);
        ctx.strokeStyle = '#0B111E';
        ctx.lineWidth = macroMode ? Math.max(3, 2.2 / cam.zoom) : 12.5;
        ctx.stroke();

        // Moving Conveyor Roller Slats synchronized to exact belt m/s speed (tierDef.speedPxPerSec)
        if (!macroMode && (isFlowing || isInTransit)) {
          ctx.save();
          drawConveyorPath(p1.x, p1.y, p2.x, p2.y, cfg.conveyorStyle);
          ctx.strokeStyle = tierDef.tier >= 2 ? `${tierDef.accentColor}44` : '#1E293B';
          ctx.lineWidth = 10;
          ctx.setLineDash([3, 6]);
          ctx.lineDashOffset = -(interactionRef.current.elapsedTime * tierDef.speedPxPerSec);
          ctx.stroke();
          ctx.restore();
        }

        // Center Power/Guide Spine
        drawConveyorPath(p1.x, p1.y, p2.x, p2.y, cfg.conveyorStyle);
        ctx.strokeStyle = isFlowing
          ? `${itemColor}88`
          : isInTransit
          ? '#38BDF888'
          : '#334155';
        ctx.lineWidth = macroMode ? Math.max(3, 2.2 / cam.zoom) : 2;
        ctx.stroke();

        // Render Tightly Squeezed Physical Resource Items Traveling Along the Belt (`conn.inFlightItems`)
        // At 100% belt capacity (e.g. 60/m on Mk.1 at 1.2 m/s = 18 px/s), items are spaced every 18px
        // and each item is 15.5x15.5px so they sit tightly squeezed bumper-to-bumper along the belt.
        const packets = conn.inFlightItems ?? [];
        if (!macroMode && cam.zoom >= 0.35 && packets.length > 0) {
          const itemImg = getCanvasItemImage(conn.itemName);
          if (itemImg) {
            // Draw from source (back) to destination (front) so leading items layer cleanly
            for (let i = packets.length - 1; i >= 0; i--) {
              const pkt = packets[i];
              const rawRatio = Math.max(0, Math.min(1, pkt.distancePx / lengthPx));
              // Keep items inside the visible belt span between the two 7.5px port sockets
              const portMarginT = Math.min(0.12, 9 / lengthPx);
              const t = portMarginT + rawRatio * (1 - portMarginT * 2);
              const pt = sampleConveyorPoint(p1.x, p1.y, p2.x, p2.y, t, cfg.conveyorStyle);

              const boxSize = 15.5;
              const half = boxSize * 0.5;
              drawRoundedRect(ctx, pt.x - half, pt.y - half, boxSize, boxSize, 3.2);
              ctx.fillStyle = '#0F172A';
              ctx.fill();
              ctx.strokeStyle = tierDef.tier >= 2 ? tierDef.accentColor : itemColor;
              ctx.lineWidth = 1.3;
              ctx.stroke();
              ctx.drawImage(itemImg, pt.x - 6.8, pt.y - 6.8, 13.6, 13.6);
            }
          }
        }

        // Floating Belt Telemetry Badge (positioned ABOVE the belt so tightly squeezed items are 100% visible)
        if (!macroMode && cfg.showPortRates) {
          const mid = sampleConveyorPoint(p1.x, p1.y, p2.x, p2.y, 0.5, cfg.conveyorStyle);
          const leadingDist =
            packets.length > 0 ? Math.max(...packets.map((p) => p.distancePx)) : 0;
          const transitPct = Math.min(99, Math.round((leadingDist / lengthPx) * 100));

          const badgeText = isInTransit
            ? `${tierDef.shortLabel} · Transit ${transitPct}%`
            : `${tierDef.shortLabel} · ${conn.ratePerMin}/${tierDef.capacityPerMin}`;

          const badgeY = mid.y - 21;
          ctx.beginPath();
          ctx.moveTo(mid.x, mid.y - 8);
          ctx.lineTo(mid.x, badgeY + 8);
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.font = '600 9px "JetBrains Mono", monospace';
          const beltImg = getCanvasBuildingImage(tierDef.id);
          const iconPad = beltImg ? 14 : 0;
          const tw = ctx.measureText(badgeText).width + 10 + iconPad;
          drawRoundedRect(ctx, mid.x - tw / 2, badgeY - 8.5, tw, 17, 4);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
          ctx.fill();
          ctx.strokeStyle = isInTransit
            ? '#38BDF8'
            : tierDef.tier >= 2
            ? tierDef.accentColor
            : isFlowing
            ? itemColor
            : '#334155';
          ctx.lineWidth = 1.1;
          ctx.stroke();

          if (beltImg) {
            ctx.drawImage(beltImg, mid.x - tw / 2 + 3.5, badgeY - 6, 12, 12);
          }

          ctx.fillStyle = isInTransit
            ? '#38BDF8'
            : isFlowing
            ? '#F8FAFC'
            : '#94A3B8';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, mid.x + iconPad * 0.45, badgeY);
        }
      }

      if (interactionRef.current.wiringFrom) {
        const wf = interactionRef.current.wiringFrom;
        const activeTierDef = getBeltTierDef(activeBeltTierRef.current);
        drawConveyorPath(
          wf.x,
          wf.y,
          interactionRef.current.pointerWorldX,
          interactionRef.current.pointerWorldY,
          cfg.conveyorStyle
        );
        ctx.strokeStyle = activeTierDef.accentColor;
        ctx.lineWidth = 3 / Math.min(1, cam.zoom);
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 4. Render Machine Nodes & Natural World Resource Deposits
      for (const node of nodesRef.current) {
        const bDef = BUILDINGS[node.buildingId];
        const isDeposit = node.buildingId === 'resource_deposit';
        const purityKey = node.purity ?? 'normal';
        const purityInfo = PURITY_CONFIG[purityKey];
        const accent = isDeposit
          ? purityInfo.badgeColor
          : bDef?.accentColor ?? '#F59E0B';
        const isSelected = node.id === curSelectedId;
        const recipe = node.recipeId ? RECIPES[node.recipeId] : null;

        let statusColor = '#64748B';
        if (node.status === 'optimal') {
          statusColor = '#10B981';
        } else if (node.status === 'working') {
          statusColor = '#F59E0B';
        } else if (node.status === 'waiting') {
          statusColor = '#38BDF8';
        } else if (node.status === 'starved') {
          statusColor = '#EF4444';
        }

        const buildingImg = getCanvasBuildingImage(node.buildingId, node.recipeId);
        const primaryItemId =
          recipe?.outputs[0]?.itemId ??
          recipe?.outputs[0]?.itemName ??
          node.outputs[0]?.itemName ??
          node.inputs[0]?.itemName;
        const primaryItemImg = getCanvasItemImage(primaryItemId);

        if (macroMode) {
          // =========================================================================
          // MACRO ZOOM MODE (cam.zoom < 0.25)
          // Resource Deposits render as Circular Satisfactory Map Pins (Green/Orange/Red)
          // Player Machines render as Upload Labs Macro Icon Boxes
          // =========================================================================
          const cx = node.x + node.width * 0.5;
          const cy = node.y + node.height * 0.5;

          if (isDeposit) {
            const pinRadius = 116;
            const stemEndX = cx + pinRadius * 0.72;
            const stemEndY = cy + pinRadius * 1.28;

            // Diagonal Pin Stem + Small Ground Anchor Ring (matches Satisfactory interactive map)
            ctx.beginPath();
            ctx.moveTo(cx + pinRadius * 0.35, cy + pinRadius * 0.65);
            ctx.lineTo(stemEndX, stemEndY);
            ctx.strokeStyle = '#E2E8F0';
            ctx.lineWidth = Math.min(18, Math.max(4, 1.8 / cam.zoom));
            ctx.lineCap = 'round';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(stemEndX, stemEndY, pinRadius * 0.16, 0, Math.PI * 2);
            ctx.fillStyle = '#0B0F17';
            ctx.fill();
            ctx.strokeStyle = '#E2E8F0';
            ctx.lineWidth = Math.min(14, Math.max(3, 1.4 / cam.zoom));
            ctx.stroke();

            // Circular Map Pin Shadow
            ctx.beginPath();
            ctx.arc(cx + 6, cy + 10, pinRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.fill();

            // Circular Map Pin Filled with Purity Color (Green Pure / Orange Normal / Red Impure)
            ctx.beginPath();
            ctx.arc(cx, cy, pinRadius, 0, Math.PI * 2);
            ctx.fillStyle = purityInfo.badgeColor;
            ctx.fill();
            ctx.strokeStyle = isSelected ? '#FACC15' : '#F8FAFC';
            ctx.lineWidth = isSelected
              ? Math.min(28, Math.max(8, 3.2 / cam.zoom))
              : Math.min(20, Math.max(5, 2.1 / cam.zoom));
            ctx.stroke();

            // Official Satisfactory Ore Icon Centered Inside Pin
            const pinIcon = primaryItemImg ?? buildingImg;
            if (pinIcon) {
              const iconDim = pinRadius * 1.28;
              ctx.drawImage(
                pinIcon,
                cx - iconDim * 0.5,
                cy - iconDim * 0.5,
                iconDim,
                iconDim
              );
            } else {
              drawMachineVectorIcon(
                ctx,
                node.buildingId,
                cx,
                cy,
                pinRadius * 0.9,
                '#FFFFFF'
              );
            }
            continue;
          }

          // Upload Labs Macro Icon Box for Player-Built Machines
          drawRoundedRect(ctx, node.x + 4, node.y + 8, node.width, node.height, 16);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
          ctx.fill();

          drawRoundedRect(ctx, node.x, node.y, node.width, node.height, 16);
          ctx.fillStyle = '#111A2E';
          ctx.fill();

          drawRoundedRect(ctx, node.x, node.y, node.width, node.height, 16);
          ctx.strokeStyle = isSelected ? '#FFFFFF' : accent;
          ctx.lineWidth = isSelected ? Math.max(4, 3.2 / cam.zoom) : Math.max(2.6, 2.1 / cam.zoom);
          ctx.stroke();

          ctx.fillStyle = accent;
          ctx.fillRect(node.x + 18, node.y, node.width - 36, Math.max(5, 3 / cam.zoom));

          const medallionSize = Math.min(node.width, node.height) * 0.66;

          drawRoundedRect(
            ctx,
            cx - medallionSize * 0.5,
            cy - medallionSize * 0.5,
            medallionSize,
            medallionSize,
            14
          );
          ctx.fillStyle = '#0B0F17';
          ctx.fill();
          ctx.strokeStyle = accent;
          ctx.lineWidth = Math.max(2, 1.5 / cam.zoom);
          ctx.stroke();

          const macroImg = buildingImg ?? primaryItemImg;
          if (macroImg) {
            const imgSize = medallionSize * 0.78;
            ctx.drawImage(
              macroImg,
              cx - imgSize * 0.5,
              cy - imgSize * 0.5,
              imgSize,
              imgSize
            );
          } else {
            drawMachineVectorIcon(
              ctx,
              node.buildingId,
              cx,
              cy,
              medallionSize * 0.68,
              accent
            );
          }

          // Top-Right Status LED
          ctx.beginPath();
          ctx.arc(node.x + node.width - 22, node.y + 22, 9.5, 0, Math.PI * 2);
          ctx.fillStyle = statusColor;
          ctx.fill();
          ctx.strokeStyle = '#0B0F17';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          continue;
        }

        // =========================================================================
        // DETAILED UPLOAD LABS NODE CARD WINDOW (cam.zoom >= 0.25)
        // =========================================================================
        drawRoundedRect(ctx, node.x + 3, node.y + 6, node.width, node.height, 10);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
        ctx.fill();

        drawRoundedRect(ctx, node.x, node.y, node.width, node.height, 10);
        ctx.fillStyle = isDeposit ? '#0E1924' : '#131B2E';
        ctx.fill();

        drawRoundedRect(ctx, node.x, node.y, node.width, node.height, 10);
        ctx.strokeStyle = isSelected ? '#F59E0B' : isDeposit ? accent : '#26334D';
        ctx.lineWidth = isSelected ? 2.4 : isDeposit ? 1.6 : 1.2;
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
        ctx.fillStyle = isDeposit ? '#132433' : '#1A2540';
        ctx.fill();

        ctx.fillStyle = accent;
        ctx.fillRect(node.x + 10, node.y, node.width - 20, 2.5);
        ctx.restore();

        // Top-Left Official Satisfactory Wiki Building or Ore Icon
        if (buildingImg) {
          ctx.drawImage(buildingImg, node.x + 10, node.y + 8, 19, 19);
        } else {
          drawMachineVectorIcon(ctx, node.buildingId, node.x + 20, node.y + 18, 15, accent);
        }

        ctx.fillStyle = '#F8FAFC';
        ctx.font = '700 12.5px "Outfit", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.title, node.x + 34, node.y + 18);

        if (isDeposit) {
          // Purity Quality Pill on Natural World Deposit Header
          const pText = `${purityInfo.label} · ${purityInfo.ratePerMin}/m`;
          ctx.font = '700 9.5px "JetBrains Mono", monospace';
          ctx.fillStyle = purityInfo.badgeColor;
          ctx.textAlign = 'right';
          ctx.fillText(pText, node.x + node.width - 10, node.y + 18);
        } else {
          let statusText = 'IDLE';
          if (node.status === 'optimal') {
            statusText = `${node.efficiency}% OPTIMAL`;
          } else if (node.status === 'working') {
            statusText = `${node.efficiency}% ACTIVE`;
          } else if (node.status === 'waiting') {
            statusText = 'WAITING';
          } else if (node.status === 'starved') {
            statusText = 'STARVED';
          }

          ctx.font = '600 10px "JetBrains Mono", monospace';
          ctx.fillStyle = statusColor;
          ctx.textAlign = 'right';
          ctx.fillText(statusText, node.x + node.width - 12, node.y + 18);
        }

        const recipeTitle = isDeposit
          ? `${recipe?.outputs[0]?.itemName ?? 'Ore'} Vein (${purityInfo.multiplier}x Purity)`
          : recipe?.name ??
            (node.buildingId === 'the_hub'
              ? `Stored: ${Math.floor(node.storedCount)} Parts`
              : node.buildingId === 'storage_container'
              ? `Buffer: ${Math.floor(node.storedCount)} Items`
              : 'Logistics Pass-Through');

        if (primaryItemImg) {
          ctx.drawImage(primaryItemImg, node.x + 14, node.y + 40, 20, 20);
          ctx.font = '600 11.5px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = '#E2E8F0';
          ctx.textAlign = 'left';
          ctx.fillText(recipeTitle, node.x + 38, node.y + 50);
        } else {
          ctx.font = '500 11.5px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = '#CBD5E1';
          ctx.textAlign = 'left';
          ctx.fillText(recipeTitle, node.x + 14, node.y + 50);
        }

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
          isDeposit ||
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

        // Input Port Dots, Official Resource Icons & Stacked Rate Readouts
        for (let i = 0; i < node.inputs.length; i++) {
          const port = node.inputs[i];
          const pt = getPortWorldCoords(node, 'input', i, node.inputs.length);
          const isConnected = connectionsRef.current.some(
            (c) => c.toNodeId === node.id && c.toPortId === port.id
          );
          const portImg = getCanvasItemImage(port.itemName ?? port.label);

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

          let textOffsetX = pt.x + 12;
          if (portImg) {
            ctx.drawImage(portImg, pt.x + 11, pt.y - 7, 14, 14);
            textOffsetX = pt.x + 28;
          }

          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          if (cfg.showPortRates) {
            ctx.font = '600 10.5px "Plus Jakarta Sans", sans-serif';
            ctx.fillStyle = '#CBD5E1';
            ctx.fillText(port.label, textOffsetX, pt.y - 6);

            ctx.font = '600 9.5px "JetBrains Mono", monospace';
            ctx.fillStyle = '#38BDF8';
            ctx.fillText(
              `${port.actualRatePerMin}/${port.targetRatePerMin}/m`,
              textOffsetX,
              pt.y + 7
            );
          } else {
            ctx.font = '600 10.5px "Plus Jakarta Sans", sans-serif';
            ctx.fillStyle = '#CBD5E1';
            ctx.fillText(port.label, textOffsetX, pt.y);
          }
        }

        // Output Port Dots, Official Resource Icons & Stacked Rate Readouts
        for (let i = 0; i < node.outputs.length; i++) {
          const port = node.outputs[i];
          const pt = getPortWorldCoords(node, 'output', i, node.outputs.length);
          const isConnected = connectionsRef.current.some(
            (c) => c.fromNodeId === node.id && c.fromPortId === port.id
          );
          const isTapSelected =
            curTapPort?.nodeId === node.id && curTapPort?.portId === port.id;
          const portImg = getCanvasItemImage(port.itemName ?? port.label);

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

          let textRightX = pt.x - 12;
          if (portImg) {
            ctx.drawImage(portImg, pt.x - 25, pt.y - 7, 14, 14);
            textRightX = pt.x - 28;
          }

          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          if (cfg.showPortRates) {
            ctx.font = '600 10.5px "Plus Jakarta Sans", sans-serif';
            ctx.fillStyle = '#F8FAFC';
            ctx.fillText(port.label, textRightX, pt.y - 6);

            ctx.font = '600 9.5px "JetBrains Mono", monospace';
            ctx.fillStyle = '#FBBF24';
            ctx.fillText(`${port.actualRatePerMin}/m`, textRightX, pt.y + 7);
          } else {
            ctx.font = '600 10.5px "Plus Jakarta Sans", sans-serif';
            ctx.fillStyle = '#F8FAFC';
            ctx.fillText(port.label, textRightX, pt.y);
          }
        }
      }

      ctx.restore();
      ctx.restore();
    };

    drawNowRef.current = drawScene;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(canvas);

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

      interactionRef.current.elapsedTime += dt;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

      drawScene();
      scheduleNext();
    };

    animationFrameId = window.requestAnimationFrame(renderLoop);
    return () => {
      drawNowRef.current = null;
      window.clearTimeout(timerId);
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
    const macro = isMacroIconZoom(cameraRef.current.zoom);
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i];
      if (macro && n.buildingId === 'resource_deposit') {
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
        // Fixed natural deposit: select it, and allow panning the camera if dragged
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
    const factor = Math.exp(-e.deltaY * 0.0018);
    const nextTarget = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, baseZoom * factor));

    interactionRef.current.smoothZoomTarget = nextTarget;
    interactionRef.current.smoothZoomAnchorX = mx;
    interactionRef.current.smoothZoomAnchorY = my;
  };

  const selectedBuildingDef = selectedNodeSnapshot
    ? BUILDINGS[selectedNodeSnapshot.buildingId]
    : null;
  const isSelectedWorldDeposit =
    selectedNodeSnapshot?.buildingId === 'resource_deposit' ||
    Boolean(selectedNodeSnapshot?.isWorldDeposit);
  const selectedIconUrl = selectedNodeSnapshot
    ? getBuildingIconUrl(selectedNodeSnapshot.buildingId, selectedNodeSnapshot.recipeId)
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
      {mode === 'interactive' && selectedNodeSnapshot && selectedBuildingDef && (
        <div
          style={{ transform: `scale(${settings.uiScale})`, transformOrigin: 'bottom right' }}
          className="fixed bottom-3 right-3 z-20 w-76 max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl bg-[#131B2E] border border-[#26334D] shadow-2xl p-3"
        >
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#26334D]">
            <div className="flex items-center gap-2.5 min-w-0">
              {selectedIconUrl && (
                <img
                  src={selectedIconUrl}
                  alt={selectedNodeSnapshot.title}
                  className="w-8 h-8 rounded-lg bg-[#0B0F17] p-1 border border-[#26334D] object-contain shrink-0"
                />
              )}
              <div className="min-w-0">
                <h3 className="text-xs font-bold font-display text-white truncate">
                  {selectedNodeSnapshot.title}
                </h3>
                <p className="text-[11px] text-slate-400 truncate">
                  {selectedBuildingDef.subcategory}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close Node Inspector"
              onClick={() => setSelectedNodeId(null)}
              className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 shrink-0"
            >
              ✕
            </button>
          </div>

          {isSelectedWorldDeposit ? (
            <div className="mt-2.5 space-y-2">
              {(() => {
                const purityKey = selectedNodeSnapshot.purity ?? 'normal';
                const pCfg = PURITY_CONFIG[purityKey];
                const depRecipe = selectedNodeSnapshot.recipeId
                  ? RECIPES[selectedNodeSnapshot.recipeId]
                  : RECIPES.deposit_iron;
                const oreName = depRecipe?.outputs[0]?.itemName ?? 'Iron Ore';
                const oreIcon = getItemIconUrl(oreName);
                return (
                  <div className="p-2.5 rounded-xl bg-[#0B0F17] border border-[#26334D] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {oreIcon && (
                        <img
                          src={oreIcon}
                          alt={oreName}
                          className="w-7 h-7 object-contain shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {oreName} Vein
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Purity Modifier: {pCfg.multiplier}×
                        </div>
                      </div>
                    </div>
                    <span
                      className="px-2 py-1 rounded-md text-[10px] font-mono font-bold whitespace-nowrap shrink-0"
                      style={{
                        backgroundColor: `${pCfg.badgeColor}22`,
                        color: pCfg.badgeColor,
                        border: `1px solid ${pCfg.badgeColor}66`,
                      }}
                    >
                      {pCfg.label} · {pCfg.ratePerMin}/m
                    </span>
                  </div>
                );
              })()}
              <p className="text-[11px] text-slate-400 leading-snug">
                Fixed planetary deposit. Connect its output port to a{' '}
                <strong className="text-slate-200">Miner Mk.1</strong> to extract ore.
              </p>
            </div>
          ) : (
            selectedBuildingDef.availableRecipeIds.length > 0 && (
              <div className="mt-2">
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Active Machine Recipe
                </label>
                <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto pr-1">
                  {selectedBuildingDef.availableRecipeIds.map((rId) => {
                    const r = RECIPES[rId];
                    if (!r) return null;
                    const active = selectedNodeSnapshot.recipeId === rId;
                    const outItem = r.outputs[0];
                    const itemIcon = getItemIconUrl(outItem?.itemId ?? outItem?.itemName);
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
                          drawNowRef.current?.();
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                          active
                            ? 'bg-amber-500/20 border border-amber-500 text-amber-200'
                            : 'bg-[#0B0F17] border border-[#26334D] text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          {itemIcon && (
                            <img
                              src={itemIcon}
                              alt={r.name}
                              className="w-4 h-4 object-contain shrink-0"
                            />
                          )}
                          <span className="truncate">{r.name}</span>
                        </span>
                        <span className="font-mono tabular-nums text-[10px] text-slate-400 shrink-0 ml-2">
                          {outItem?.ratePerMin ?? 0}/m
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          )}

          {/* Connected Conveyor Belt Tier Upgrade Controls */}
          <div className="mt-2 pt-2 border-t border-[#26334D]">
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              Connected Belt Tier (Capacity & Speed)
            </label>
            <div className="grid grid-cols-3 gap-1">
              {CONVEYOR_BELT_TIER_LIST.map((bt) => {
                const attachedConns = connectionsRef.current.filter(
                  (c) =>
                    c.fromNodeId === selectedNodeSnapshot.id ||
                    c.toNodeId === selectedNodeSnapshot.id
                );
                const isCurrentTier =
                  attachedConns.length > 0 &&
                  attachedConns.every((c) => (c.beltTier ?? 1) === bt.tier);
                return (
                  <button
                    key={bt.id}
                    type="button"
                    onClick={() => {
                      let count = 0;
                      connectionsRef.current = connectionsRef.current.map((c) => {
                        if (
                          c.fromNodeId === selectedNodeSnapshot.id ||
                          c.toNodeId === selectedNodeSnapshot.id
                        ) {
                          count++;
                          return upgradeConveyorBeltTier(c, bt.tier);
                        }
                        return c;
                      });
                      playSynthSfx('click', settings);
                      onGraphMutated();
                      showToast(
                        count > 0
                          ? `Upgraded ${count} belt(s) to ${bt.shortLabel} (${bt.capacityPerMin}/m)`
                          : `Connect a belt first to upgrade to ${bt.shortLabel}`
                      );
                      drawNowRef.current?.();
                    }}
                    className={`px-1.5 py-1 rounded-lg text-[10px] font-mono font-semibold flex items-center justify-between ${
                      isCurrentTier
                        ? 'bg-amber-500/20 border border-amber-500 text-amber-200'
                        : 'bg-[#0B0F17] border border-[#26334D] text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span>{bt.shortLabel}</span>
                    <span className="text-[9px] text-slate-400">{bt.capacityPerMin}/m</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-[#26334D] flex items-center justify-between gap-2">
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
                drawNowRef.current?.();
              }}
              className="flex-1 min-h-[36px] px-2.5 py-1.5 rounded-lg bg-[#0B0F17] hover:bg-slate-800 border border-[#26334D] text-xs font-medium text-slate-300 whitespace-nowrap"
            >
              Unwire Belt
            </button>
            {!isSelectedWorldDeposit && (
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
                  drawNowRef.current?.();
                }}
                className="flex-1 min-h-[36px] px-2.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/70 border border-red-800/60 text-xs font-medium text-red-200 whitespace-nowrap"
              >
                Dismantle
              </button>
            )}
          </div>
        </div>
      )}

      {statusToast && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-lg bg-[#131B2E] border border-[#26334D] text-xs text-slate-200 shadow-lg pointer-events-none whitespace-nowrap">
          {statusToast}
        </div>
      )}
    </div>
  );
};
