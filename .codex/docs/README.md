# Robot Three.js knowledge base

This directory describes the behavior that is implemented in the repository. It is written for coding agents that need to extend the game without rediscovering its runtime contracts.

## Reading order

Start with [architecture.md](architecture.md) for the system boundary and invariants, then read only the document relevant to the task:

- [server-gameplay.md](server-gameplay.md): authoritative simulation and gameplay rules.
- [client-runtime.md](client-runtime.md): rendering, prediction, animation, assets, VFX, camera, and HUD.
- [network-protocol.md](network-protocol.md): WebSocket messages, sequencing, snapshots, and reconciliation.
- [development.md](development.md): commands, dependencies, ports, tests, and change verification.

## Source-of-truth order

When documents disagree with implementation, trust sources in this order:

1. Executable code and tests.
2. This knowledge base.
3. `PLAN.md` and `PLAN2.md`.

The plan files are learning roadmaps. They can describe future work that is not implemented and must not be treated as runtime documentation.

## Current product slice

The repository implements a small server-authoritative multiplayer survival game:

- Browser client built with Vite and Three.js.
- Node.js WebSocket simulation using `ws`.
- One in-memory room with three timed waves followed by an untimed boss phase.
- WASD movement with client prediction and server reconciliation.
- Enemies, three server-authoritative weapons, automatic shooting, bullets,
  damage, coins, HUD, smoothed camera feedback, CC0 audio assets, a
  static low-poly environment, animated GLB player and near-enemy models,
  instanced distant-enemy/projectile/coin rendering, pooled particle VFX,
  server spatial indexing, critical hits, floating combat feedback, local kill
  combos, latency display, automatic socket reconnection, a server-owned wave
  schedule, and a giant animated boss with telegraphed attack states.

There is currently no database, persistence, authentication, room selection,
session resume, physics engine, React UI, or deployment configuration.

## Keeping knowledge current

Use the project-local `$update-knowledge` skill after changes that affect architecture, behavior, protocol fields, invariants, commands, tests, assets, or known limitations.
