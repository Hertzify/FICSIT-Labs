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
  getBuildingMaxStorage,
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
        isMinerMounted
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
      // AUTHENTIC SATISFACTORY MINER EXTERIOR UI ("Media item 1" with 250% max)
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

      const chassisImg = getCanvasBuildingImage('miner_chassis_bg');
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

      ctx.save();
      drawRoundedRect(ctx, nx, ny, W, H, 8);
      ctx.clip();

      if (chassisImg) {
        ctx.drawImage(chassisImg, nx, ny, W, H);
      } else {
        ctx.fillStyle = '#686B70';
        ctx.fillRect(nx, ny, W, H);
      }

      // 1. CENTER DARK SCREEN LIVE OVERLAY (Status + MW / sec / Efficiency %)
      const scrTopX = nx + 0.510 * W;
      const scrTopY = ny + 0.114 * H;
      const scrTopW = 0.221 * W;
      const scrTopH = 0.138 * H;
      ctx.fillStyle = '#0D0F12';
      ctx.fillRect(scrTopX, scrTopY, scrTopW, scrTopH);

      const headerLabel = isMinerMissingDeposit
        ? 'NO DEPOSIT'
        : isStandby
        ? 'STANDBY'
        : isBackedUp
        ? 'OUTPUT FULL'
        : 'Mining';

      const statusCenterY = scrTopY + scrTopH * 0.52;
      ctx.font = '700 9px "Plus Jakarta Sans", sans-serif';
      const titleW = ctx.measureText(headerLabel).width;
      const dotRadius = 3.2;
      const totalHeaderW = dotRadius * 2 + 4.5 + titleW;
      const startHeaderX = scrTopX + (scrTopW - totalHeaderW) * 0.5;

      ctx.beginPath();
      ctx.arc(startHeaderX + dotRadius, statusCenterY, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = lightColor;
      ctx.fill();

      ctx.fillStyle = isStandby || isMinerMissingDeposit ? '#FCA5A5' : '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(headerLabel, startHeaderX + dotRadius * 2 + 4.5, statusCenterY + 0.5);

      const col1X = nx + 0.510 * W;
      const col2X = nx + 0.586 * W;
      const col3X = nx + 0.661 * W;
      const colBoxW = 0.070 * W;
      const valPatchY = ny + 0.330 * H;
      const valPatchH = 0.055 * H;
      ctx.fillStyle = '#0D0F12';
      ctx.fillRect(col1X, valPatchY, colBoxW, valPatchH);
      ctx.fillRect(col2X, valPatchY, colBoxW, valPatchH);
      ctx.fillRect(col3X, valPatchY, colBoxW, valPatchH);

      ctx.font = '600 5.7px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const valCenterY = valPatchY + valPatchH * 0.52;
      ctx.fillText(`${powerMw} MW`, col1X + colBoxW * 0.5, valCenterY);
      ctx.fillText(`${cycleSec.toFixed(1)} sec`, col2X + colBoxW * 0.5, valCenterY);
      ctx.fillStyle = node.efficiency < 100 ? lightColor : '#FFFFFF';
      ctx.fillText(`${node.efficiency}%`, col3X + colBoxW * 0.5, valCenterY);

      // 2. RIGHT WHITE [ OUTPUT ] CARD LIVE OVERLAY (Ore Icon + Live Count + Name + Rate)
      const slotX = nx + 0.795 * W;
      const slotY = ny + 0.166 * H;
      const slotW = 0.142 * W;
      const slotH = 0.270 * H;

      drawRoundedRect(ctx, slotX, slotY, slotW, slotH, 4.5);
      ctx.fillStyle = '#9A9D9E';
      ctx.fill();

      if (primaryItemImg) {
        const iconSize = Math.min(slotW, slotH) * 0.86;
        ctx.drawImage(
          primaryItemImg,
          slotX + (slotW - iconSize) * 0.5,
          slotY + (slotH - iconSize) * 0.46,
          iconSize,
          iconSize
        );
      }

      const countStr = String(storedInt);
      ctx.font = '700 7.8px "Plus Jakarta Sans", sans-serif';
      const badgeW = Math.max(13.5, ctx.measureText(countStr).width + 5.5);
      const badgeH = 9.5;
      const badgeX = slotX + slotW - badgeW - 2;
      const badgeY = slotY + slotH - badgeH - 1.5;
      drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 2.2);
      ctx.fillStyle = '#E58824';
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(countStr, badgeX + badgeW * 0.5, badgeY + badgeH * 0.5 + 0.5);

      const outTextPatchX = nx + 0.784 * W;
      const outTextPatchY = ny + 0.442 * H;
      const outTextPatchW = 0.163 * W;
      const outTextPatchH = 0.142 * H;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(outTextPatchX, outTextPatchY, outTextPatchW, outTextPatchH);

      const outCenterX = nx + 0.866 * W;
      ctx.font = '700 7.4px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#2B2E33';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`1 ${rawOreName}`, outCenterX, ny + 0.482 * H);

      ctx.font = '700 6.5px "Plus Jakarta Sans", sans-serif';
      const rateNumStr = `${outTargetRate} `;
      const rateUnitStr = 'per minute';
      const rateNumW = ctx.measureText(rateNumStr).width;
      ctx.font = '500 6.5px "Plus Jakarta Sans", sans-serif';
      const rateUnitW = ctx.measureText(rateUnitStr).width;
      const rateStartX = outCenterX - (rateNumW + rateUnitW) * 0.5;

      ctx.textAlign = 'left';
      ctx.font = '700 6.5px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#D9822B';
      ctx.fillText(rateNumStr, rateStartX, ny + 0.538 * H);
      ctx.font = '500 6.5px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#1E293B';
      ctx.fillText(rateUnitStr, rateStartX + rateNumW, ny + 0.538 * H);

      // 3. BOTTOM CHAMFERED WHITE CLOCK SPEED PANEL LIVE OVERLAY (0% to 250%)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(nx + 0.064 * W, ny + 0.712 * H, 0.392 * W, 0.104 * H);
      ctx.fillRect(nx + 0.064 * W, ny + 0.812 * H, 0.718 * W, 0.118 * H);

      const ocTextX = nx + 0.068 * W;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = '700 7.4px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#0F172A';
      ctx.fillText(`Clock Speed: ${clockPct}%`, ocTextX, ny + 0.741 * H);

      ctx.font = '500 6.8px "Plus Jakarta Sans", sans-serif';
      const tprPrefix = 'Target production rate: ';
      ctx.fillStyle = '#1E293B';
      ctx.fillText(tprPrefix, ocTextX, ny + 0.788 * H);
      const tprPrefixW = ctx.measureText(tprPrefix).width;
      ctx.font = '700 6.8px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#D9822B';
      ctx.fillText(`${outTargetRate} per min`, ocTextX + tprPrefixW, ny + 0.788 * H);

      const segBarX = nx + 0.068 * W;
      const segBarY = ny + 0.819 * H;
      const segBarW = 0.709 * W;
      const segBarH = 0.064 * H;

      const segBounds = [
        { start: 0, end: 50 },
        { start: 50, end: 100 },
        { start: 100, end: 150 },
        { start: 150, end: 200 },
        { start: 200, end: 250 },
      ];
      for (const seg of segBounds) {
        const sx = segBarX + (seg.start / 250) * segBarW;
        const sw = ((seg.end - seg.start) / 250) * segBarW - 1.3;
        ctx.fillStyle = '#484A4E';
        ctx.fillRect(sx, segBarY, Math.max(1, sw), segBarH);

        if (clockPct > seg.start) {
          const fillPct = Math.min(seg.end, clockPct) - seg.start;
          const fw = (fillPct / 250) * segBarW - (clockPct >= seg.end ? 1.3 : 0);
          if (fw > 0) {
            ctx.fillStyle = '#E58824';
            ctx.fillRect(sx, segBarY, fw, segBarH);
          }
        }
      }

      ctx.font = '600 5.8px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#0F172A';
      ctx.textBaseline = 'top';
      const tickLabelY = segBarY + segBarH + 1.5;
      ctx.textAlign = 'left';
      ctx.fillText('0%', segBarX, tickLabelY);
      ctx.textAlign = 'center';
      ctx.fillText('100%', segBarX + (100 / 250) * segBarW, tickLabelY);
      ctx.fillText('150%', segBarX + (150 / 250) * segBarW, tickLabelY);
      ctx.fillText('200%', segBarX + (200 / 250) * segBarW, tickLabelY);
      ctx.textAlign = 'right';
      ctx.fillText('250%', segBarX + segBarW, tickLabelY);

      // 4. EXTERIOR STANDBY ROCKER SWITCH LIVE STATE (keeps Media item 1 housing & look, flips rocker when STANDBY is active)
      if (isStandby) {
        const swX = nx + 0.835 * W;
        const swY = ny + 0.772 * H;
        const swW = 0.102 * W;
        const swH = 0.096 * H;

        // Inner recessed switch cavity
        drawRoundedRect(ctx, swX, swY, swW, swH, 2.5);
        ctx.fillStyle = '#181A1D';
        ctx.fill();

        // Left raised 3D metallic rocker half (flipped to left when in STANDBY)
        const tabW = swW * 0.46;
        const tabGrad = ctx.createLinearGradient(swX + 1, swY + 1, swX + tabW, swY + swH - 1);
        tabGrad.addColorStop(0, '#5A5E66');
        tabGrad.addColorStop(0.5, '#3E4248');
        tabGrad.addColorStop(1, '#26292E');
        drawRoundedRect(ctx, swX + 1, swY + 1, tabW, swH - 2, 2);
        ctx.fillStyle = tabGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 0.7;
        ctx.stroke();

        // Right depressed glowing red/amber STANDBY side with horizontal LED bar
        const rightX = swX + tabW + 1;
        const rightW = swW - tabW - 2;
        const glowGrad = ctx.createLinearGradient(rightX, swY + 1, rightX + rightW, swY + 1);
        glowGrad.addColorStop(0, '#451A1C');
        glowGrad.addColorStop(1, '#991B1B');
        drawRoundedRect(ctx, rightX, swY + 1, rightW, swH - 2, 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();

        // Glowing horizontal STANDBY indicator slit on right half
        ctx.fillStyle = '#FCA5A5';
        ctx.fillRect(rightX + 2.5, swY + swH * 0.5 - 1, Math.max(3, rightW - 5), 2);
      }

      ctx.restore();

      drawRoundedRect(ctx, nx, ny, W, H, 8);
      ctx.strokeStyle = isDraggedColliding
        ? '#EF4444'
        : isSelected
        ? '#F59E0B'
        : '#27292E';
      ctx.lineWidth = isDraggedColliding ? 3.2 : isSelected ? 2.4 : 1.4;
      ctx.stroke();

      if (isDraggedColliding) {
        ctx.save();
        drawRoundedRect(ctx, nx, ny, W, H, 8);
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
        ctx.fillText(`${port.actualRatePerMin}/m`, textRightX, pt.y + 7);
      } else {
        ctx.font = '600 10.5px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#F8FAFC';
        ctx.fillText(port.label, textRightX, pt.y);
      }
    }
  }
}
