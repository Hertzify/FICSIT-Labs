# FICSIT Labs — `0.0.3 Initial Release`

- **1:1 Godot 4 Canvas & UI Parity**: Rewrote `SectorWorld.gd` and `HUDController.gd` to match the web renderer 1:1 (topographic ridge contours, geological resource deposits, conveyor belts with overpass bridges & rounded item boxes, Miner Mk.1 chassis card, and responsive `StyleBoxFlat` modal layouts).
- **Android Touch Button Fix**: Enabled `pointing/emulate_mouse_from_touch=true` in `project.godot` so all Godot `Control` buttons, sliders, and text inputs respond reliably to mobile touchscreens.
- **Persistent Android APK Signing & In-Place Updates**: Replaced per-run random key generation with a persistent repository signing certificate (`godot/android/debug.keystore`) and auto-incrementing `version/code` so new APK releases update cleanly over existing installations without uninstalling.

---
*Full changelog in [`CHANGELOG.md`](./CHANGELOG.md)*
