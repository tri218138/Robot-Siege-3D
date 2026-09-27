# System architecture

## Purpose and boundary

The game is a browser-based multiplayer survival prototype. Clients render and predict movement for responsiveness, while one Node.js process owns the shared game state and all gameplay decisions.

```text
Keyboard / Browser
       |
       | input { sequence, moveX, moveZ }
       v
Three.js client  <------ full state snapshots ------  Node.js WebSocket server
  render only                                          authoritative simulation
       |                                                        |
       +-- GLB model, animation, VFX, HUD                        +-- players
       +-- prediction and interpolation                          +-- enemies
                                                                +-- bullets
                                                                +-- coins
                                                                +-- 60s clock
```

The client never submits authoritative positions, HP, coins, enemies, bullets, or time. It submits movement intent only.

## Component ownership

| Area | Owner | Primary source |
|---|---|---|
| Game state and rules | Server | `server.js` |
| Movement intent and prediction | Client | `src/main.js` |
| Rendering and presentation | Client | `src/main.js`, `index.html` |
| Network schema and validation | Both | `server.js`, `src/main.js` |
| Multiplayer invariant test | Test | `test/multiplayer.test.js` |
| Player asset | Static public asset | `public/models/player.glb` |

## Runtime lifecycle

1. Start the WebSocket server on `127.0.0.1:8080`.
2. Start Vite and load the browser client.
3. The client creates the Three.js scene and loads `/models/player.glb` before opening its WebSocket.
4. The server accepts the connection, resets the round only when this is the first connected player, creates the authoritative player, sends `init`, and sends an initial `state` snapshot.
5. The client sends sequenced WASD intent at most once per 50 ms while keys are held and predicts the same movement locally.
6. The server consumes at most one queued input per 50 ms tick, updates the world, and broadcasts full snapshots every 100 ms.
7. The client ignores stale snapshots, removes acknowledged pending inputs, reapplies unacknowledged inputs, interpolates rendered entities, updates animation/VFX/camera/HUD, and renders each animation frame.
8. On disconnect, the server removes that player. A new round begins only after all players have disconnected and a later first player connects.

## File map

| Path | Responsibility |
|---|---|
| `server.js` | WebSocket server, authoritative state, game loop, validation, combat, spawning, collection. |
| `src/main.js` | Scene setup, asset loading, network client, input prediction, reconciliation, interpolation, animation, VFX, camera, rendering. |
| `index.html` | Full-screen canvas host and DOM HUD. |
| `test/multiplayer.test.js` | Server-authority, movement acknowledgement, and shared-world integration test. |
| `public/models/player.glb` | Rigged RobotExpressive player asset served by Vite at `/models/player.glb`. |
| `public/models/README.md` | Player asset source and license. |
| `package.json` | Runtime dependencies and development commands. |
| `PLAN.md` | Original learning roadmap; not runtime truth. |
| `PLAN2.md` | Visual/gameplay expansion roadmap; not runtime truth. |

## Non-negotiable invariants

### Server authority

- Never accept client-provided positions, HP, coin totals, entity state, or clock values.
- Validate input messages before queueing them.
- Apply movement, combat, spawning, damage, death, and collection on the server.

### Coupled movement constants

The prediction calculation assumes the same movement cadence and speed as the server:

```text
server: PLAYER_SPEED = 3, TICK_MS = 50
client: PLAYER_SPEED = 3, INPUT_MS = 50
client INPUT_DISTANCE = PLAYER_SPEED * INPUT_MS / 1000 = 0.15
```

Changing one side without the other causes prediction drift and visible reconciliation.

### Identity and lifecycle

- Every network entity has a stable `id` and is stored client-side in a `Map` keyed by that ID.
- Presence in a full snapshot creates or updates the rendered entity.
- Absence from a later snapshot removes it.
- Current hit/death VFX infer events from bullet/enemy removal. If the server later adds despawning for other reasons, introduce explicit event/reason data before assuming every removal is a hit or death.

### Snapshot ordering

- Server snapshot `sequence` values increase monotonically within a round.
- The client ignores any state snapshot whose sequence is not newer than the latest applied snapshot.
- Player `lastProcessedInput` acknowledges client input and drives reconciliation.

### Rigged player clones

- Load the GLB once.
- Clone each rendered player with `SkeletonUtils.clone`, not `Object3D.clone`, so skeleton state is independent.
- Each player owns a separate `AnimationMixer` and action state.

### Bounded runtime work

- Server input queues are capped at four entries per player.
- Snapshots are skipped for a client whose WebSocket buffered amount is at least 64 KiB.
- VFX reuse a fixed 512-particle buffer instead of allocating meshes continuously.

## Intentional ceilings

- One process, one in-memory room.
- No persistence or recovery after process exit.
- Full snapshots rather than delta compression.
- Fixed ports in the browser/server development setup.
- No reconnect/resume protocol.
- No spatial partitioning, physics engine, instancing, or LOD.

These are deliberate prototype constraints. Upgrade them only when the requested feature or measured load requires it.
