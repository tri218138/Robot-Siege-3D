# Client runtime

`src/main.js` owns presentation and responsiveness. It renders authoritative snapshots but locally predicts the current player's movement between snapshots.

## Boot sequence

1. Read the HUD elements from `index.html`.
2. Create the Three.js scene, perspective camera, renderer, lighting, grass
   floor, and static environment.
3. Load the four environment model files from `/models/environment/` in parallel.
4. Clone and place the environment props, then create shared instanced bullet,
   coin, and particle resources.
5. Load `/models/player.glb` and `/models/enemy.glb` in parallel with the same
   `GLTFLoader` and `MeshoptDecoder`.
6. Normalize the player to 1.8 world units and the enemy to 1.5 world units.
7. Bake the enemy's bind pose into non-skinned geometries and create one fixed
   instanced buffer per source submesh for distant-enemy rendering.
8. Resolve the three required animation clips for each rig.
9. Create client entity maps and runtime state.
10. Open the WebSocket only after all required models are loaded, then maintain
   its status, latency probe, and reconnect lifecycle.
11. Start the `requestAnimationFrame` loop and resize handler.

If a required model fails to load, module initialization currently rejects and
the WebSocket/render loop does not start. There is no loading screen or fallback
model.

## Scene and camera

- Renderer antialiasing is enabled.
- Pixel ratio is capped at 2 to avoid excessive high-DPI rendering cost.
- The environment floor is a green 24×24 plane at `y = 0`; the authoritative
  playable area remains bounded to ±9.5 on X/Z.
- The local camera offset is `(0, 12, 10)`.
- On the first local-player frame, the camera snaps to `player.position +
  cameraOffset`. Later frames exponentially smooth both position and look
  target with factor 8 so follow behavior remains frame-rate independent.
- A local shot briefly increases FOV and offsets the follow target for recoil.
  Enemy death and local damage add a 100 ms positional shake. Enemy damage
  freezes visual interpolation, animation, and particles for 35 ms as hit stop;
  input sending and authoritative simulation continue normally.
- Window resize updates camera aspect/projection and renderer size.

## Lighting and shadows

The renderer uses `PCFSoftShadowMap`. A hemisphere light at intensity 1.2
provides fill, while a directional light at `(5, 10, 7)` and intensity 2.5
casts the main shadows.

The directional light uses a 1024×1024 shadow map. Its orthographic shadow
camera spans `-13..13` horizontally and vertically, covering the 24×24
environment, with near/far planes `0.5/30` and `normalBias = 0.02`.

The floor receives shadows. Every mesh in the cloned GLB player and animated
enemy models casts and receives shadows. Distant enemy instances receive but
do not cast shadows, avoiding another instanced draw for the shadow pass. Coins
cast shadows; bullets and particles do not. The enemy's eye glow comes from the
GLB's emissive `Glow` material rather than a runtime post-processing pipeline.
There is currently no HDRI, environment map, ambient occlusion, bloom, or color
grading.

## Static environment

The grass plane and two crossing dirt roads remain simple Three.js geometry.
All decorative props are downloaded CC0 models loaded through `GLTFLoader`:
`forest.glb` supplies named tree and rock meshes, `wall.glb` and `barrel.glb`
supply dungeon props, and `house.glb` supplies the house. The shared loader is
configured with Three.js's `MeshoptDecoder` for the optimized runtime files.
Their pinned sources and licenses are recorded in
`public/models/environment/CREDITS.md`.

The client clones these templates into eight wall pieces, eight trees, four
rocks, one house, and two barrels. Models cast and receive shadows; the flat
roads receive shadows but do not cast them. A missing named forest model throws
during boot instead of silently producing an incomplete map.

Roads are visual surfaces and do not affect movement. Walls sit just beyond
the server's ±9.5 map clamp and represent that rectangular boundary visually.
Trees, rocks, the house, and barrels stay outside the playable bound and have
no colliders. Adding obstacles inside the playfield requires authoritative
server collision plus matching client prediction; visual geometry must not be
treated as gameplay collision by the client alone.

## Entity representation and instancing

The client keeps four stores keyed by authoritative ID:

- `playerMeshes`
- `enemies`
- `bullets`
- `coins`

Players remain separate `SkeletonUtils.clone()` GLB objects because each owns
an independent skeleton and `AnimationMixer`. Enemy store entries instead own
their current/target positions independently of their visual representation.
At most once per second, `selectNearestIds()` assigns animated rigs to the 24
enemies nearest the authoritative local-player position; the rest use the
baked-pose instance buffers. The slower rebalance avoids cloning churn near the
cutoff. Promotion creates a rig at the interpolated position, while demotion
stops/uncaches its mixer, disposes its skeleton texture, and removes the rig.

