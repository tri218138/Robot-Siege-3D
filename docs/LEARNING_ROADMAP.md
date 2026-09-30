# Learning Roadmap

Robot Survivor Three.js is an incremental learning project rather than a
production game. Each stage introduces one group of browser-game concepts while
keeping the playable loop small enough to understand and test.

## Foundations

- Create a Three.js scene, camera, renderer, lights, materials, and game loop.
- Add a compact map and keyboard-controlled player movement.
- Spawn enemies and steer them toward the nearest player.
- Add automatic targeting, projectiles, damage, health, and coins.
- Build a clear HUD for health, time, score, weapons, and connection state.

## Real-Time Multiplayer

- Use a server-authoritative simulation for players, enemies, bullets, and coins.
- Send input over WebSockets and broadcast compact state snapshots.
- Interpolate remote entities and handle disconnects and reconnects.
- Bound input queues and buffered network data to keep the simulation stable.

## Game Feel and Presentation

- Replace primitives with animated GLTF characters and environment models.
- Add idle, movement, death, boss, and weapon feedback states.
- Use particles, floating damage, camera shake, hit stop, and sound effects.
- Structure waves so that pacing builds toward a distinct boss encounter.
- Make the HUD readable on both desktop and smaller screens.

## Performance

- Reuse geometry and materials instead of allocating them every frame.
- Render repeated objects with instanced meshes.
- Use a spatial grid to reduce broad enemy and projectile searches.
- Animate only the nearest detailed enemies and render distant proxies.
- Compress runtime GLTF files and keep original asset sources reproducible.

## Possible Next Steps

- Split the large client entry module into focused rendering, input, audio, and
  networking modules.
- Add rooms, matchmaking, persistent accounts, and a deployable server setup.
- Introduce server reconciliation and more robust client-side prediction.
- Add touch controls, accessibility options, and configurable audio levels.
- Expand automated coverage for full multiplayer sessions and browser behavior.
- Profile network bandwidth, rendering time, and memory on lower-end devices.

These ideas are intentionally optional. The current repository is a record of
the concepts learned while building a small end-to-end multiplayer browser game.
