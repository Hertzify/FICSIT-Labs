import {
  BUILDINGS,
  getBuildingMaxStorage,
  PURITY_CONFIG,
  RECIPES,
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
  doesPathIntersectNode,
  doNodesOverlap,
  findConveyorCrossings,
  getBeltTierDef,
  getCachedConveyorRoute,
  getPortWorldPosition,
  isMacroIconZoom,
  isMinerDirectlyOnDeposit,
  isNodePositionValid,
  sampleFilletedPath,
  sampleOrthogonalPath,
  SnapGuideline,
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

export interface PortHit {
  nodeId: string;
  port: PortSocket;
  x: number;
  y: number;
}

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
}

export const VIEWPORT_CULL_MARGIN_PX = 240;

let cachedCrossingsSignature = '';
let cachedCrossingsResult: ConveyorCrossing[] = [];

const TOPOGRAPHIC_RIDGE_CENTERS = [
  { x: 2300, y: 1100, rx: 620, ry: 420 },
  { x: 3650, y: 1450, rx: 850, ry: 520 },
  { x: 2700, y: 2950, rx: 920, ry: 600 },
  { x: 6400, y: 1380, rx: 880, ry: 540 },
  { x: 6150, y: 4080, rx: 780, ry: 480 },
  { x: 3250, y: 6050, rx: 940, ry: 560 },
  { x: 9300, y: 2250, rx: 860, ry: 540 },
  { x: 9600, y: 5300, rx: 1100, ry: 640 },
];

