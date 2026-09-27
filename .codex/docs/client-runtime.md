# Client runtime

`src/main.js` owns presentation and responsiveness. It renders authoritative snapshots but locally predicts the current player's movement between snapshots.

## Boot sequence

1. Read the HUD elements from `index.html`.
2. Create the Three.js scene, perspective camera, renderer, floor, hemisphere light, and directional light.
3. Create shared enemy, bullet, coin, and particle resources.
4. Load `/models/player.glb` with `GLTFLoader`.
5. Normalize the player model to 1.8 world units tall, center it on X/Z, and place its lowest bound at ground level.
6. Find the `Idle`, `Running`, and `Death` animation clips.
7. Create client entity maps and runtime state.
8. Open the WebSocket only after the model is loaded.
9. Start the `requestAnimationFrame` loop and resize handler.

If the model fails to load, module initialization currently rejects and the WebSocket/render loop does not start. There is no loading screen or fallback model.

## Scene and camera

- Renderer antialiasing is enabled.
- Pixel ratio is capped at 2 to avoid excessive high-DPI rendering cost.
- The map floor is a green 20×20 plane at `y = 0`.
- The local camera offset is `(0, 12, 10)`.
- Each frame with a local player, camera position is `player.position + cameraOffset` and the camera looks at the player.
- Window resize updates camera aspect/projection and renderer size.

## Lighting and shadows

The renderer uses `PCFSoftShadowMap`. A hemisphere light at intensity 1.2
provides fill, while a directional light at `(5, 10, 7)` and intensity 2.5
casts the main shadows.

The directional light uses a 1024×1024 shadow map. Its orthographic shadow
camera spans `-12..12` horizontally and vertically, covering the 20×20
playfield, with near/far planes `0.5/30` and `normalBias = 0.02`.

The floor receives shadows. Every mesh in the cloned GLB player model casts
and receives shadows; enemies cast and receive them; coins cast them. Bullets
and particles intentionally do not cast shadows. There is currently no HDRI,
environment map, custom tone mapping, ambient occlusion, bloom, or color
grading.

## Entity representation

The client keeps four maps keyed by authoritative ID:

- `playerMeshes`
- `enemyMeshes`
- `bulletMeshes`
- `coinMeshes`

Each rendered object stores `userData.targetPosition`. Incoming snapshots update that target; the animation frame interpolates the visible position toward it.

`syncMeshes()` implements full-snapshot reconciliation:

1. Create objects for IDs not already present.
2. Update target positions for existing IDs.
3. Remove map/scene objects whose IDs are absent from the new snapshot.
4. Optionally run an `onRemove` callback before removal for lifecycle VFX.

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

`updateParticles()` applies gravity and `position += velocity * delta`, then marks GPU buffer attributes for upload.

Current effects:

- New bullet: six yellow particles at its spawn coordinate (muzzle flash approximation).
- Every live bullet, every frame: one short-lived yellow particle (trail).
- Removed bullet: five orange particles at its last visible position (hit approximation).
- Removed enemy: eighteen orange particles at its last visible position (death burst).

Bullet/enemy removal is inferred from full snapshots, not an explicit event protocol. A future despawn mechanic must add a reason/event before reusing these assumptions.

## HUD

`index.html` provides an accessible fixed overlay with HP, coin count, and elapsed seconds out of 60.

The client updates it from the local authoritative player and snapshot clock. There is currently no loading, connection, victory, defeat, or reconnect UI.

## Current limitations

- WebSocket address is derived from the page protocol/hostname but always uses port 8080.
- `wss:` pages require a TLS-capable proxy because the Node server itself is plain WebSocket.
- No socket open/error/close UI or reconnect strategy.
- Local and remote player models have the same appearance.
- `Attack` and `Hit` animation clips are not driven because the protocol has no matching events.
- The muzzle flash starts at the bullet coordinate, not a weapon bone/socket.
