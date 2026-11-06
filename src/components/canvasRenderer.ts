/**
 * ============================================================================
 * MODULE INDEX: Factory Scene & Conveyor Belt Renderer (`src/components/canvasRenderer.ts`)
 * ============================================================================
 * [Lines 055-093] CanvasRenderParams & Viewport Culling Constants
 * [Lines 095-260] renderFactoryScene Setup, Topographic Terrain & Blueprint Grid
 * [Lines 262-478] Conveyor Belts, Roller Slats, Discrete Item Packets & Overpass Bridges
 * [Lines 480-599] Live Wiring Preview & Waypoint Corner Handles
 * [Lines 601-620] Machine Nodes & Deposits Delegation (`renderMachineNodesAndDeposits`)
 * [Lines 622-718] Floating Belt Telemetry Badges (Top Layer)
 * [Lines 720-885] Ghost Building Hologram, Snap Alignment Lasers & Marquee Box
 * ============================================================================
 */

import {
  BUILDINGS,
  formatDualRatePerMin,
} from '../game/catalog';
import {
  getCanvasBuildingImage,
  getCanvasItemImage,
  getItemAccentColor,
} from '../game/icons';
import {
  CachedConveyorRoute,
  clampNodeToWorld,
  computeFilletedConveyorPath,
  computeNodeSnapAlignment,
  computeOrthogonalConveyorPath,
  ConveyorCrossing,
  findConveyorCrossings,
  getBeltTierDef,
  getCachedConveyorRoute,
  getPortWorldPosition,
  isMacroIconZoom,
  isNodePositionValid,
  sampleFilletedPath,
  sampleOrthogonalPath,
  SnapGuideline,
  WORLD_HEIGHT,
  WORLD_WIDTH,
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
  drawRoundedRect,
  TOPOGRAPHIC_RIDGE_CENTERS,
} from './canvasArtwork';
import {
  doesCandidateNodeOverlapBeltsOrDots,
  PortHit,
} from './canvasHitTesting';
import { renderMachineNodesAndDeposits } from './canvasNodeRenderer';

export type { PortHit };

export interface CanvasRenderParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  cam: CameraState;
  cfg: SettingsConfig;
  nodes: MachineNode[];
  connections: ConveyorConnection[];
  selectedNodeId: string | null;
  selectedConnectionId?: string | null;
  hoveredConnectionId?: string | null;
  tapSourcePort: {
    nodeId: string;
    portId: string;
    label: string;
  } | null;
  activeBeltTier: ConveyorBeltTier;
  pendingBuildId: string | null;
  draggingNodeId: string | null;
  dragHasCollision: boolean;
  wiringFrom: PortHit | null;
  pointerWorldX: number;
  pointerWorldY: number;
  elapsedTime: number;
  activeGuidelines: SnapGuideline[];
  activeTool?: ActiveCanvasTool;
  hoveredWaypoint?: { connId: string; index: number } | null;
  selectedWaypoint?: { connId: string; index: number } | null;
  previewWaypoint?: { connId: string; x: number; y: number } | null;
  selectedNodeIds?: string[];
  marqueeRect?: { x: number; y: number; width: number; height: number } | null;
}

export const VIEWPORT_CULL_MARGIN_PX = 240;

let cachedCrossingsSignature = '';
let cachedCrossingsResult: ConveyorCrossing[] = [];

