# FICSIT Labs

**FICSIT Labs** is a 2D factory automation tycoon for **Android (Landscape)** and **Web**, combining the deep production chains, resource purities, and conveyor belt physics of ***Satisfactory*** with a clean node-graph interface inspired by ***Upload Labs***.

![Version](https://img.shields.io/badge/version-0.0.14%20dev%20build-F59E0B?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Android%20%7C%20Web-38BDF8?style=flat-square)
![Engine](https://img.shields.io/badge/engine-React%20%2B%20HTML5%20Canvas-22C55E?style=flat-square)

---

## Quick Highlights

- **Real Conveyor Physics**: Resources physically march on belts in tight queues (`1.2m` spacing). Distance matters: machines wait for items to arrive over long conveyor runs.
- **6 Conveyor Tiers**: Mk.1 (`60/m`) up to Mk.6 (`1,200/m`) with live telemetry badges (`[Belt Icon] Mk.2 · 60/120`).
- **Scattered Resource Nodes**: 32 natural deposits (Iron, Copper, Limestone) scattered across a `12,000 × 8,000` map with Impure (`30/m`), Normal (`60/m`), and Pure (`120/m`) qualities.
- **Smooth Google Maps-Style Zoom**: Pinch, wheel, or double-tap to zoom. Seamlessly transitions into clean macro icon boxes when zooming out past `0.25x`.
- **Widescreen Landscape**: Optimized for mobile and desktop with immersive fullscreen and touch-friendly controls.

---

## Conveyor Belt Tiers

| Tier | Max Capacity | Belt Speed | Primary Item |
| :--- | :--- | :--- | :--- |
| **Conveyor Belt Mk.1** | **60** / min | `1.2 m/s` | Iron Plate |
| **Conveyor Belt Mk.2** | **120** / min | `2.4 m/s` | Reinforced Iron Plate |
| **Conveyor Belt Mk.3** | **270** / min | `5.4 m/s` | Steel Beam |
| **Conveyor Belt Mk.4** | **480** / min | `9.6 m/s` | Encased Industrial Beam |
| **Conveyor Belt Mk.5** | **780** / min | `15.6 m/s` | Aluminum Casing |
| **Conveyor Belt Mk.6** | **1,200** / min | `24.0 m/s` | Fused Modular Frame |

---

## Resource Node Purity

| Quality | Base Output (Miner Mk.1) | Map Pin Color | Recommended Belt |
| :--- | :--- | :--- | :--- |
| **Impure** | **30** / min | Red (`#EF4444`) | Belt Mk.1 |
| **Normal** | **60** / min | Orange (`#F97316`) | Belt Mk.1 |
| **Pure** | **120** / min | Green (`#22C55E`) | Belt Mk.2+ |

---

## Controls

- **Pan**: Click / touch and drag empty ground.
- **Zoom**: Pinch, mouse wheel, or double-tap-and-drag.
- **Connect / Belt**: Tap and drag between machine ports to run conveyor belts.
- **Build Menu**: Press `[Q]` or tap the Build button in the bottom HUD.
- **Inspect Machine**: Tap any placed machine to inspect recipe, efficiency, and upgrade attached belts.

---

## Changelog

For the full list of updates and patch notes, see [`CHANGELOG.md`](./CHANGELOG.md).
