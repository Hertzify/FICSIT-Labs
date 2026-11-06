/**
 * ============================================================================
 * MODULE INDEX: Machine Node, Miner Exterior HUD & Deposit Renderer (`src/components/canvasNodeRenderer.ts`)
 * ============================================================================
 * [Lines 032-086] renderMachineNodesAndDeposits Setup & Mounted Deposit Pre-Indexing
 * [Lines 088-216] Macro Zoom LOD (< 0.25x): Resource Map Pins & Medallion Boxes
 * [Lines 218-231] Natural Geological Resource Deposit Outcrops (`drawNaturalResourceDeposit`)
 * [Lines 233-524] Authentic Satisfactory Miner Mk.1 Exterior HUD (`Media item 1` + 250% Overclock Bar)
 * [Lines 526-768] Standard Processor / Logistics Node Cards (Header, Recipe, IN/OUT Storage Bars)
 * [Lines 770-876] Input & Output Port Sockets, Resource Icons & Rate Readouts
 * ============================================================================
 */

import {
  BUILDINGS,
  formatDualRatePerMin,
  formatRatePerMin,
  getBuildingMaxStorage,
  isCompactRateFormat,
  PURITY_CONFIG,
  RECIPES,
} from '../game/catalog';
import {
  getCanvasBuildingImage,
  getCanvasItemImage,
} from '../game/icons';
import {
  getPortWorldPosition,
  isMinerDirectlyOnDeposit,
} from '../game/rules';
import {
  CameraState,
  MachineNode,
  SettingsConfig,
} from '../game/types';
import {
  drawMachineVectorIcon,
  drawNaturalResourceDeposit,
  drawRoundedRect,
  drawSatisfactoryEfficiencyIcon,
  drawSatisfactoryPowerIcon,
  drawSatisfactoryStopwatchIcon,
} from './canvasArtwork';

export interface NodeRenderParams {
  ctx: CanvasRenderingContext2D;
  cam: CameraState;
  cfg: SettingsConfig;
  nodes: MachineNode[];
  macroMode: boolean;
  isBatterySaver: boolean;
  curSelectedId: string | null;
  selectedNodeIds: string[];
  draggingNodeId: string | null;
  dragHasCollision: boolean;
  curTapPort: { nodeId: string; portId: string; label: string } | null;
  connectedInputPortKeys: Set<string>;
  connectedOutputPortKeys: Set<string>;
  isBoxInViewport: (minX: number, minY: number, maxX: number, maxY: number) => boolean;
}

