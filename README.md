# FICSIT Labs

A fast, touch-friendly 2D factory automation tycoon powered by **Godot Engine 4 (GDScript + OpenGL ES 3 Compatibility)** for low-end Android devices, with a companion interactive web build.

![Version](https://img.shields.io/badge/version-0.0.3%20Initial%20Release-F59E0B?style=flat-square)
![Engine](https://img.shields.io/badge/engine-Godot%204.3%20%28GDScript%20%2B%20GLES3%29-478CBF?style=flat-square)
![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Android%20APK%20%7C%20Desktop%20%7C%20Web-38BDF8?style=flat-square)

---

## Features

- **Native Godot 4 Engine (`/godot`)**: Built in statically-typed GDScript 2.0 using the lightweight OpenGL ES 3 (`gl_compatibility`) renderer for locked 60 FPS performance on low-end Android phones with zero WebView overhead.
- **Satisfactory Factory Loop**: 32 natural resource deposits with purity modifiers (`Impure`, `Normal`, `Pure`), Miner Mk.1, Smelter, Constructor, Assembler, Splitter, Merger, Storage Container, and The HUB.
- **Authentic Machine GUI**: Direct overclocking (`1%–250%`), manual clock speed `%` & target items/min inputs, manual Power Shard slots, exterior Miner Standby switch, and a 45-slot Pioneer Inventory (`9×5`) with Sort and Trash actions.
- **2D Conveyor Physics**: Deterministic 20 Hz discrete item simulation with backpressure, tight 1.2m (18px) item spacing, orthogonal 90° routing, and interactive corner waypoints.
- **Cross-Compatible Saves**: Export and import human-readable JSON saves seamlessly between the native Godot Android APK and the companion web build.

---

## Getting Started

### 1. Native Godot 4 Engine (Android & Desktop)

Open the `/godot/project.godot` file in **Godot Engine 4.3+**:

```bash
# Run directly with Godot 4 CLI
godot --path ./godot

# Export Native Android APK (GLES3 Compatibility)
godot --headless --path ./godot --export-debug "Android" ../ficsit-labs-0.0.3.apk
```

*Note: Pushing to `main` automatically compiles and publishes `ficsit-labs-0.0.3.apk` via GitHub Actions (`.github/workflows/android-release.yml`).*

### 2. Companion Web Preview

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## Controls

| Action | Mobile Gesture | Mouse / Keyboard |
| :--- | :--- | :--- |
| **Pan** | Single finger drag | Left/Middle drag or Move tool drag |
| **Zoom** | Two-finger pinch zoom | Mouse wheel (`0.06x` – `1.85x`) |
| **Connect Ports** | Drag from port or tap-to-wire | Click and drag port / Click-to-click |
| **Dismantle** | Inspector Dismantle / Trash button | `Delete` or `Backspace` key |
| **Undo / Redo** | Toolbar Undo / Redo buttons | `Ctrl+Z` / `Ctrl+Y` (`Cmd+Z` / `Cmd+Shift+Z`) |

---

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md) for release history and patch notes.

---

## Acknowledgements & Inspirations

- **Satisfactory**: Factory mechanics, machine tiers, recipe trees, and lore inspired by *Satisfactory* by Coffee Stain Studios.
- **Upload Labs**: 2D canvas node interface style and dark schematic layout inspired by *Upload Labs*.

---

## License & Legal Disclaimer

- **Source Code**: Licensed under the [GNU General Public License v3.0 (GPLv3)](./LICENSE).
- **Fan Tribute**: FICSIT Labs is an unofficial, non-commercial fan project built for educational and community enjoyment.
- **Trademarks & Assets**: "Satisfactory", "FICSIT", associated machine names, and official game icons are trademarks and copyrighted property of Coffee Stain Studios AB / Embracer Group. This project is not affiliated with or endorsed by Coffee Stain Studios or Upload Labs.
