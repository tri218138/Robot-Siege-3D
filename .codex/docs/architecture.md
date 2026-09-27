# System architecture

## Purpose and boundary

The game is a browser-based multiplayer survival prototype. Clients render and predict movement for responsiveness, while one Node.js process owns the shared game state and all gameplay decisions.

```text
Keyboard / Browser
       |
       | movement input / weapon selection
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

The client never submits authoritative positions, HP, coins, enemies, bullets,
weapon stats, or time. It submits movement and weapon-selection intent only.

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
4. The server accepts the connection, resets the round only when this is the first connected player, creates the authoritative player, sends `init`, and sends an initial `state` snapshot. The client also starts periodic application-level ping requests.
5. The client sends sequenced WASD intent at most once per 50 ms while keys are
   held, predicts that movement locally, and cycles weapon requests with Space.
6. The server consumes at most one queued input per 50 ms tick, updates the world, and broadcasts full snapshots every 100 ms.
7. The client ignores stale snapshots, removes acknowledged pending inputs, reapplies unacknowledged inputs, interpolates rendered entities, updates animation/VFX/camera/HUD, and renders each animation frame.
8. On disconnect, the server removes that player. The client clears pending
   prediction and retries after one second. Reconnection creates a new player;
   it joins the existing round when others remain, or starts a new round when
   the room became empty.

## File map

| Path | Responsibility |
|---|---|
| `server.js` | WebSocket server, authoritative state, game loop, validation, combat, spawning, collection. |
| `src/main.js` | Scene setup, asset loading, network client, input prediction, reconciliation, interpolation, animation, VFX, camera, rendering. |
| `src/instance-store.js` | Capacity-bounded lifecycle reconciliation for instanced dynamic entities. |
| `index.html` | Full-screen canvas host and DOM HUD. |
| `test/multiplayer.test.js` | Server-authority, weapon steering/selection, movement acknowledgement, and shared-world integration test. |
| `test/instance-store.test.js` | Instance-store reuse, removal, and capacity test. |
| `public/models/player.glb` | Rigged RobotExpressive player asset served by Vite at `/models/player.glb`. |
| `public/models/README.md` | Player asset source and license. |
| `package.json` | Runtime dependencies and development commands. |
| `PLAN.md` | Original learning roadmap; not runtime truth. |
| `PLAN2.md` | Visual/gameplay expansion roadmap; not runtime truth. |

## Non-negotiable invariants

### Server authority

- Never accept client-provided positions, HP, coin totals, entity state, or clock values.
- Validate input messages before queueing them.
- Accept only known weapon IDs; weapon damage, cadence, range, spread, and
  projectiles remain server-owned.
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
- Bullet removal drives only a generic despawn VFX because it can mean a hit or
  exhausted range. Enemy removal currently drives a death burst; add an
  explicit reason/event before introducing other enemy removal causes.

### Snapshot ordering

- Server snapshot `sequence` values increase monotonically within a round.
- The client ignores any state snapshot whose sequence is not newer than the latest applied snapshot.
- The client resets its applied snapshot and input sequences for every new
  socket because reconnect creates a new player connection.
- Player `lastProcessedInput` acknowledges client input and drives reconciliation.

### Rigged player clones

- Load the GLB once.
- Clone each rendered player with `SkeletonUtils.clone`, not `Object3D.clone`, so skeleton state is independent.
- Each player owns a separate `AnimationMixer` and action state.

### Bounded runtime work

- Server input queues are capped at four entries per player.
- Snapshots are skipped for a client whose WebSocket buffered amount is at least 64 KiB.
- Enemy, bullet, and coin rendering uses fixed 512-entry instance buffers.
- VFX reuse a fixed 512-particle buffer instead of allocating meshes continuously.

## Intentional ceilings

- One process, one in-memory room.
- No persistence or recovery after process exit.
- Full snapshots rather than delta compression.
- Fixed ports in the browser/server development setup.
- Reconnect creates a new player; there is no identity or state resume protocol.
- No spatial partitioning, physics engine, or LOD.

These are deliberate prototype constraints. Upgrade them only when the requested feature or measured load requires it.