export function renderMachineNodesAndDeposits(params: NodeRenderParams): void {
  const {
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
  } = params;

  const isCompactRate = isCompactRateFormat(cfg);

  const depositsList: MachineNode[] = [];
  const buildingsList: MachineNode[] = [];
  for (const n of nodes) {
    if (n.buildingId === 'resource_deposit') {
      depositsList.push(n);
    } else {
      buildingsList.push(n);
    }
  }
  const sortedNodes = [...depositsList, ...buildingsList];

  // Precompute mounted Deposit <-> Miner Mk.1 pairs in O(M * D) once per frame
  const mountedDepositIds = new Set<string>();
  const mountedMinerIds = new Set<string>();
  for (const bNode of buildingsList) {
    if (bNode.buildingId !== 'miner_mk1') continue;
    for (const dNode of depositsList) {
      if (isMinerDirectlyOnDeposit(bNode, dNode, 4)) {
        mountedDepositIds.add(dNode.id);
        mountedMinerIds.add(bNode.id);
        break;
      }
    }
  }

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
    const purityInfo = PURITY_CONFIG[purityKey] ?? PURITY_CONFIG.normal;
    const accent = isDeposit
      ? purityInfo.badgeColor
      : bDef?.accentColor ?? '#F59E0B';
    const isSelected =
      node.id === curSelectedId || selectedNodeIds.includes(node.id);
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

    // Natural Geological Resource Deposit Outcrops
    if (isDeposit) {
      const isMinerMounted = mountedDepositIds.has(node.id);
      drawNaturalResourceDeposit(
        ctx,
        node,
        isSelected,
        isBatterySaver,
        primaryItemImg,
        isMinerMounted,
        cfg
      );
      continue;
    }

    // DETAILED NODE CARD WINDOW (cam.zoom >= 0.25)
    const isDraggedColliding = draggingNodeId === node.id && dragHasCollision;
    const isMinerMissingDeposit =
      node.buildingId === 'miner_mk1' && !mountedMinerIds.has(node.id);

    const maxCap =
      node.maxStoredCount ??
      getBuildingMaxStorage(
        node.buildingId,
        node.recipeId,
        node.outputs[0]?.itemName ?? node.inputs[0]?.itemName ?? null
      );
    const storedInt = Math.min(maxCap, Math.floor(node.storedCount ?? 0));

    if (node.buildingId === 'miner_mk1') {
      // =========================================================================
      // AUTHENTIC MINER MK.1 EXTERIOR UI (IMG_20261106_200138_7118c228.jpg)
      // Base photo-realistic chassis (`miner_chassis_bg.jpg`, 1376x768) +
      // dynamic telemetry, ore slot, 0%-250% overclock bar, and I/O standby switch
      // =========================================================================
      const W = node.width;
      const H = node.height;
      const nx = node.x;
      const ny = node.y;

      if (!isBatterySaver) {
        drawRoundedRect(ctx, nx + 3, ny + 6, W, H, 9);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
        ctx.fill();
      }

      const isStandby = Boolean(node.isStandby);
      const isBackedUp = node.status === 'backed_up';
      const lightColor =
        isStandby || isMinerMissingDeposit || node.status === 'starved'
          ? '#EF4444'
          : isBackedUp || (node.efficiency > 0 && node.efficiency < 99)
          ? '#FACC15'
          : node.efficiency >= 99
          ? '#22C55E'
          : '#EF4444';

      const clockPct = node.clockSpeedPct ?? 100;
      const baseMw = bDef?.powerMw ?? 5;
      const powerMw = isStandby
        ? 0.1
        : Number((baseMw * Math.pow(clockPct / 100, 1.321928)).toFixed(1));
      const outTargetRate = node.outputs[0]?.targetRatePerMin || 60;
      const cycleSec =
        outTargetRate > 0 ? Number((60 / outTargetRate).toFixed(1)) : 1.0;
      const rawOreName =
        node.outputs[0]?.itemName ?? recipe?.outputs[0]?.itemName ?? 'Iron Ore';

      const chassisImg = getCanvasBuildingImage('miner_chassis_bg');

      ctx.save();
      drawRoundedRect(ctx, nx, ny, W, H, 9);
      ctx.clip();

      if (chassisImg) {
        ctx.drawImage(chassisImg, nx, ny, W, H);
      } else {
        ctx.fillStyle = '#52565E';
        ctx.fillRect(nx, ny, W, H);
      }

      // -----------------------------------------------------------------------
      // 1. CENTER DARK MONITOR SCREEN OVERLAY (Status LED + 3 Telemetry Columns)
      // -----------------------------------------------------------------------
      const scrX = nx + W * 0.506;
      const scrY = ny + H * 0.111;
      const scrW = W * 0.228;
      const scrH = H * 0.281;

      drawRoundedRect(ctx, scrX, scrY, scrW, scrH, 3);
      ctx.fillStyle = '#0A0C0F';
      ctx.fill();

      // Top Half of Screen: Status LED Dot + Status Title ("Mining")
      const statusLabel = isMinerMissingDeposit
        ? 'No Deposit'
        : isStandby
        ? 'Standby'
        : isBackedUp
        ? 'Output Full'
        : 'Mining';
      ctx.font = '700 8.5px "Plus Jakarta Sans", sans-serif';
      const statusTextW = ctx.measureText(statusLabel).width;
      const ledDotR = 3.6;
      const totalHeaderW = ledDotR * 2 + 5 + statusTextW;
      const headerStartX = scrX + (scrW - totalHeaderW) * 0.5;
      const headerCenterY = scrY + scrH * 0.26;

      ctx.beginPath();
      ctx.arc(headerStartX + ledDotR, headerCenterY, ledDotR, 0, Math.PI * 2);
      ctx.fillStyle = lightColor;
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(statusLabel, headerStartX + ledDotR * 2 + 5, headerCenterY + 0.4);

      // Horizontal & 2 Vertical Divider Lines inside Screen
      const divY = scrY + scrH * 0.51;
      ctx.strokeStyle = '#2B2E35';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(scrX + 1.5, divY);
      ctx.lineTo(scrX + scrW - 1.5, divY);
      ctx.moveTo(scrX + scrW / 3, divY + 1);
      ctx.lineTo(scrX + scrW / 3, scrY + scrH - 1.5);
      ctx.moveTo(scrX + (scrW * 2) / 3, divY + 1);
      ctx.lineTo(scrX + (scrW * 2) / 3, scrY + scrH - 1.5);
      ctx.stroke();

      const c1X = scrX + scrW * 0.167;
      const c2X = scrX + scrW * 0.5;
      const c3X = scrX + scrW * 0.833;
      const iconY = divY + scrH * 0.19;
      const valY = divY + scrH * 0.39;

      const effColor =
        isStandby || isMinerMissingDeposit || node.efficiency === 0
          ? '#EF4444'
          : node.efficiency < 99
          ? '#FACC15'
          : '#FFFFFF';

      drawSatisfactoryPowerIcon(ctx, c1X, iconY, 8.2, '#FFFFFF');
      drawSatisfactoryStopwatchIcon(ctx, c2X, iconY, 8.2, '#FFFFFF');
      drawSatisfactoryEfficiencyIcon(ctx, c3X, iconY, 8.2, effColor);

      ctx.font = '700 5.6px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`${powerMw} MW`, c1X, valY);
      ctx.fillText(`${cycleSec.toFixed(1)} sec`, c2X, valY);
      ctx.fillStyle = effColor;
      ctx.fillText(`${node.efficiency}%`, c3X, valY);

      // -----------------------------------------------------------------------
      // 2. TOP-RIGHT WHITE [ OUTPUT ] CARD OVERLAY (Ore Slot, Badge & Rate)
      // -----------------------------------------------------------------------
      const slotX = nx + W * 0.795;
      const slotY = ny + H * 0.165;
      const slotW = W * 0.143;
      const slotH = H * 0.276;

      // If mining non-Iron ore, replace the baked-in Iron Ore icon inside the gray slot
      if (rawOreName !== 'Iron Ore' && primaryItemImg) {
        drawRoundedRect(ctx, slotX, slotY, slotW, slotH, 3);
        ctx.fillStyle = '#9EA2AB';
        ctx.fill();
        const imgDim = Math.min(slotW, slotH) * 0.84;
        ctx.drawImage(
          primaryItemImg,
          slotX + (slotW - imgDim) * 0.5,
          slotY + (slotH - imgDim) * 0.44,
          imgDim,
          imgDim
        );
      }

      // Live Orange Stored Count Badge at Bottom-Right of Ore Slot
      const countText = String(storedInt);
      ctx.font = '700 6.8px "Plus Jakarta Sans", sans-serif';
      const badgeW = Math.max(W * 0.052, ctx.measureText(countText).width + 5);
      const badgeH = H * 0.068;
      const badgeX = slotX + slotW - badgeW - 1.5;
      const badgeY = slotY + slotH - badgeH - 1.5;
      drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 2.5);
      ctx.fillStyle = '#DF8A2E';
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(countText, badgeX + badgeW * 0.5, badgeY + badgeH * 0.5 + 0.3);

      // Cover & Redraw "1 Iron Ore" + "60 per minute" below the Ore Slot
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(nx + W * 0.785, ny + H * 0.456, W * 0.163, H * 0.125);

      const outCenterX = nx + W * 0.8665;
      ctx.font = '700 7.2px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#26282C';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`1 ${rawOreName}`, outCenterX, ny + H * 0.49);

      const rateNumStr = `${outTargetRate} `;
      const rateUnitStr = isCompactRate ? '/m' : 'per minute';
      ctx.font = '700 6.1px "Plus Jakarta Sans", sans-serif';
      const rateNumW = ctx.measureText(rateNumStr).width;
      ctx.font = '600 6.1px "Plus Jakarta Sans", sans-serif';
      const rateUnitW = ctx.measureText(rateUnitStr).width;
      const rateStartX = outCenterX - (rateNumW + rateUnitW) * 0.5;

      ctx.textAlign = 'left';
      ctx.font = '700 6.1px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#DF8A2E';
      ctx.fillText(rateNumStr, rateStartX, ny + H * 0.548);
      ctx.font = '600 6.1px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#374151';
      ctx.fillText(rateUnitStr, rateStartX + rateNumW, ny + H * 0.548);

      // -----------------------------------------------------------------------
      // 3. BOTTOM-LEFT STEPPED WHITE OVERCLOCK BOX OVERLAY (0% — 250%)
      // -----------------------------------------------------------------------
      ctx.fillStyle = '#FFFFFF';
      // Top-left white region (Clock Speed + Target production rate)
      ctx.fillRect(nx + W * 0.063, ny + H * 0.714, W * 0.39, H * 0.105);
      // Full-width lower white region (5-segment bar + 0%..250% tick labels)
      ctx.fillRect(nx + W * 0.063, ny + H * 0.775, W * 0.72, H * 0.165);

      const ocTextX = nx + W * 0.068;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '700 7.2px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#1E2024';
      ctx.fillText(`Clock Speed: ${clockPct}%`, ocTextX, ny + H * 0.742);

      ctx.font = '600 6.3px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#374151';
      const targetPrefix = 'Target production rate: ';
      const targetPrefixW = ctx.measureText(targetPrefix).width;
      ctx.fillText(targetPrefix, ocTextX, ny + H * 0.793);

      ctx.font = '700 6.5px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#DF8A2E';
      ctx.fillText(
        `${outTargetRate} ${isCompactRate ? '/m' : 'per minute'}`,
        ocTextX + targetPrefixW,
        ny + H * 0.793
      );

      // 5-Segment Overclock Bar (0%-50%, 50%-100%, 100%-150%, 150%-200%, 200%-250%)
      const segBarX = nx + W * 0.068;
      const segBarY = ny + H * 0.822;
      const segBarW = W * 0.712;
      const segBarH = H * 0.068;
      const installedShards = Math.min(
        3,
        Math.max(0, Math.floor(node.powerShards ?? 0))
      );
      const maxUnlockedClock = 100 + installedShards * 50;

      const ocSegments = [
        { start: 0, end: 50, idx: 0 },
        { start: 50, end: 100, idx: 1 },
        { start: 100, end: 150, idx: 2 },
        { start: 150, end: 200, idx: 3 },
        { start: 200, end: 250, idx: 4 },
      ];
      const segW = segBarW / 5;
      for (const seg of ocSegments) {
        const sx = segBarX + seg.idx * segW;
        const sw = segW - 1.5;
        ctx.fillStyle = seg.end <= maxUnlockedClock ? '#484B51' : '#9CA3AF';
        ctx.fillRect(sx, segBarY, sw, segBarH);

        if (clockPct > seg.start) {
          const fillSpan = Math.min(seg.end, clockPct) - seg.start;
          const fw = (fillSpan / (seg.end - seg.start)) * sw;
          if (fw > 0) {
            ctx.fillStyle = '#E0862B';
            ctx.fillRect(sx, segBarY, fw, segBarH);
          }
        }
      }

      // Tick labels: 0%, 100%, 150%, 200%, 250%
      ctx.font = '700 6.1px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#1E2024';
      ctx.textBaseline = 'middle';
      const tickY = ny + H * 0.916;
      ctx.textAlign = 'left';
      ctx.fillText('0%', segBarX, tickY);
      ctx.textAlign = 'center';
      ctx.fillText('100%', segBarX + segW * 2, tickY);
      ctx.fillText('150%', segBarX + segW * 3, tickY);
      ctx.fillText('200%', segBarX + segW * 4, tickY);
      ctx.textAlign = 'right';
      ctx.fillText('250%', segBarX + segBarW, tickY);

      // -----------------------------------------------------------------------
      // 4. BOTTOM-RIGHT HORIZONTAL I / O STANDBY ROCKER SWITCH OVERLAY
      // -----------------------------------------------------------------------
      const rkrX = nx + W * 0.838;
      const rkrY = ny + H * 0.785;
      const rkrW = W * 0.098;
      const rkrH = H * 0.096;
      const halfRkrW = rkrW * 0.5;

      // Left half ('I') and Right half ('O') inside the switch bezel
      ctx.fillStyle = !isStandby ? '#B93815' : '#262930';
      ctx.fillRect(rkrX, rkrY, halfRkrW, rkrH);
      ctx.fillStyle = isStandby ? '#B91C1C' : '#32363E';
      ctx.fillRect(rkrX + halfRkrW, rkrY, halfRkrW, rkrH);

      // Left 'I' vertical bar symbol
      ctx.save();
      ctx.strokeStyle = !isStandby ? '#FFFFFF' : '#9CA3AF';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(rkrX + halfRkrW * 0.48, rkrY + rkrH * 0.25);
      ctx.lineTo(rkrX + halfRkrW * 0.48, rkrY + rkrH * 0.75);
      ctx.stroke();
      ctx.restore();

      // Right 'O' circle symbol
      ctx.save();
      ctx.strokeStyle = isStandby ? '#FFFFFF' : '#9CA3AF';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(
        rkrX + halfRkrW * 1.48,
        rkrY + rkrH * 0.5,
        Math.min(halfRkrW, rkrH) * 0.24,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.restore();

      ctx.restore();

      drawRoundedRect(ctx, nx, ny, W, H, 9);
      ctx.strokeStyle = isDraggedColliding
        ? '#EF4444'
        : isSelected
        ? '#F59E0B'
        : '#27292E';
      ctx.lineWidth = isDraggedColliding ? 3.2 : isSelected ? 2.4 : 1.5;
      ctx.stroke();

      if (isDraggedColliding) {
        ctx.save();
        drawRoundedRect(ctx, nx, ny, W, H, 9);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.24)';
        ctx.fill();
        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.fillStyle = '#EF4444';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const blockedMsg = isMinerMissingDeposit
          ? 'BLOCKED: MUST BE DIRECTLY ON DEPOSIT'
          : 'BLOCKED: OVERLAP DETECTED';
        ctx.fillText(blockedMsg, nx + W / 2, ny - 8);
        ctx.restore();
      }
    } else {
      // =========================================================================
      // STANDARD NODE CARD FOR SMELTERS, CONSTRUCTORS, ASSEMBLERS, LOGISTICS
      // =========================================================================
      if (!isBatterySaver) {
        drawRoundedRect(ctx, node.x + 3, node.y + 6, node.width, node.height, 10);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
        ctx.fill();
      }

      drawRoundedRect(ctx, node.x, node.y, node.width, node.height, 10);
      ctx.fillStyle = '#131B2E';
      ctx.fill();

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
        ctx.fillText('BLOCKED: OVERLAP DETECTED', node.x + node.width / 2, node.y - 8);
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

      let statusText = 'IDLE';
      if (node.isStandby) {
        statusText = 'STANDBY';
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

      const recipeTitle =
        recipe?.name ??
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
          formatDualRatePerMin(port.actualRatePerMin, port.targetRatePerMin, cfg),
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

      // Skip inner port label & icon for Miner Mk.1 since its [ OUTPUT ] card already displays the ore & rate
      if (node.buildingId === 'miner_mk1') {
        continue;
      }

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
        ctx.fillText(formatRatePerMin(port.actualRatePerMin, cfg), textRightX, pt.y + 7);
      } else {
        ctx.font = '600 10.5px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#F8FAFC';
        ctx.fillText(port.label, textRightX, pt.y);
      }
    }
  }
}