export function renderFactoryScene(params: CanvasRenderParams) {
  const {
    ctx,
    width,
    height,
    dpr,
    cam,
    cfg,
    nodes,
    connections,
    selectedNodeId: curSelectedId,
    selectedConnectionId: curSelectedConnId,
    hoveredConnectionId: curHoveredConnId,
    tapSourcePort: curTapPort,
    activeBeltTier,
    pendingBuildId,
    draggingNodeId,
    dragHasCollision,
    wiringFrom,
    pointerWorldX,
    pointerWorldY,
    elapsedTime,
    activeGuidelines,
    activeTool = 'edit',
    hoveredWaypoint = null,
    selectedWaypoint = null,
    previewWaypoint = null,
    selectedNodeIds = [],
    marqueeRect = null,
  } = params;

  if (width <= 0 || height <= 0) return;

  const safeZoom =
    Number.isFinite(cam.zoom) && cam.zoom >= 0.08 ? Math.min(3.5, cam.zoom) : 0.74;
  const safeCamX = Number.isFinite(cam.x) ? cam.x : -1820;
  const safeCamY = Number.isFinite(cam.y) ? cam.y : -1920;
  cam.zoom = safeZoom;
  cam.x = safeCamX;
  cam.y = safeCamY;

  const macroMode = isMacroIconZoom(cam.zoom);
  const isBatterySaver = cfg.performanceMode === 'battery_saver';

  // Compute padded world-space viewport rect for off-screen frustum culling
  const viewMinX = -cam.x / cam.zoom - VIEWPORT_CULL_MARGIN_PX;
  const viewMaxX = (-cam.x + width) / cam.zoom + VIEWPORT_CULL_MARGIN_PX;
  const viewMinY = -cam.y / cam.zoom - VIEWPORT_CULL_MARGIN_PX;
  const viewMaxY = (-cam.y + height) / cam.zoom + VIEWPORT_CULL_MARGIN_PX;

  const isBoxInViewport = (minX: number, minY: number, maxX: number, maxY: number) =>
    maxX >= viewMinX && minX <= viewMaxX && maxY >= viewMinY && minY <= viewMaxY;

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
  for (const rc of TOPOGRAPHIC_RIDGE_CENTERS) {
    const maxR = Math.max(rc.rx, rc.ry) * 1.4;
    if (!isBoxInViewport(rc.x - maxR, rc.y - maxR, rc.x + maxR, rc.y + maxR)) {
      continue;
    }
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

  // Subtle Oasis Pond in West Rocky Desert
  if (isBoxInViewport(1380 - 300, 3360 - 200, 1380 + 300, 3360 + 200)) {
    ctx.beginPath();
    ctx.ellipse(1380, 3360, 260, 145, -0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#0D283A';
    ctx.fill();
    ctx.strokeStyle = '#1E4E68';
    ctx.lineWidth = Math.max(2, 2 / cam.zoom);
    ctx.stroke();
  }
  ctx.restore();

  // Bounded Blueprint Coordinate Grid
  const rawGridStep = Number(cfg.gridSize);
  const gridStep =
    Number.isFinite(rawGridStep) && rawGridStep >= 12 ? rawGridStep : 24;
  const majorStep = gridStep * 4;
  const rawMinX = -cam.x / cam.zoom;
  const rawMaxX = (-cam.x + width) / cam.zoom;
  const rawMinY = -cam.y / cam.zoom;
  const rawMaxY = (-cam.y + height) / cam.zoom;

  const startWorldX = Math.max(
    0,
    Math.floor(rawMinX / majorStep) * majorStep
  );
  const endWorldX = Math.min(
    WORLD_WIDTH,
    Math.ceil(rawMaxX / majorStep) * majorStep
  );
  const startWorldY = Math.max(
    0,
    Math.floor(rawMinY / majorStep) * majorStep
  );
  const endWorldY = Math.min(
    WORLD_HEIGHT,
    Math.ceil(rawMaxY / majorStep) * majorStep
  );

  if (startWorldX <= endWorldX && startWorldY <= endWorldY) {
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

  // 3. Render Conveyor Connections using Geometry-Keyed Cached Routes
  const nodeById = new Map<string, MachineNode>();
  for (const n of nodes) {
    nodeById.set(n.id, n);
  }

  const connectedInputPortKeys = new Set<string>();
  const connectedOutputPortKeys = new Set<string>();
  const connRouteMap = new Map<string, CachedConveyorRoute>();
  const allBeltPathsList: { connId: string; pts: { x: number; y: number }[] }[] = [];
  let beltSigParts = '';

  for (const conn of connections) {
    connectedInputPortKeys.add(`${conn.toNodeId}:${conn.toPortId}`);
    connectedOutputPortKeys.add(`${conn.fromNodeId}:${conn.fromPortId}`);

    const fromNode = nodeById.get(conn.fromNodeId);
    const toNode = nodeById.get(conn.toNodeId);
    if (!fromNode || !toNode) continue;

    const outIdx = fromNode.outputs.findIndex((p) => p.id === conn.fromPortId);
    const inIdx = toNode.inputs.findIndex((p) => p.id === conn.toPortId);
    if (outIdx < 0 || inIdx < 0) continue;

    const route = getCachedConveyorRoute(fromNode, outIdx, toNode, inIdx, nodes, conn.waypoints);
    connRouteMap.set(conn.id, route);
    allBeltPathsList.push({ connId: conn.id, pts: route.pts });
    const wpSig =
      conn.waypoints && conn.waypoints.length > 0
        ? conn.waypoints.map((w) => `${w.x},${w.y}`).join(';')
        : '';
    beltSigParts += `${conn.id}:${route.pts.length}:${route.pts[0]?.x},${route.pts[0]?.y}->${route.pts[route.pts.length - 1]?.x},${route.pts[route.pts.length - 1]?.y}[${wpSig}]|`;
  }

  const drawPolyline = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
  };

  for (const conn of connections) {
    const route = connRouteMap.get(conn.id);
    if (!route || route.pts.length < 2) continue;

    if (!isBoxInViewport(route.minX - 24, route.minY - 24, route.maxX + 24, route.maxY + 24)) {
      continue;
    }

    const { pts, polyLen } = route;
    const tierDef = getBeltTierDef(conn.beltTier, conn.maxCapacityPerMin);
    const enteringRate = conn.sourceRatePerMin ?? conn.ratePerMin;
    const packets = conn.inFlightItems ?? [];
    const maxBeltDist = Math.max(polyLen, conn.lengthPx ?? polyLen);
    const visiblePackets = packets.filter((p) => p.distancePx <= maxBeltDist + 1);
    const allItemsStalled =
      visiblePackets.length > 0 && visiblePackets.every((p) => p.stalled);
    const hasMovingItems = visiblePackets.some((p) => !p.stalled);
    const isFlowing = conn.ratePerMin > 0;
    const itemColor = getItemAccentColor(conn.itemName);

    const isConnSelected = conn.id === curSelectedConnId;
    const isConnHovered = conn.id === curHoveredConnId;

    if (isConnSelected || isConnHovered) {
      drawPolyline(pts);
      ctx.strokeStyle = isConnSelected ? '#FACC15' : '#38BDF8';
      ctx.lineWidth = macroMode ? Math.max(10, 7 / cam.zoom) : isConnSelected ? 22 : 20;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // Outer Industrial Conveyor Track Rails
    drawPolyline(pts);
    ctx.strokeStyle = isConnSelected
      ? '#F59E0B'
      : tierDef.tier >= 2
      ? tierDef.accentColor
      : '#334155';
    ctx.lineWidth = macroMode ? Math.max(6, 4.5 / cam.zoom) : 16;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Inner Dark Metallic Conveyor Roller Bed
    drawPolyline(pts);
    ctx.strokeStyle = '#0B111E';
    ctx.lineWidth = macroMode ? Math.max(3, 2.2 / cam.zoom) : 12.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    const filleted = route.filletedPath ?? computeFilletedConveyorPath(pts);

    // Moving Conveyor Roller Slats
    if (!macroMode && !allItemsStalled && (isFlowing || enteringRate > 0 || hasMovingItems)) {
      const totalLen = filleted.totalLength;
      const slatSpacing = 11;
      const speed = tierDef.speedPxPerSec;
      const offset = (elapsedTime * speed) % slatSpacing;
      const endDist = Math.max(0, totalLen - 4);
      const slatHalfWidth = 4.2;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let dist = offset; dist <= endDist; dist += slatSpacing) {
        if (dist < 4) continue;
        const sample = sampleFilletedPath(filleted, dist);
        const { x, y, angle } = sample;

        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const nx = -sinA;
        const ny = cosA;

        const x1 = x - nx * slatHalfWidth;
        const y1 = y - ny * slatHalfWidth;
        const x2 = x + nx * slatHalfWidth;
        const y2 = y + ny * slatHalfWidth;

        ctx.strokeStyle =
          tierDef.tier >= 2 ? `${tierDef.accentColor}55` : '#334155';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Center Power/Guide Spine
    drawPolyline(pts);
    ctx.strokeStyle = isFlowing ? `${itemColor}88` : '#334155';
    ctx.lineWidth = macroMode ? Math.max(3, 2.2 / cam.zoom) : 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Render Physical Discrete Resource Items Traveling Along the Belt
    if (!macroMode && cam.zoom >= 0.35 && packets.length > 0) {
      const itemImg = getCanvasItemImage(conn.itemName);
      if (itemImg) {
        const curPathLen = filleted.totalLength;
        for (let i = packets.length - 1; i >= 0; i--) {
          const pkt = packets[i];
          if (pkt.distancePx > maxBeltDist + 1) continue;
          const portMarginPx = Math.min(8, curPathLen * 0.1);
          const normDist = Math.max(0, Math.min(1, pkt.distancePx / maxBeltDist));
          const clampedDist =
            portMarginPx +
            normDist * Math.max(1, curPathLen - portMarginPx * 2);
          const sample = sampleFilletedPath(filleted, clampedDist);

          const boxSize = 14.8;
          const half = boxSize * 0.5;
          ctx.save();
          ctx.translate(sample.x, sample.y);
          drawRoundedRect(ctx, -half, -half, boxSize, boxSize, 3.2);
          ctx.fillStyle = '#0F172A';
          ctx.fill();
          ctx.strokeStyle = tierDef.tier >= 2 ? tierDef.accentColor : itemColor;
          ctx.lineWidth = 1.3;
          ctx.stroke();
          ctx.drawImage(itemImg, -6.5, -6.5, 13, 13);
          ctx.restore();
        }
      }
    }
  }

  // Render Industrial Elevated Overpass Bridges where belts cross each other
  if (beltSigParts !== cachedCrossingsSignature) {
    cachedCrossingsSignature = beltSigParts;
    cachedCrossingsResult = findConveyorCrossings(allBeltPathsList);
  }
  const crossings = cachedCrossingsResult;
  for (const cross of crossings) {
    if (!isBoxInViewport(cross.x - 20, cross.y - 20, cross.x + 20, cross.y + 20)) {
      continue;
    }
    const bridgeSize = 24;
    const halfB = bridgeSize * 0.5;

    ctx.save();
    if (!isBatterySaver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(cross.x - halfB + 2, cross.y - halfB + 3, bridgeSize, bridgeSize);
    }

    drawRoundedRect(ctx, cross.x - halfB, cross.y - halfB, bridgeSize, bridgeSize, 4);
    ctx.fillStyle = '#0F172A';
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cross.x - halfB + 3, cross.y - halfB + 3);
    ctx.lineTo(cross.x + halfB - 3, cross.y + halfB - 3);
    ctx.moveTo(cross.x + halfB - 3, cross.y - halfB + 3);
    ctx.lineTo(cross.x - halfB + 3, cross.y + halfB - 3);
    ctx.strokeStyle = '#F59E0B77';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(cross.x - halfB - 2.5, cross.y - 4, 3, 8);
    ctx.fillRect(cross.x + halfB - 0.5, cross.y - 4, 3, 8);
    ctx.restore();
  }

  if (wiringFrom) {
    const activeTierDef = getBeltTierDef(activeBeltTier);
    const fromNodeObj = nodeById.get(wiringFrom.nodeId);
    const previewPts = computeOrthogonalConveyorPath(
      wiringFrom.x,
      wiringFrom.y,
      pointerWorldX,
      pointerWorldY,
      nodes,
      fromNodeObj
    );
    drawPolyline(previewPts);
    ctx.strokeStyle = activeTierDef.accentColor;
    ctx.lineWidth = 3 / Math.min(1, cam.zoom);
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 3.5. Render Conveyor Belt Waypoints (Path Edit Handles)
  for (const conn of connections) {
    if (!conn.waypoints || conn.waypoints.length === 0) continue;
    const isConnSelected = conn.id === curSelectedConnId;
    for (let wi = 0; wi < conn.waypoints.length; wi++) {
      const wp = conn.waypoints[wi];
      if (!isBoxInViewport(wp.x - 24, wp.y - 24, wp.x + 24, wp.y + 24)) continue;
      const isHovered =
        hoveredWaypoint?.connId === conn.id && hoveredWaypoint?.index === wi;
      const isWpSelected =
        selectedWaypoint?.connId === conn.id && selectedWaypoint?.index === wi;
      const isActive = isHovered || isWpSelected;

      ctx.save();
      if (isWpSelected) {
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, 13.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.arc(wp.x, wp.y, isActive ? 10 : 8, 0, Math.PI * 2);
      ctx.fillStyle = '#0E1524';
      ctx.fill();
      ctx.strokeStyle =
        activeTool === 'waypoint' && isHovered
          ? '#F43F5E'
          : isActive
          ? '#F59E0B'
          : isConnSelected
          ? '#FACC15'
          : '#38BDF8';
      ctx.lineWidth = isActive ? 3 : 2.2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(wp.x, wp.y, isActive ? 4.5 : 3.2, 0, Math.PI * 2);
      ctx.fillStyle =
        activeTool === 'waypoint' && isHovered
          ? '#F43F5E'
          : isActive
          ? '#F59E0B'
          : isConnSelected
          ? '#FACC15'
          : '#38BDF8';
      ctx.fill();

      if (!macroMode && cam.zoom >= 0.45) {
        ctx.font = '700 8px "JetBrains Mono", monospace';
        ctx.fillStyle =
          activeTool === 'waypoint' && isHovered
            ? '#FB7185'
            : isActive
            ? '#F59E0B'
            : '#94A3B8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const labelText =
          activeTool === 'waypoint' && isHovered
            ? `TAP TO DISMANTLE`
            : `CORNER ${wi + 1}`;
        ctx.fillText(labelText, wp.x, wp.y - 11);
      }
      ctx.restore();
    }
  }

  // Ghost Waypoint Placement Preview
  if (activeTool === 'waypoint' && previewWaypoint) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(previewWaypoint.x, previewWaypoint.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(previewWaypoint.x, previewWaypoint.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#F59E0B';
    ctx.fill();

    if (!macroMode) {
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#F59E0B';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('+ ADD CORNER', previewWaypoint.x, previewWaypoint.y - 12);
    }
    ctx.restore();
  }

  // 4. Render Machine Nodes & Natural World Resource Deposits
  renderMachineNodesAndDeposits({
    ctx,
    cam,
    cfg,
    nodes,
    macroMode,
    isBatterySaver,
    curSelectedId,
    selectedNodeIds,
    draggingNodeId,
    dragHasCollision,
    curTapPort,
    connectedInputPortKeys,
    connectedOutputPortKeys,
    isBoxInViewport,
  });

  // 4.5 Render Floating Belt Telemetry Badges (Top Layer)
  if (!macroMode && cfg.showPortRates) {
    const placedBadges: { x: number; y: number; w: number; h: number }[] = [];
    const badgeH = 18;

    for (const conn of connections) {
      const route = connRouteMap.get(conn.id);
      if (!route || route.pts.length < 2) continue;

      if (!isBoxInViewport(route.minX - 60, route.minY - 60, route.maxX + 60, route.maxY + 60)) {
        continue;
      }

      const { pts } = route;
      const tierDef = getBeltTierDef(conn.beltTier, conn.maxCapacityPerMin);
      const isBackedUp = Boolean(conn.isBackedUp);
      const isFlowing = conn.ratePerMin > 0;
      const itemColor = getItemAccentColor(conn.itemName);

      const badgeText = isBackedUp && conn.ratePerMin === 0
        ? `${tierDef.shortLabel} · STALLED (FULL)`
        : `${tierDef.shortLabel} · ${formatDualRatePerMin(conn.ratePerMin, tierDef.capacityPerMin, cfg)}`;

      ctx.font = '600 9px "JetBrains Mono", monospace';
      const beltImg = getCanvasBuildingImage(tierDef.id);
      const iconPad = beltImg ? 14 : 0;
      const tw = ctx.measureText(badgeText).width + 10 + iconPad;

      const mid = sampleOrthogonalPath(pts, 0.5);
      const badgeX = mid.x;
      let badgeY = mid.y - 22;

      for (const b of placedBadges) {
        if (
          Math.abs(badgeX - b.x) < (tw + b.w) * 0.5 + 4 &&
          Math.abs(badgeY - b.y) < badgeH + 3
        ) {
          badgeY = b.y - (badgeH + 4);
        }
      }
      placedBadges.push({ x: badgeX, y: badgeY, w: tw, h: badgeH });

      ctx.beginPath();
      ctx.moveTo(mid.x, mid.y - 7);
      ctx.lineTo(badgeX, badgeY + badgeH * 0.5);
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.3;
      ctx.stroke();

      ctx.save();
      drawRoundedRect(
        ctx,
        badgeX - tw / 2 + 1.5,
        badgeY - badgeH / 2 + 2.5,
        tw,
        badgeH,
        4
      );
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fill();
      ctx.restore();

      const isBadgeSelected = conn.id === curSelectedConnId;
      const isBadgeHovered = conn.id === curHoveredConnId;

      drawRoundedRect(ctx, badgeX - tw / 2, badgeY - badgeH / 2, tw, badgeH, 4);
      ctx.fillStyle = isBadgeSelected ? '#1E293B' : '#0F172A';
      ctx.fill();
      ctx.strokeStyle = isBadgeSelected
        ? '#FACC15'
        : isBadgeHovered
        ? '#38BDF8'
        : isBackedUp && conn.ratePerMin === 0
        ? '#F59E0B'
        : tierDef.tier >= 2
        ? tierDef.accentColor
        : isFlowing
        ? itemColor
        : '#64748B';
      ctx.lineWidth = isBadgeSelected ? 2.2 : isBadgeHovered ? 1.8 : 1.4;
      ctx.stroke();

      if (beltImg) {
        ctx.drawImage(beltImg, badgeX - tw / 2 + 3.5, badgeY - 6, 12, 12);
      }

      ctx.fillStyle = isBackedUp && conn.ratePerMin === 0
        ? '#FBBF24'
        : isFlowing
        ? '#F8FAFC'
        : '#94A3B8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, badgeX + iconPad * 0.45, badgeY);
    }
  }

  // Ghost Blueprint Hologram for Building Placement
  let ghostGuidelines: SnapGuideline[] = [];
  if (pendingBuildId) {
    const bDef = BUILDINGS[pendingBuildId];
    if (bDef) {
      const snapRes = computeNodeSnapAlignment(
        {
          buildingId: bDef.id,
          x: pointerWorldX - bDef.width / 2,
          y: pointerWorldY - bDef.height / 2,
          width: bDef.width,
          height: bDef.height,
        },
        nodes,
        connections,
        cfg
      );
      ghostGuidelines = snapRes.guidelines;
      const clamped = clampNodeToWorld(snapRes.x, snapRes.y, bDef.width, bDef.height);
      const candidateNode = {
        id: 'ghost_preview',
        buildingId: bDef.id,
        x: clamped.x,
        y: clamped.y,
        width: bDef.width,
        height: bDef.height,
      };

      const nodeCheck = isNodePositionValid(nodes, candidateNode, 4);
      const intersectsBelts = doesCandidateNodeOverlapBeltsOrDots(
        candidateNode as MachineNode,
        nodes,
        connections
      );
      const isValid = nodeCheck.valid && !intersectsBelts;

      ctx.save();
      drawRoundedRect(ctx, clamped.x, clamped.y, bDef.width, bDef.height, 10);
      ctx.fillStyle = isValid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.28)';
      ctx.fill();
      ctx.strokeStyle = isValid ? '#10B981' : '#EF4444';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let i = 0; i < bDef.inputPortCount; i++) {
        const pt = getPortWorldPosition(candidateNode, 'input', i, bDef.inputPortCount);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#06B6D4';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
      for (let i = 0; i < bDef.outputPortCount; i++) {
        const pt = getPortWorldPosition(candidateNode, 'output', i, bDef.outputPortCount);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#F59E0B';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      const ghostImg = getCanvasBuildingImage(bDef.id);
      if (ghostImg) {
        ctx.globalAlpha = 0.65;
        ctx.drawImage(ghostImg, clamped.x + 10, clamped.y + 8, 20, 20);
        ctx.globalAlpha = 1.0;
      }

      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillStyle = isValid ? '#10B981' : '#EF4444';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = !nodeCheck.valid
        ? bDef.id === 'miner_mk1'
          ? 'PLACE DIRECTLY ON UNOCCUPIED DEPOSIT (1 MAX)'
          : 'NO OVERLAP: MACHINE COLLISION'
        : intersectsBelts
        ? 'NO OVERLAP: BELT COLLISION'
        : `TAP TO PLACE ${bDef.name.toUpperCase()}`;
      ctx.fillText(label, clamped.x + bDef.width / 2, clamped.y + bDef.height / 2);
      ctx.restore();
    }
  }

  // 5. Render Satisfactory-Style Snap Mode Alignment Laser Guidelines
  const guidelinesToDraw =
    activeGuidelines.length > 0 ? activeGuidelines : ghostGuidelines;

  if (guidelinesToDraw.length > 0 && cfg.snapMode !== false) {
    ctx.save();
    for (const gl of guidelinesToDraw) {
      const isPort = gl.kind === 'port';

      ctx.beginPath();
      ctx.moveTo(gl.x1, gl.y1);
      ctx.lineTo(gl.x2, gl.y2);
      ctx.strokeStyle = isPort ? `${gl.color}44` : '#38BDF82A';
      ctx.lineWidth = isPort ? 7 / Math.min(1, cam.zoom) : 4 / Math.min(1, cam.zoom);
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(gl.x1, gl.y1);
      ctx.lineTo(gl.x2, gl.y2);
      ctx.strokeStyle = gl.color;
      ctx.lineWidth = isPort ? 2.4 / Math.min(1, cam.zoom) : 1.6 / Math.min(1, cam.zoom);
      ctx.setLineDash(isPort ? [8, 5] : [5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (isPort) {
        for (const endPt of [
          { x: gl.x1, y: gl.y1 },
          { x: gl.x2, y: gl.y2 },
        ]) {
          ctx.beginPath();
          ctx.arc(endPt.x, endPt.y, 11, 0, Math.PI * 2);
          ctx.strokeStyle = gl.color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        if (gl.label && Math.hypot(gl.x2 - gl.x1, gl.y2 - gl.y1) >= 48) {
          const mx = (gl.x1 + gl.x2) * 0.5;
          const my = (gl.y1 + gl.y2) * 0.5 + 16;
          ctx.font = '700 9px "JetBrains Mono", monospace';
          const ltw = ctx.measureText(gl.label).width + 12;
          drawRoundedRect(ctx, mx - ltw * 0.5, my - 8, ltw, 16, 4);
          ctx.fillStyle = '#0B0F17EE';
          ctx.fill();
          ctx.strokeStyle = gl.color;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.fillStyle = gl.color;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(gl.label, mx, my);
        }
      }
    }
    ctx.restore();
  }

  // 6. Multi-Selection Marquee Box (in Select mode)
  if (marqueeRect && (marqueeRect.width > 2 || marqueeRect.height > 2)) {
    ctx.save();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.fillRect(marqueeRect.x, marqueeRect.y, marqueeRect.width, marqueeRect.height);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = Math.max(1.5, 1.8 / Math.min(1, cam.zoom));
    ctx.setLineDash([6 / Math.min(1, cam.zoom), 4 / Math.min(1, cam.zoom)]);
    ctx.strokeRect(marqueeRect.x, marqueeRect.y, marqueeRect.width, marqueeRect.height);
    ctx.setLineDash([]);
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}
