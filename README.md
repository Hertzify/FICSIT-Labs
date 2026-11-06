# FICSIT Labs

A fast, touch-friendly 2D factory automation tycoon built with React and HTML5 Canvas, inspired by Satisfactory.

![Version](https://img.shields.io/badge/version-0.0.1%20Initial%20Release-F59E0B?style=flat-square)
![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Mobile%20%7C%20Desktop%20%7C%20PWA-38BDF8?style=flat-square)

---

## Features

- **Satisfactory Factory Loop**: Natural resource deposits with purity modifiers, Miners, Smelters, Constructors, Assemblers, Splitters, and Mergers.
- **Authentic Machine GUI**: Direct overclocking (1%–250%), manual clock speed & item rate inputs, Power Shard slots, and Pioneer Inventory with sort/trash actions.
- **2D Conveyor Physics**: Discrete item simulation with backpressure, tight 1.2m item spacing, filleted 90° corners, and automated overpass crossings.
- **Touch-First Controls**: Mobile landscape layout, magnetic port/center snap lines, tap-to-wire, and 90° corner waypoints.
- **High Performance**: Decoupled 20 Hz simulation tick and 60 FPS Canvas rendering with viewport culling and low-end battery saver options.
- **Offline PWA & Saves**: Playable offline, installable to home screen, auto-saving, and human-readable JSON save export/import.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)

### Development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` in your browser.

### Build

```bash
npm run build
```

---

## Controls

| Action | Mobile Gesture | Mouse / Keyboard |
| :--- | :--- | :--- |
| **Pan** | Single finger drag | Middle click drag or Move tool drag |
| **Zoom** | Pinch to zoom / double-tap drag | Mouse wheel |
| **Connect Ports** | Drag from port or tap-to-wire | Click and drag port / Click-to-click |
| **Dismantle** | Selection action bar / Trash button | `Delete` or `Backspace` key |
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