Bullets and coins each use one shared `THREE.InstancedMesh`. Distant enemies
use one `InstancedMesh` per original GLB submesh so the original materials are
preserved at a fixed number of draw calls. Their stores hold current/target
positions plus presentation metadata. Each render frame writes packed matrices
into dynamic instance buffers; bullet colors use the single mesh's
`instanceColor` buffer. Matrix uploads are restricted to the active packed
range, and bullet colors upload only after snapshot reconciliation can change
that packing. Frustum culling is disabled for these moving batches so a stale
aggregate bounding volume cannot hide them.

`syncMeshes()` reconciles player scene objects, `syncEnemies()` reconciles the
hybrid enemy entries and representations, and `syncInstanceStore()` handles the
bullet and coin stores:

1. Create objects for IDs not already present.
2. Update target positions for existing IDs.
3. Remove entries whose IDs are absent from the new snapshot.
4. Optionally run an `onRemove` callback before removal for lifecycle VFX.

Each bullet/coin group and each distant-enemy submesh buffer has a fixed
capacity of 512. This is above the current 60-second round's practical entity
load and keeps GPU buffers stable. Entities over the relevant ceiling remain
authoritative on the server but are not rendered; increase or dynamically grow
the capacity only when a larger room or longer round is introduced and
profiled.

## Player model and animation

The loaded rig is a template. `createPlayerModel()` uses `SkeletonUtils.clone()` for each player, creates a dedicated `AnimationMixer`, creates actions for the three selected clips, and starts `Idle`.

Animation state is stored in `model.userData.animation`:

```text
alive + target differs from visible position -> Running
alive + no movement                         -> Idle
HP === 0                                    -> Death
```

Transitions use a 0.2-second fade. `Death` uses `LoopOnce` and holds its final pose. While an alive player is moving, the model turns toward `targetPosition`.

The mixer for every player advances by frame delta each render frame.

## Enemy model and animation

`/models/enemy.glb` is the Meshopt-compressed KayKit Skeleton Minion recorded in
`public/models/README.md`. The nearest 24 enemies use `createEnemyModel()` to
clone the rig and create independent actions for `Idle`,
`Walking_D_Skeletons`, and `Death_C_Skeletons`. New animated enemies begin on a
randomized walking phase so a crowd does not move in lockstep. They switch to
idle when interpolation stops and turn toward their latest target while moving.

During boot, `createEnemyProxyMeshes()` applies the bind-pose bone transform to
each skinned vertex, bakes the normalized world transform into float positions,
removes skin attributes, and creates instanced meshes with the source
materials. Distant enemies use these static poses with interpolated position,
heading, and a small procedural walking bob. They do not run mixers.

Missing enemy IDs still mean death under the current lifecycle contract. If a
removed enemy currently has an animated rig, the client retains that rig in
`dyingEnemies` until the loop-once death action finishes, then uncaches its
mixer and removes it from the scene. A removed distant instance disappears
without allocating a temporary death rig. The orange death burst and audio
occur for both representations.

## Keyboard input

`keys` is a `Set` containing currently held lowercase WASD keys.

- Ignore unrelated keys and repeated keydown events.
- Clear individual keys on keyup.
- Clear the complete set when the window loses focus to avoid stuck movement.

`sendInput()` sends only while at least one movement key is held, the socket is open, and 50 ms have passed since the previous send.

Axes are derived as:

```text
moveX = D - A
moveZ = S - W
```

Each message receives a monotonically increasing input sequence.

Space cycles weapons independently of movement in a closed loop: `pistol` →
`shotgun` → `machineGun` → `pistol`. Repeated keydown events are ignored. The
client tracks its latest requested weapon so consecutive presses keep advancing
the loop, sends only the requested ID, and waits for the authoritative player
snapshot before updating the HUD.

## Connection lifecycle and latency

`connectSocket()` opens the socket after scene assets are ready. Every new
connection resets local player identity, snapshot/input sequences, pending
prediction, weapon selection, and latency display. This is required because a
reconnect receives a new server player rather than resuming the old one.

While open, the client sends a monotonic timestamp every two seconds and shows
the echoed round-trip time in the HUD. On close it clears held keys, pending
inputs, and the ping timer, then retries after one second. The old rendered
world remains visible during the short outage; the first full snapshot after
reconnect reconciles all old IDs.

## Local prediction and reconciliation

