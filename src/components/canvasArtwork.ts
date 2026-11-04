import { PURITY_CONFIG } from '../game/catalog';
import { MachineNode } from '../game/types';

export const TOPOGRAPHIC_RIDGE_CENTERS = [
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
export function drawNaturalResourceDeposit(
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
    ? '#D97706'
    : isLimestone
    ? '#94A3B8'
    : '#475569';
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
