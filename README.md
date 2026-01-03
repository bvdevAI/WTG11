# Web Swing (Arcade) — Portrait (Three.js + Rapier)

A mobile-first, installable web prototype inspired by Spider-Man-style swinging (no IP, no assets).

## Features
- 3D procedural city (instanced buildings + colliders)
- Capsule player controller (run/jump/air control)
- Arcade web-swing: attach → reel → swing → tap to release
- Portrait-friendly HUD + touch controls
- Desktop controls supported

## Controls
### Mobile (portrait)
- Left joystick: move
- Right side: tap to attach / tap again to detach
- Right side drag up/down: reel in/out
- Buttons: Reset, Camera

### Desktop
- WASD / Arrow keys: move
- Space: jump
- Left mouse: attach/detach
- Mouse wheel: reel in/out

## Run
```bash
npm install
npm run dev
```

Open the dev server URL on your phone (same Wi‑Fi) for real mobile testing.

## Notes
- This is "Option A" arcade swing: forgiving constraint + assist so it feels good quickly.
- Next upgrades: wall-run, ring checkpoints, stunt score, better animations.
