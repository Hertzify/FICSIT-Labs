# FICSIT Node Labs — Step 1: Main Menu, Save System, Settings & Build Menu

A 2D landscape widescreen Android adaptation of *Satisfactory* with an *Upload Labs*-inspired node interface. **Step 1** focuses strictly on the foundational pillars you selected: a *Satisfactory*-style **Main Menu with Save Slots & Auto-Save**, the **Settings Menu** with your exact chosen options, an **Infinite Pan/Zoom Node Canvas**, **Machine Node Cards**, and a **Satisfactory × Upload Labs Build Menu**—leaving HUD bars and overclocking for future steps after we discuss them.

## User Review & Confirmed Step 1 Scope

> [!IMPORTANT]
> Every feature in this plan directly reflects your selections. Unrequested HUD bars, overclock sliders, and FPS counters have been excluded so we build cleanly step by step.

- **Confirmed Main Menu & Save Slots**: *Satisfactory*-style Main Menu featuring **Continue** (latest save), **New Game** (name your session), **Load Game** (multi-slot save browser with manual & auto-save slots), and **Settings**, plus a setting to **Skip Main Menu directly to the latest save** on startup.
- **Confirmed Settings Menu Options**:
  1. **Conveyor Line Style**: Curved Bezier vs. 90-Degree Orthogonal lines.
  2. **Grid Snapping & UI Scale**: Snap-to-grid toggle + UI scale slider (`85%`–`115%`).
  3. **Port Item Rate Numbers Toggle**: Show or hide the `items/min` rate numbers next to node input/output port dots.
  4. **Touch Wiring Mode**: Drag-to-connect vs. Tap-Output-then-Tap-Input.
  5. **Startup Behavior**: Toggle to **Skip Main Menu directly to latest save**.
  6. **Audio & Haptics**: Master & SFX volume sliders + Android Haptic Vibration toggle.
  7. **Save & Data Management**: Auto-Save toggle/interval, Save Export/Import (JSON string), and Factory Reset button.
- **Confirmed Build Menu (HUD Deferred)**: No extra top/bottom HUD telemetry bars yet (we will design the HUD together in a later step). In-game workspace has only two minimal corner triggers (**Build Menu** and **Pause / Main Menu**) plus the **Satisfactory × Upload Labs Build Menu** modal optimized for Android landscape touch.
- **Confirmed Node Card Anatomy**:
  - Machine Name Header & Active Recipe Label.
  - Input & Output Port Dots with toggleable `items/min` rate numbers.
  - Animated Crafting/Extraction Progress Bar.
  - Status & Efficiency percentage badge (*Overclocking is intentionally excluded until we unlock it in a later step*).

---

## 1. User Experience & Visual Design (Step 1)

### Key User Flows

1. **Startup & *Satisfactory*-Style Main Menu**:
   - On launch, if **"Skip Main Menu to Latest Save"** is enabled in Settings and a save exists, the game boots straight into your active factory workspace.
   - Otherwise, it opens the widescreen **Main Menu** featuring an ambient animated node-pipeline background on the right and *Satisfactory*'s signature left-aligned vertical command menu:
     - **Continue**: Immediately loads the most recent manual or auto-save slot.
     - **New Game**: Prompts for a Factory Session Name and initializes a fresh canvas save slot.
     - **Load Game**: Opens the **Save Slot Browser** showing your sessions and individual saves (Manual Saves & Rolling Auto-Saves with timestamps, session name, and machine count), with **Load**, **Delete**, and **Duplicate/Export** actions.
     - **Settings**: Opens the Settings panel directly from the Main Menu.
2. **Satisfactory × Upload Labs Build Menu (Android Landscape Optimized)**:
   - Tapping the **Build** button (or pressing `Q` / `B`) opens a sleek dark-mode Build Window combining *Satisfactory*'s category architecture with *Upload Labs*' modular node aesthetic:
     - **Top Category Tabs**: `Special`, `Production`, `Logistics`, `Organization`.
     - **Subcategory & Machine Grid (Left/Center)**: Grouped rows (e.g., *Extractors*: Miner Mk.1; *Smelters*: Smelter; *Manufacturers*: Constructor; *Storage*: Storage Container; *Resource Deposits*: Iron, Copper, Limestone Nodes for testing).
     - **Node Blueprint Inspector (Right Panel)**: Displays the selected machine's node-card preview, input/output port layout, base crafting speed, and a thumb-friendly **Place on Canvas** button.