Immediately after sending a valid input, the client stores it in `pendingInputs` and applies it to the local player's target position when the player is alive.

`applyInput()` mirrors the server calculation:

- Normalize diagonal input.
- Move exactly `PLAYER_SPEED * INPUT_MS / 1000`, currently 0.15 units.
- Clamp X/Z to ±9.5.

On every authoritative snapshot:

1. Read the local player's `lastProcessedInput` acknowledgement.
2. Drop pending inputs at or below that sequence.
3. Reset local `targetPosition` to the authoritative X/Z.
4. Replay remaining unacknowledged inputs onto the target.

This preserves responsiveness without allowing the client to own the result.

## Interpolation

- Remote players move toward targets using exponential interpolation based on factor 15.
- Enemies and bullets use the same remote factor.
- The local player uses a faster factor 25 after reconciliation.
- If the local error is more than two world units (`distanceToSquared > 4`), it snaps directly to the target instead of slowly crossing the map.

Exponential factors are calculated from frame delta, keeping smoothing broadly consistent across frame rates.

## Particle VFX

The client owns one `THREE.Points` object backed by fixed typed arrays for 512 particles:

- Position: three floats per particle.
- Velocity: three floats per particle.
- Lifetime: one float per particle.
- Color: three floats per particle.

`nextParticle % MAX_PARTICLES` makes the buffer circular. New effects overwrite the oldest slots when the pool is full. Expired particles are moved to `y = -100` and later reused.

`updateParticles()` applies gravity and `position += velocity * delta`, then
uploads positions. The color buffer is uploaded only after an emission changes
one or more slots.

Bullet material and particle color depend on its public `weapon` field: yellow
for pistol, orange for shotgun, and cyan for machine gun. Its public `ownerId`
lets the client recognize local shots. Current effects:

- New bullet: six weapon-colored particles at its spawn coordinate.
- Every live bullet, every frame: one short-lived weapon-colored trail particle.
- Removed bullet: five weapon-colored particles as a generic despawn effect.
- Removed enemy: eighteen orange particles at its last visible position (death burst).

Particle effects for bullet/enemy removal are inferred from full snapshots.
Bullet removal deliberately does not claim whether it hit or exhausted its
range; the damage event described below separately reports confirmed hits.

## Combat feedback

Snapshots include a bounded list of authoritative damage events. The client
tracks the latest consumed event ID and presents only events owned by the local
player. A normal hit creates a white floating damage number projected from the
event's world position; a critical hit creates a larger yellow `CRIT!` label.

A local killing hit advances a cosmetic combo when it occurs within three
seconds of the preceding local kill. The combo hides and resets after three
seconds without another kill. On the first snapshot of a connection the client
advances its event cursor without presenting retained history, so reconnecting
does not replay old combat feedback. Combat text and combo state are cleared on
reconnect.

## Audio

The client preloads OGG files from `public/audio/` with native
`HTMLAudioElement`; no audio dependency is installed. The looped BGM starts
only after the first pointer or keyboard gesture to satisfy browser autoplay
policy. `public/audio/CREDITS.md` records each source file and its CC0 license.

Asset cues cover three distinct local gunshots, enemy hits/deaths, local
damage, coin pickup, and weapon selection. Playback clones each SFX element so
rapid shots can overlap. Shotgun pellets arriving in the same snapshot still
produce one gunshot cue. Enemy HP changes and lifecycle removal come from full
snapshots; coin and damage cues compare consecutive local-player snapshots.
There is no level-up cue because the game has no level system.

## HUD

`index.html` provides a responsive fixed overlay with HP and round progress
bars, coin count, selected weapon and its Space key hint, remaining time,
connection status, and round-trip latency. Low HP and weapon types receive
distinct color treatments. The HP bar exposes native progressbar ARIA values;
connection status remains an ARIA live region. Motion-heavy feedback respects
the user's reduced-motion preference.

The client updates it from the local authoritative player, snapshot clock, and
combat events. There is currently no loading, victory, defeat, or dedicated
reconnect screen.

## Current limitations

- WebSocket address is derived from the page protocol/hostname but always uses port 8080.
- `wss:` pages require a TLS-capable proxy because the Node server itself is plain WebSocket.
- Reconnect uses a fixed one-second retry rather than exponential backoff.
- Reconnect creates a new player and does not resume identity or gameplay state.
- Local and remote player models have the same appearance.
- Player `Attack` and `Hit` clips and enemy hit/attack clips are not shipped or
  driven because the protocol has no matching animation events.
- The muzzle flash starts at the bullet coordinate, not a weapon bone/socket.