export function drawRoundedRect(
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
export function drawMachineVectorIcon(
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

/**
 * Renders an authentic Satisfactory Planetary Resource Deposit:
 * Natural geological rock outcrop on the terrain with embedded mineral crystal clusters,
 * central heavy-duty excavation mounting collar for Miner Mk.1, and FICSIT survey beacon.
 */
function drawNaturalResourceDeposit(
  ctx: CanvasRenderingContext2D,
  node: MachineNode,
  isSelected: boolean,
  isBatterySaver: boolean,
  primaryItemImg: HTMLImageElement | null,
  isMinerMounted: boolean
) {
  const purityKey = node.purity ?? 'normal';
  const purityInfo = PURITY_CONFIG[purityKey];
  const x = node.x;
  const y = node.y;
  const w = node.width;
  const h = node.height;
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  const isCopper =
    node.recipeId === 'deposit_copper' || node.title.toLowerCase().includes('copper');
  const isLimestone =
    node.recipeId === 'deposit_limestone' || node.title.toLowerCase().includes('limestone');
  const oreName = isCopper ? 'Copper Ore' : isLimestone ? 'Limestone' : 'Iron Ore';

  ctx.save();

  // 1. Natural Planetary Terrain Ground Shadow
  const pad = 12;
  if (!isBatterySaver) {
    ctx.beginPath();
    ctx.ellipse(cx + 4, cy + 8, (w + pad * 2) * 0.52, (h + pad * 2) * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
    ctx.fill();
  }

  // 2. Geological Craggy Rock Slab (extends around mounted Miner Mk.1 so bedrock rim stays visible)
  ctx.beginPath();
  ctx.moveTo(x - pad + 26, y - pad + 4);
  ctx.lineTo(x + w + pad - 30, y - pad + 2);
  ctx.lineTo(x + w + pad - 2, y - pad + 26);
  ctx.lineTo(x + w + pad, y + h + pad - 26);
  ctx.lineTo(x + w + pad - 24, y + h + pad - 2);
  ctx.lineTo(x - pad + 28, y + h + pad);
  ctx.lineTo(x - pad + 2, y + h + pad - 24);
  ctx.lineTo(x - pad + 4, y - pad + 26);
  ctx.closePath();

  ctx.fillStyle = '#0D1522'; // Dark basalt rock
  ctx.fill();
  ctx.strokeStyle = isSelected
    ? '#FACC15'
    : isMinerMounted
    ? '#10B981'
    : '#1E2D44';
  ctx.lineWidth = isSelected ? 3.0 : isMinerMounted ? 2.4 : 1.5;
  ctx.stroke();

  // 3. Inner Geological Bedrock Strata Ring
  ctx.beginPath();
  ctx.moveTo(x + 28, y + 4);
  ctx.lineTo(x + w - 32, y + 2);
  ctx.lineTo(x + w - 4, y + 26);
  ctx.lineTo(x + w - 2, y + h - 28);
  ctx.lineTo(x + w - 26, y + h - 4);
  ctx.lineTo(x + 30, y + h - 2);
  ctx.lineTo(x + 4, y + h - 26);
  ctx.lineTo(x + 6, y + 28);
  ctx.closePath();
  ctx.fillStyle = '#131E30';
  ctx.fill();
  ctx.strokeStyle = '#1B2A3E';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (isMinerMounted) {
    // Protruding Bedrock Pedestal Tab below the mounted Miner Mk.1
    const tabW = 224;
    const tabH = 19;
    const tabX = cx - tabW * 0.5;
    const tabY = y + h + 3;
    drawRoundedRect(ctx, tabX, tabY, tabW, tabH, 5);
    ctx.fillStyle = '#08111D';
    ctx.fill();
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.font = '700 8.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#10B981';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `● ${oreName.toUpperCase()} DEPOSIT (${purityInfo.label.toUpperCase()} · ${purityInfo.ratePerMin}/m)`,
      cx,
      tabY + tabH * 0.5 + 0.5
    );
  }

  // 4. Natural Ore Rock Fractures & Fissures
  ctx.beginPath();
  ctx.moveTo(x + 24, y + 36);
  ctx.lineTo(x + 68, y + 48);
  ctx.lineTo(x + 84, y + 32);
  ctx.moveTo(x + w - 26, y + h - 40);
  ctx.lineTo(x + w - 65, y + h - 45);
  ctx.lineTo(x + w - 85, y + h - 25);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // 5. Crystalline Ore Formations
  const crystalBase = isCopper
    ? '#D97706' // Copper amber
    : isLimestone
    ? '#94A3B8' // Limestone calcite
    : '#475569'; // Iron hematite
  const crystalHighlight = isCopper
    ? '#FDE68A'
    : isLimestone
    ? '#F8FAFC'
    : '#CBD5E1';

  // Left Crystal Cluster
  ctx.beginPath();
  ctx.moveTo(x + 20, y + 72);
  ctx.lineTo(x + 34, y + 42);
  ctx.lineTo(x + 48, y + 54);
  ctx.lineTo(x + 44, y + 84);
  ctx.closePath();
  ctx.fillStyle = crystalBase;
  ctx.fill();
  ctx.strokeStyle = crystalHighlight;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Right Crystal Cluster
  ctx.beginPath();
  ctx.moveTo(x + w - 20, y + 66);
  ctx.lineTo(x + w - 36, y + 36);
  ctx.lineTo(x + w - 50, y + 50);
  ctx.lineTo(x + w - 46, y + 80);
  ctx.closePath();
  ctx.fillStyle = crystalBase;
  ctx.fill();
  ctx.strokeStyle = crystalHighlight;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 6. Miner Excavation Mounting Collar / Anchor Pad
  const collarR = 40;
  ctx.beginPath();
  ctx.arc(cx, cy, collarR, 0, Math.PI * 2);
  ctx.fillStyle = '#080E18';
  ctx.fill();
  ctx.strokeStyle = isMinerMounted ? '#10B981' : '#334155';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Collar Crosshair & Hazard Notches
  ctx.beginPath();
  ctx.arc(cx, cy, collarR - 6, 0, Math.PI * 2);
  ctx.strokeStyle = isMinerMounted ? 'rgba(16, 185, 129, 0.4)' : '#1E293B';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Center Ore Icon
  if (primaryItemImg) {
    const iconDim = isMinerMounted ? 28 : 34;
    ctx.drawImage(
      primaryItemImg,
      cx - iconDim * 0.5,
      cy - (isMinerMounted ? 10 : 8),
      iconDim,
      iconDim
    );
  }

  // Collar Status Readout
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (isMinerMounted) {
    ctx.font = '700 8.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#10B981';
    ctx.fillText('● MINER MK.1 LOCKED', cx, cy + 20);
  } else {
    ctx.font = '700 8.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('⚓ MINER MK.1 MOUNT', cx, cy + 18);
  }

  // 7. FICSIT Survey Holographic Beacon (Top-Left Badge)
  const beaconW = 146;
  const beaconH = 22;
  const beaconX = x + 16;
  const beaconY = y + 10;
  drawRoundedRect(ctx, beaconX, beaconY, beaconW, beaconH, 6);
  ctx.fillStyle = '#080D15';
  ctx.fill();
  ctx.strokeStyle = purityInfo.badgeColor;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.font = '700 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = purityInfo.badgeColor;
  ctx.fillText(
    `${purityInfo.label.toUpperCase()} · ${purityInfo.ratePerMin}/m`,
    beaconX + 8,
    beaconY + beaconH * 0.5 + 0.5
  );

  // Top-Right Ore Name Readout
  ctx.font = '700 11px "Outfit", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#F8FAFC';
  ctx.fillText(oreName, x + w - 16, y + 21);

  ctx.restore();
}

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
  } = params;

  if (width <= 0 || height <= 0) return;

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
  const gridStep = cfg.gridSize || 24;
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

    const route = getCachedConveyorRoute(fromNode, outIdx, toNode, inIdx, nodes);
    connRouteMap.set(conn.id, route);
    allBeltPathsList.push({ connId: conn.id, pts: route.pts });
    beltSigParts += `${conn.id}:${route.pts.length}:${route.pts[0]?.x},${route.pts[0]?.y}->${route.pts[route.pts.length - 1]?.x},${route.pts[route.pts.length - 1]?.y}|`;
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

    // Frustum cull off-screen belts
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

    // Outer Industrial Conveyor Track Rails (16px wide bed so items sit snugly inside)
    drawPolyline(pts);
    ctx.strokeStyle = tierDef.tier >= 2 ? tierDef.accentColor : '#334155';
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

    // Moving Conveyor Roller Slats & Directional Chevrons
    // Thin precision slats and periodic chevrons that rotate smoothly around corner arcs (pauses when backpressured)
    if (!macroMode && !allItemsStalled && (isFlowing || enteringRate > 0 || hasMovingItems)) {
      const totalLen = filleted.totalLength;
      const slatSpacing = 11; // 11px pitch gives dense, sleek industrial roller track
      const speed = tierDef.speedPxPerSec;
      const offset = (elapsedTime * speed) % slatSpacing;
      const endDist = Math.max(0, totalLen - 4);
      const slatHalfWidth = 4.2; // spans 8.4px inside the 12.5px inner roller bed

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

        // Thin precision roller slat perpendicular to belt (rotates smoothly around corner arcs)
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

    // Render Physical Discrete Resource Items Traveling or Lined Up Along the Belt (`conn.inFlightItems`)
    if (!macroMode && cam.zoom >= 0.35 && packets.length > 0) {
      const itemImg = getCanvasItemImage(conn.itemName);
      if (itemImg) {
        const curPathLen = filleted.totalLength;
        // Draw from source (back) to destination (front) so leading items layer cleanly
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

  // Render Industrial Elevated Overpass Bridges where belts cross each other (cached by geometry signature)
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

  // 4. Render Machine Nodes & Natural World Resource Deposits (with Padded Viewport Culling)
  // Deposits render first as ground bedrock, and extractors (Miner Mk.1) mount cleanly on top!
  const sortedNodes = [...nodes].sort((a, b) => {
    if (a.buildingId === 'resource_deposit' && b.buildingId !== 'resource_deposit') return -1;
    if (a.buildingId !== 'resource_deposit' && b.buildingId === 'resource_deposit') return 1;
    return 0;
  });

  for (const node of sortedNodes) {
    const isDeposit = node.buildingId === 'resource_deposit';
    const cullPad = macroMode && isDeposit ? 160 : 60;
    if (
      !isBoxInViewport(
        node.x - cullPad,
        node.y - cullPad,
        node.x + node.width + cullPad,
        node.y + node.height + cullPad
      )
    ) {
      continue;
    }

    const bDef = BUILDINGS[node.buildingId];
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
    } else if (node.status === 'working' || node.status === 'backed_up') {
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
      const cx = node.x + node.width * 0.5;
      const cy = node.y + node.height * 0.5;

      if (isDeposit) {
        const pinRadius = 116;
        const stemEndX = cx + pinRadius * 0.72;
        const stemEndY = cy + pinRadius * 1.28;

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

        ctx.beginPath();
        ctx.arc(cx + 6, cy + 10, pinRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, pinRadius, 0, Math.PI * 2);
        ctx.fillStyle = purityInfo.badgeColor;
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#FACC15' : '#F8FAFC';
        ctx.lineWidth = isSelected
          ? Math.min(28, Math.max(8, 3.2 / cam.zoom))
          : Math.min(20, Math.max(5, 2.1 / cam.zoom));
        ctx.stroke();

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

      if (!isBatterySaver) {
        drawRoundedRect(ctx, node.x + 4, node.y + 8, node.width, node.height, 16);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fill();
      }

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

      ctx.beginPath();
      ctx.arc(node.x + node.width - 22, node.y + 22, 9.5, 0, Math.PI * 2);
      ctx.fillStyle = statusColor;
      ctx.fill();
      ctx.strokeStyle = '#0B0F17';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      continue;
    }

    // In Satisfactory, Resource Deposits are natural geological planetary features,
    // NOT machine card boxes! We render them as terrain features with embedded crystals & miner mounting collar.
    if (isDeposit) {
      const isMinerMounted = nodes.some(
        (n) => n.buildingId === 'miner_mk1' && isMinerDirectlyOnDeposit(n, node, 4)
      );
      drawNaturalResourceDeposit(
        ctx,
        node,
        isSelected,
        isBatterySaver,
        primaryItemImg,
        isMinerMounted
      );
      continue;
    }

    // DETAILED UPLOAD LABS NODE CARD WINDOW (cam.zoom >= 0.25)
    if (!isBatterySaver) {
      drawRoundedRect(ctx, node.x + 3, node.y + 6, node.width, node.height, 10);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.fill();
    }

    drawRoundedRect(ctx, node.x, node.y, node.width, node.height, 10);
    ctx.fillStyle = '#131B2E';
    ctx.fill();

    const isDraggedColliding = draggingNodeId === node.id && dragHasCollision;

    drawRoundedRect(ctx, node.x, node.y, node.width, node.height, 10);
    ctx.strokeStyle = isDraggedColliding
      ? '#EF4444'
      : isSelected
      ? '#F59E0B'
      : isDeposit
      ? accent
      : '#26334D';
    ctx.lineWidth = isDraggedColliding ? 3.2 : isSelected ? 2.4 : isDeposit ? 1.6 : 1.2;
    ctx.stroke();

    if (isDraggedColliding) {
      ctx.save();
      drawRoundedRect(ctx, node.x, node.y, node.width, node.height, 10);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.24)';
      ctx.fill();

      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#EF4444';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const isMinerMissingDeposit =
        node.buildingId === 'miner_mk1' &&
        !nodes.some((n) => n.buildingId === 'resource_deposit' && isMinerDirectlyOnDeposit(node, n, 4));
      const blockedMsg = isMinerMissingDeposit
        ? 'BLOCKED: MUST BE DIRECTLY ON DEPOSIT'
        : 'BLOCKED: OVERLAP DETECTED';
      ctx.fillText(blockedMsg, node.x + node.width / 2, node.y - 8);
      ctx.restore();
    }

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

    if (buildingImg) {
      ctx.drawImage(buildingImg, node.x + 10, node.y + 8, 19, 19);
    } else {
      drawMachineVectorIcon(ctx, node.buildingId, node.x + 20, node.y + 18, 15, accent);
    }

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 12.5px "Outfit", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const displayTitle = isDeposit ? node.title.replace(/\s*\([^)]*\)/, '') : node.title;
    ctx.fillText(displayTitle, node.x + 34, node.y + 18);

    const isMinerMissingDeposit =
      node.buildingId === 'miner_mk1' &&
      !nodes.some((n) => n.buildingId === 'resource_deposit' && isMinerDirectlyOnDeposit(node, n, 4));

    if (isDeposit) {
      const pText = `${purityInfo.label} · ${purityInfo.ratePerMin}/m`;
      ctx.font = '700 9.5px "JetBrains Mono", monospace';
      ctx.fillStyle = purityInfo.badgeColor;
      ctx.textAlign = 'right';
      ctx.fillText(pText, node.x + node.width - 10, node.y + 18);
    } else {
      let statusText = 'IDLE';
      if (isMinerMissingDeposit) {
        statusText = 'NO DEPOSIT';
        statusColor = '#EF4444';
      } else if (node.status === 'optimal') {
        statusText = `${node.efficiency}% OPTIMAL`;
      } else if (node.status === 'working') {
        statusText = `${node.efficiency}% ACTIVE`;
      } else if (node.status === 'backed_up') {
        statusText = 'BACKED UP';
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

    const maxCap =
      node.maxStoredCount ??
      getBuildingMaxStorage(
        node.buildingId,
        node.recipeId,
        node.outputs[0]?.itemName ?? node.inputs[0]?.itemName ?? null
      );
    const storedInt = Math.min(maxCap, Math.floor(node.storedCount ?? 0));

    const recipeTitle = isDeposit
      ? `${recipe?.outputs[0]?.itemName ?? 'Ore'} Vein (${purityInfo.multiplier}x Purity)`
      : isMinerMissingDeposit
      ? 'Unmounted · Place on Deposit'
      : recipe?.name ??
        (node.buildingId === 'the_hub'
          ? `24-Slot Depot · ${storedInt}/${maxCap}`
          : node.buildingId === 'storage_container'
          ? `24-Slot Buffer · ${storedInt}/${maxCap}`
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
    const barW = node.width - 28;

    // 1. STORAGE BARS: Miner Mk.1 has single full-width output buffer; Processors have dual IN & OUT bars
    if (node.buildingId === 'miner_mk1') {
      const storageBarY = node.y + node.height - 30;
      const storageBarH = 11;
      const outMax = Math.max(1, maxCap);
      const outInt = storedInt;
      const outRatio = Math.max(0, Math.min(1, (node.storedCount ?? 0) / outMax));
      const isOutFull = outRatio >= 0.995;

      drawRoundedRect(ctx, barX, storageBarY, barW, storageBarH, 4);
      ctx.fillStyle = '#0B0F17';
      ctx.fill();
      ctx.strokeStyle = isOutFull ? '#F59E0B' : '#1E293B';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (outRatio > 0.005) {
        drawRoundedRect(
          ctx,
          barX,
          storageBarY,
          Math.max(5, barW * outRatio),
          storageBarH,
          4
        );
        ctx.fillStyle = isOutFull ? '#D97706' : '#0D9488';
        ctx.fill();
      }

      ctx.font = '700 8px "JetBrains Mono", monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = isOutFull ? '#FDE68A' : '#5EEAD4';
      const oreName = node.outputs[0]?.itemName ?? 'ORE';
      ctx.fillText(`STORAGE · ${oreName.toUpperCase()}`, barX + 6, storageBarY + storageBarH * 0.5 + 0.5);

      ctx.textAlign = 'right';
      ctx.fillStyle = isOutFull ? '#FDE68A' : '#F8FAFC';
      ctx.fillText(
        `${outInt} / ${outMax}`,
        barX + barW - 6,
        storageBarY + storageBarH * 0.5 + 0.5
      );
    } else {
      // DUAL INPUT & OUTPUT STORAGE BARS (IN on Left under Input Ports, OUT on Right under Output Ports)
      const storageBarY = node.y + node.height - 30;
      const storageBarH = 11;
      const halfBarW = (barW - 6) * 0.5;

      const inMax = Math.max(
        1,
        node.maxInputStoredCount ??
          node.inputs.reduce((acc, p) => acc + (p.maxBuffer ?? 100), 0)
      );
      const inRaw =
        node.inputStoredCount ??
        node.inputs.reduce((acc, p) => acc + (p.bufferedCount ?? 0), 0);
      const inInt = Math.min(inMax, Math.floor(inRaw));
      const inRatio = Math.max(0, Math.min(1, inRaw / inMax));
      const isInFull =
        node.inputs.length > 0 &&
        node.inputs.some((p) => (p.bufferedCount ?? 0) >= (p.maxBuffer ?? 100) - 0.5);

      const outMax = Math.max(1, maxCap);
      const outRaw = node.storedCount ?? 0;
      const outInt = storedInt;
      const outRatio = Math.max(0, Math.min(1, outRaw / outMax));
      const isOutFull = outRatio >= 0.995;

      // Left Bar: Input Storage (IN)
      drawRoundedRect(ctx, barX, storageBarY, halfBarW, storageBarH, 4);
      ctx.fillStyle = '#0B0F17';
      ctx.fill();
      ctx.strokeStyle = isInFull ? '#F59E0B' : '#1E293B';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (inRatio > 0.005) {
        drawRoundedRect(
          ctx,
          barX,
          storageBarY,
          Math.max(5, halfBarW * inRatio),
          storageBarH,
          4
        );
        ctx.fillStyle = isInFull ? '#D97706' : '#0891B2';
        ctx.fill();
      }

      ctx.font = '700 8px "JetBrains Mono", monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = isInFull ? '#FDE68A' : '#67E8F9';
      ctx.fillText('IN', barX + 4, storageBarY + storageBarH * 0.5 + 0.5);

      ctx.textAlign = 'right';
      ctx.fillStyle = isInFull ? '#FDE68A' : '#F8FAFC';
      ctx.fillText(
        `${inInt}/${inMax}`,
        barX + halfBarW - 4,
        storageBarY + storageBarH * 0.5 + 0.5
      );

      // Right Bar: Output Storage (OUT)
      const outBarX = barX + halfBarW + 6;
      drawRoundedRect(ctx, outBarX, storageBarY, halfBarW, storageBarH, 4);
      ctx.fillStyle = '#0B0F17';
      ctx.fill();
      ctx.strokeStyle = isOutFull ? '#F59E0B' : '#1E293B';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (outRatio > 0.005) {
        drawRoundedRect(
          ctx,
          outBarX,
          storageBarY,
          Math.max(5, halfBarW * outRatio),
          storageBarH,
          4
        );
        ctx.fillStyle = isOutFull ? '#D97706' : '#0D9488';
        ctx.fill();
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = isOutFull ? '#FDE68A' : '#5EEAD4';
      ctx.fillText('OUT', outBarX + 4, storageBarY + storageBarH * 0.5 + 0.5);

      ctx.textAlign = 'right';
      ctx.fillStyle = isOutFull ? '#FDE68A' : '#F8FAFC';
      ctx.fillText(
        `${outInt}/${outMax}`,
        outBarX + halfBarW - 4,
        storageBarY + storageBarH * 0.5 + 0.5
      );
    }

    // 2. CRAFTING / EXTRACTION CYCLE PROGRESS BAR (Below Storage Bars)
    const cycleBarY = node.y + node.height - 14;
    const cycleBarH = 6;
    const isContainer =
      node.buildingId === 'storage_container' || node.buildingId === 'the_hub';
    const isLogistics =
      node.buildingId === 'splitter' || node.buildingId === 'merger';

    drawRoundedRect(ctx, barX, cycleBarY, barW, cycleBarH, 3);
    ctx.fillStyle = '#0B0F17';
    ctx.fill();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    ctx.stroke();

    const cycleFillRatio =
      isLogistics || isContainer
        ? node.efficiency > 0
          ? 1
          : 0
        : Math.max(0, Math.min(1, node.progress));

    if (cycleFillRatio > 0.01) {
      drawRoundedRect(
        ctx,
        barX,
        cycleBarY,
        Math.max(6, barW * cycleFillRatio),
        cycleBarH,
        3
      );
      ctx.fillStyle = accent;
      ctx.fill();
    }

    // Input Port Dots, Official Resource Icons & Stacked Rate Readouts (Miners have 0 input ports)
    const inputCount = node.buildingId === 'miner_mk1' ? 0 : node.inputs.length;
    for (let i = 0; i < inputCount; i++) {
      const port = node.inputs[i];
      const pt = getPortWorldPosition(node, 'input', i, inputCount);
      const isConnected = connectedInputPortKeys.has(`${node.id}:${port.id}`);
      const isPortFull = (port.bufferedCount ?? 0) >= (port.maxBuffer ?? 100) - 0.5;
      const portImg = getCanvasItemImage(port.itemName ?? port.label);

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = isPortFull
        ? '#D97706'
        : isConnected
        ? '#06B6D4'
        : '#0B0F17';
      ctx.fill();
      ctx.strokeStyle = isPortFull ? '#FBBF24' : '#38BDF8';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = isConnected || isPortFull ? '#FFFFFF' : '#38BDF8';
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
        ctx.fillStyle = isPortFull ? '#FBBF24' : '#38BDF8';
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
      const pt = getPortWorldPosition(node, 'output', i, node.outputs.length);
      const isConnected = connectedOutputPortKeys.has(`${node.id}:${port.id}`);
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

  // 4.5 Render Floating Belt Telemetry Badges (Top Layer so they always draw ON TOP of Machine Nodes)
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
        : `${tierDef.shortLabel} · ${conn.ratePerMin}/${tierDef.capacityPerMin}`;

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

      drawRoundedRect(ctx, badgeX - tw / 2, badgeY - badgeH / 2, tw, badgeH, 4);
      ctx.fillStyle = '#0F172A';
      ctx.fill();
      ctx.strokeStyle = isBackedUp && conn.ratePerMin === 0
        ? '#F59E0B'
        : tierDef.tier >= 2
        ? tierDef.accentColor
        : isFlowing
        ? itemColor
        : '#64748B';
      ctx.lineWidth = 1.4;
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
      const intersectsBelts = allBeltPathsList.some((bp) =>
        doesPathIntersectNode(bp.pts, candidateNode as any, 2)
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

  // 5. Render Satisfactory-Style Snap Mode Alignment Laser Guidelines (Topmost Layer)
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

  ctx.restore();
  ctx.restore();
}
