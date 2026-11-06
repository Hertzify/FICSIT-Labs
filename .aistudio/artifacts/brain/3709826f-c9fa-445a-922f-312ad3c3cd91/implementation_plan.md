# Authentic Satisfactory Machine GUIs, Pioneer Inventory & 250% Overclocking Plan

## 1. Visual & Functional Architecture

### A. Authentic Satisfactory Overclocking System (1% – 250%)
In *Satisfactory*, Overclocking is controlled by the **Overclock** panel at the bottom of every production and extraction building:
- **Base Clock Range (`1% – 100%`)**: Available by default with **0 Power Shards** installed.
- **3 Power Shard Slots (`+50%` per shard up to `250%`)**:
  - **Slot 1 (`1/1` Power Shard)**: Unlocks up to **`150%`** clock speed.
  - **Slot 2 (`1/1` Power Shard)**: Unlocks up to **`200%`** clock speed.
  - **Slot 3 (`1/1` Power Shard)**: Unlocks up to **`250%`** clock speed.
- **Segmented Progress Bar**: Divided into 4 proportional sections with tick labels at **`0%`**, **`100%`**, **`150%`**, **`200%`**, and **`250%`**.
  - Filled in FICSIT orange (`#E59329`) up to the active clock speed.
  - Unfilled unlocked segments render in dark slate (`#585A5E`), while locked shard segments above `(100 + powerShards * 50)%` render in light grey (`#D2D4D6`).
- **Official Scaling Formulas**:
  - **Target Production Rate**: Scales linearly with clock speed:
    $$\text{Rate} = \text{Base Rate} \times \left(\frac{\text{Clock Speed}}{100}\right)$$
  - **Cycle Duration**: Scales inversely with clock speed:
    $$\text{Cycle Time (sec)} = \frac{\text{Base Cycle Time}}{\text{Clock Speed} / 100}$$
  - **Power Consumption (`MW`)**: Scales exponentially per *Satisfactory* 1.0 formula:
    $$\text{Power (MW)} = \text{Base MW} \times \left(\frac{\text{Clock Speed}}{100}\right)^{1.321928}$$
    *(e.g., `100%` = `1.00× MW`, `150%` = `1.71× MW`, `200%` = `2.50× MW`, `250%` = `3.36× MW`)*.

---

