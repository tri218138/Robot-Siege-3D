# Server gameplay runtime

`server.js` is the authoritative simulation. It owns all mutable gameplay state and exposes it through WebSocket snapshots.

## Timing and limits

| Constant | Value | Meaning |
|---|---:|---|
| `TICK_MS` | 50 ms | Simulation cadence, approximately 20 ticks/second. |
| `SNAPSHOT_MS` | 100 ms | Broadcast cadence, approximately 10 snapshots/second. |
| `MAX_BUFFERED_BYTES` | 64 KiB | Skip sending to a slow client above this buffered amount. |
| `MAX_INPUT_QUEUE` | 4 | Maximum queued movement inputs per player. |
| `PLAYER_SPEED` | 3 units/s | Authoritative player speed. |
| `ENEMY_SPEED` | 1.2 units/s | Enemy chase speed. |
| `ENEMY_SEPARATION_RADIUS` | 1.25 units | Nearby-enemy radius used by separation steering. |
| `ENEMY_SEPARATION_WEIGHT` | 1.5 | Relative strength of separation against player seeking. |
| `BULLET_SPEED` | 7 units/s | Homing bullet speed. |
| `MAP_LIMIT` | 9.5 | Clamp boundary on both X and Z. |
| `GAME_DURATION_MS` | 60,000 ms | Round duration. |

## In-memory state

Four maps store the world by stable entity ID:

- `players`: position, HP, coins, input queue/sequence state, and next shot time.
- `enemies`: position, HP, and next allowed contact-damage time.
- `bullets`: position and target enemy ID.
- `coins`: position; the coin ID reuses the defeated enemy ID.

Round-level variables track start time, next spawn/snapshot time, entity numbering, snapshot sequence, and the previous tick time.

## Round reset

`resetGame()` clears enemies, bullets, and coins; resets entity/snapshot counters; and starts a new 60-second clock.

It is called only when a connection arrives while `players.size === 0`. Existing players joining mid-round do not restart the clock or clear the world.

## Connection lifecycle

On connection:

1. Reset the game if this is the first connected player.
2. Create a UUID player at `x = players.size * 2`, `z = 0` with 100 HP and zero coins.
3. Initialize its bounded input queue and sequence counters.
4. Send an `init` message containing the assigned player ID.
5. Send a full state snapshot to the new socket.

On close, remove the player and broadcast the new state if other players remain.

## Input validation and queueing

The server accepts only messages satisfying all conditions:

- `type === "input"`.
- `sequence` is a safe integer and greater than the player's last received sequence.
- `moveX` and `moveZ` are finite numbers.

Accepted axes are clamped to `[-1, 1]` before queueing. When the four-entry queue is full, the oldest entry is dropped and treated as processed so the client can stop replaying it during reconciliation.

Unknown, malformed, stale, or spoofed messages are ignored without mutating the world.

## Tick pipeline

`tick()` runs every 50 ms and clamps elapsed delta time to 100 ms to limit large simulation jumps.

```text
No connected players? stop this tick
        |
        v
Process one queued input per player
        |
        v
Round still under 60 seconds?
  | yes
  +-- spawn enemy when due
  +-- move enemies / apply contact damage
  +-- auto-shoot
  +-- move bullets / apply bullet damage / drop coins
  +-- collect coins
        |
        v
Broadcast snapshot when due
```

Player input remains processable after the 60-second gameplay window, but enemy, shooting, bullet, and coin systems stop updating. Snapshots continue so clients keep a consistent final world.

## Movement

`updatePlayers()` consumes at most one input per player each tick.

The vector is normalized before applying speed, so diagonal input does not move faster:

```text
position += normalizedInput * PLAYER_SPEED * 0.05
```

Both axes are clamped to `[-MAP_LIMIT, MAP_LIMIT]`. A dead player acknowledges queued input but does not move.

## Enemy spawning and AI

An enemy spawns immediately after reset and then every two seconds while the round is active.

`spawnEnemy()` chooses one of four map sides and a random offset on the other axis. Each enemy starts with 30 HP.

`findNearest()` compares squared XZ distance and ignores targets whose HP is zero. Enemies use it to chase the nearest living player.

When an enemy is at least one unit away, its seek vector points toward the
player. `enemySeparation()` also accumulates a distance-weighted vector away
from every enemy within 1.25 units. Exact coordinate overlaps are split in a
stable direction based on entity ID.

The server combines the two steering inputs and normalizes the result:

```text
normalize(seek + separation * 1.5) * ENEMY_SPEED * delta
```

This preserves the 1.2 units/s speed cap while causing a crowd to spread around
its target. Separation remains active inside contact range; without nearby
enemies, a contacting enemy stays in place. Enemy positions are clamped to the
same map boundary as players.

Within one unit, an enemy deals 10 damage at most once per second. Player HP is
clamped to zero.

## Automatic shooting and bullets

Each living player independently shoots at the nearest living enemy no more than once every 500 ms.

A bullet stores the target enemy ID and starts at the player's current position. It homes toward the target each tick.

- If the target no longer exists, delete the bullet.
- Otherwise move it by `BULLET_SPEED * delta`.
- If it can reach within the current step plus a 0.6 hit radius, apply 10 damage and delete the bullet.
- At zero or less enemy HP, create a coin at that position and delete the enemy.

Three bullet hits defeat a fresh 30-HP enemy.

## Coin collection

For every coin, test all players. A player collects it when squared XZ distance is below `0.75²`.

Collection increments the authoritative `player.coins`, deletes the coin, and stops testing that coin against other players.

## Snapshot construction

`gameState()` returns the public state only. It deliberately excludes internal fields:

- Player `inputQueue`, `lastReceivedInput`, and `nextShotAt` are private.
- Enemy `nextDamageAt` is private.
- `lastProcessedInput` remains public because the client needs it for reconciliation.

Numeric values are rounded to three decimal places during JSON serialization. See [network-protocol.md](network-protocol.md) for exact schemas.

## Current limitations

- One shared room; every connection joins it.
- No maximum player count, authentication, names, teams, or ownership metadata.
- No explicit win/lose message.
- No respawn or round restart while a player remains connected.
- No explicit combat event stream; clients infer visual effects from entity lifecycle.
- Enemy separation is an O(n²) scan with no spatial partitioning; the current
  two-second spawn cadence caps a full round at about 30 simultaneous spawns.
- No obstacle avoidance or pathfinding; static visual props remain outside the
  authoritative play area.