3. **Node Card Interaction & Port Wiring on Canvas**:
   - **Pan & Zoom**: Smooth 1-finger pan (when tapping empty canvas) and pinch/wheel zoom across the dark blueprint grid.
   - **Moving & Configuring Nodes**: Dragging a node card moves it (snapping to grid if enabled). Tapping a node opens a compact recipe/action popover to pick its recipe (e.g., Iron Ingot, Copper Ingot, Iron Plate, Iron Rod, Wire, Concrete) or dismantle it.
   - **Wiring Conveyors**: Depending on your Settings choice, either **drag** from an Output port dot to an Input port dot, or **tap** an Output port dot and **tap** an Input port dot to connect them with a Curved or 90-Degree conveyor line. Tapping an existing line lets you disconnect it.

### Visual Identity & Theme

- **Aesthetic Direction**: *Upload Labs* dark-mode window nodes paired with *Satisfactory*'s FICSIT industrial amber/slate hierarchy.
- **Color Palette (60-30-10)**:
  - **60% Blueprint Canvas (`#0B0F17`)**: Deep obsidian grid with subtle minor (`#151E2E`) and major (`#1E293B`) coordinate lines.
  - **30% Node Cards & Menus (`#131B2E` surface, `#26334D` 1px border)**: Clean dark-slate modular window cards with `#F8FAFC` crisp text and `#94A3B8` technical labels.
  - **10% Industrial Accents**: FICSIT Amber (`#F59E0B`) for active categories, primary actions, and progress bars; Cyan (`#06B6D4`) and Emerald (`#10B981`) for port sockets and `100% OPTIMAL` status readouts.
- **Typography**:
  - `Outfit` for Main Menu headers, Build Menu category tabs, and Node Card titles.
  - `Plus Jakarta Sans` for settings labels and descriptions.
  - `JetBrains Mono` (`tabular-nums`) for port `items/min` rates, efficiency percentages, and save timestamps.

---

## 2. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   FICSIT NODE LABS — STEP 1 SHELL (App)                     │
│  Screen State: 'title' (Main Menu) | 'playing' (Canvas) | 'paused'          │
│  Startup Check: If settings.skipMainMenu && latestSave -> boot to 'playing' │
└───────────────────┬─────────────────────────────────────┬───────────────────┘
                    │                                     │
                    ▼                                     ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────────┐
│   60 FPS NODE & CONVEYOR CANVAS       │ │   MENUS & MODALS (React Overlays) │
│  (HTML5 2D Canvas + Touch Gestures)   │ │  (UI Scale Applied via CSS Var)   │
├───────────────────────────────────────┤ ├───────────────────────────────────┤
│ • Infinite Pan/Zoom Blueprint Grid    │ │ • Satisfactory-Style Main Menu    │
│ • Node Card Renderer:                 │ │   (Continue, New, Load, Settings) │
│   - Header + Recipe Name              │ │ • Multi-Slot Save Manager Modal   │
│   - Input/Output Port Dots            │ │   (Manual Slots + Auto-Save Timer)│
│   - Optional Port Rate Numbers        │ │ • Satisfactory x Upload Labs      │
│   - Animated Progress Bar             │ │   Build Menu (Categories + Grid)  │
│   - Status + Efficiency % Badge       │ │ • Node Recipe & Action Popover    │
│ • Conveyor Line Renderer:             │ │ • Settings Modal (7 Confirmed     │
│   - Curved Bezier OR 90° Orthogonal   │ │   Controls + Export/Import/Reset) │
└───────────────────┬───────────────────┘ └─────────────────┬─────────────────┘
                    │                                       │
                    └───────────────────┬───────────────────┘
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              SAVE SLOT & SETTINGS ENGINE (localStorage)                     │
│ • SettingsStore: lineStyle, gridSnap, uiScale, showPortRates, wiringMode,   │
│                  skipMainMenu, masterVol, sfxVol, haptics, autoSaveEnabled  │
│ • SaveSlotStore: slots[] (id, sessionName, kind: 'manual'|'autosave',       │
│                  updatedAt, nodes[], connections[], cameraState)            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Interactive Component & State Mapping

- **Main Menu & Save Manager**:
  - `Continue` loads `SaveSlotStore.getLatestSlot()`.
  - `New Game` creates a new session with an initial save slot and enters the canvas.
  - `Load Game` lists all saved slots sorted by most recent; clicking `Load` hydrates `nodes`, `connections`, and `camera` into the canvas engine.
  - `Auto-Save Timer` runs in the background during `'playing'` state (every 30s when enabled), updating the session's `autosave` slot non-intrusively.
- **Settings Persistence & Live Reactivity**:
  - Toggling **Conveyor Line Style** (`Curved` vs. `90-Degree`) or **Show Port Rate Numbers** (`On` vs. `Off`) immediately updates the canvas renderer on the next frame.
  - Adjusting **UI Scale** updates the root `--ui-scale` multiplier across menus and popovers.
  - **Haptic Vibration** triggers `navigator.vibrate?.(12)` (when supported on Android) on port connection, grid snap, and building placement, paired with Web Audio synth clicks.