### B. Exterior 2D Canvas UI — Miner Mk.1 Only (`canvasRenderer.ts`)
- Apply the **Media Item 1** brushed-steel industrial layout **exclusively to `Miner Mk.1` (`miner_mk1`)** on the 2D canvas (leaving other buildings' canvas cards unchanged for now):
  - **Brushed Steel Chassis (`#686B70`)**: Corner Phillips screws, dark bevels, and top-right **Machine Status Indicator Light** (Green = operating normally, Yellow = output full / backpressured, Red = standby / paused).
  - **Top-Left Ribbed Metallic Drum**: Horizontal metallic ribs framed by vertical chrome cylinders.
  - **Top-Center Dark Screwed Telemetry Module (`#141517`)**:
    - `Mining` header + read-only telemetry row: **`⚡ MW`** (scaled by clock speed), **`⏱ sec`** (scaled cycle time), and **`📶 %`** (rolling-average `avgEfficiency`).
    - Bottom circular notch with a white downward triangle (`▼`).
  - **Top-Right Crisp White `[ OUTPUT ]` Card (`#FFFFFF`)**:
    - Rounded grey square (`#D9D9D9`) containing the original 3D ore PNG icon (`/icons/items/*.png`) + live orange bottom-right item count badge (`97`) that counts cleanly without a filling bar on the canvas.
    - Bold item title (`1 Iron Ore`), orange target rate (`60 per minute`), and bottom **`[ OUTPUT ]`** capsule label.
  - **Bottom Overclock Readout Bar (Corrected to `250%`)**:
    - Displays read-only **`Clock Speed: 100%`** and **`Target production rate: 60 per min`**.
    - Segmented bar showing **`0%`**, **`100%`**, **`150%`**, **`200%`**, and **`250%`** (replacing the old `200%` cap in the mockup image), plus the bottom-right **`STANDBY`** indicator switch.

---

### C. Interior Popup Window — Exact Miner & Smelter/Processor GUIs + Pioneer Inventory (`NodeInspectorPanel.tsx`)
When tapping any machine to open its UI (`NodeInspectorPanel.tsx`), render the authentic two-column *Satisfactory* modal window:

1. **Left Column — Authentic Machine GUI**:
   - **Window Title Bar**: `[ ⊞ Select Recipe | 🔨 Production ]` tabs for recipe machines (Smelter, Constructor, Assembler) or `[ 🗔 Miner ]` title for Miners, with top-right `[ X ]` close button.
   - **Miner Layout (`miner_mk1`)**:
     - Brushed-steel housing (`#686B70`) with 4 corner screws and left ribbed metallic drum between chrome collars.
     - Center-right dark screwed telemetry box (`#141517`) with live orange extraction bar (`Mining - XX%`), `⚡ MW | ⏱ sec | 📶 %`, and circular `▼` notch overlapping the white `OUTPUT` card (`1 Iron Ore`, `XX per minute`, `[ OUTPUT ]` pill).
   - **Smelter / Constructor / Assembler Layout**:
     - Top full-width dark `Recipe:` banner (`#18181A`) with orange `Recipe:` subtitle and bold white recipe title (plus inline recipe selector when clicking `Select Recipe`).
     - **3-Column Core**:
       - **Left White `INPUT` Card (`#FFFFFF`)**: Input item slot(s) with 3D PNG icon, orange `stored/required` badge (`2/1`), item name, `XX per minute`, and bottom `[ INPUT ]` pill.
       - **Center Dark Screwed Module (`#1A1B1E`)**: 3D output icon preview, orange progress bar, `Constructing - XX%`, `⚡ MW`, `⏱ sec`, `📶 %`, and left/right circular `[ ▶ ]` flow connectors.
       - **Right White `OUTPUT` Card (`#FFFFFF`)**: Output item slot with 3D PNG icon, orange count badge, item name, `XX per minute`, and bottom `[ OUTPUT ]` pill.
   - **Lower `OVERCLOCK` & `MULTIPLIER` Section**:
     - Left glowing orange vertical side vents (`|||`).
     - White `OVERCLOCK` card (`Clock Speed: XXX%`, `Target production rate: XXX per min`, **3 interactive Power Shard slots** (`[1/1]` / `[ 1 ]`) that toggle shards in/out to unlock `150%`, `200%`, and `250%`, interactive **`0% — 100% | 150% | 200% | 250%`** slider, and bottom `[ OVERCLOCK ]` pill).
     - Right `MULTIPLIER` / Belt Tier module (`Output Multiplier: x1`) + right glowing orange vertical side vents (`|||`).
   - **Bottom Control Footer**:
     - Left stacked `[ 📋 Copy Settings ]` and `[ 📋 Paste Settings ]` buttons (plus compact Unwire/Dismantle utility buttons).
     - Right glowing orange/red `[ STANDBY ]` rocker switch that pauses/resumes the machine.

2. **Right Column — Pioneer Player Inventory Sidebar**:
   - **`Relevant Items:`** top row displaying items relevant to the open machine (e.g., Power Shards, input/output ores, ingots, and parts from the factory storage/buffers with live orange count badges).
   - **`All Items:`** **9-column × 5-row grid (45 square slots)**:
     - Populated slots use `#D9D9D9` bevels with original 3D item PNG icons and bottom-right orange quantity badges (`#E59329`).
     - Empty slots use dark translucent `#2A2C30` squares with subtle borders.
     - Tapping a Power Shard in the inventory or in the Overclock slots installs/removes it (`0..3` shards).
   - **Bottom Inventory Bar**:
     - Left **`[ ↓≡ Sort ]`** button that sorts the inventory items by category/quantity.
     - Right **`[ 🗑️ ]`** Trash slot to clear/flush selected or buffered items.

---

## 2. File-Level Implementation Steps

1. **`/src/game/types.ts` & `/src/game/catalog.ts`**:
   - Add `clockSpeedPct?: number` (`1..250`, default `100`), `powerShards?: number` (`0..3`, default `0`), and `isStandby?: boolean` (default `false`) to `MachineNode`.
   - Add `powerMW: number` to `BuildingDef` in `catalog.ts` (`miner_mk1: 5`, `smelter: 4`, `constructor: 4`, `assembler: 15`, others `0`).
   - Add helper functions `getMaxClockSpeed(powerShards)` (`100 + Math.min(3, Math.max(0, powerShards)) * 50`) and `getScaledPowerMW(baseMW, clockSpeedPct, isStandby)`.
2. **`/src/game/simulation.ts`**:
   - Update `stepSimulation` so `miner_mk1` and recipe processors honor `node.isStandby` (pauses production and sets `currentRate = 0`) and scale extraction/crafting speeds and target rates by `(node.clockSpeedPct ?? 100) / 100` (up to `250%`).
3. **`/src/components/canvasRenderer.ts`**:
   - Add a dedicated renderer for `Miner Mk.1` (`node.buildingId === 'miner_mk1'`) matching `Media item 1` with the corrected **`0% — 100% | 150% | 200% | 250%`** Overclock bar, live item count badge (`97`) without a canvas progress bar fill, and Red/Yellow/Green status indicator light. Keep other buildings' canvas node rendering untouched.
4. **`/src/components/NodeInspectorPanel.tsx` & `/src/App.tsx`**:
   - Rebuild `NodeInspectorPanel.tsx` with the authentic *Satisfactory* Miner & Smelter/Processor left panel (`Select Recipe` / `Production` tabs, `OVERCLOCK` up to `250%` with 3 Power Shard slots, `Copy/Paste Settings`, `STANDBY` switch) and the right-side **Pioneer Player Inventory** (`Relevant Items:`, 9×5 `All Items:` grid, `Sort`, and `Trash`).
5. **Unit Tests & Verification (`/src/game/rules.test.ts`)**:
   - Add tests verifying 1%–250% Overclocking (1, 2, and 3 Power Shards unlocking 150%, 200%, and 250%), linear production rate scaling (`2.5×` at `250%`), exponential power formula, and Standby mode.
