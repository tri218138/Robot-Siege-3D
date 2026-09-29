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
| `MAP_LIMIT` | 9.5 | Clamp boundary on both X and Z. |
| `GAME_DURATION_MS` | 60,000 ms | Round duration. |
| `CRITICAL_CHANCE` | 15% | Chance for an authoritative bullet hit to be critical. |
| `CRITICAL_MULTIPLIER` | 2× | Damage multiplier for a critical bullet hit. |
| `MAX_COMBAT_EVENTS` | 64 | Recent damage events retained for client presentation. |

## In-memory state

Four maps store the world by stable entity ID:

- `players`: position, HP, coins, selected weapon, input queue/sequence state,
  and next shot time.
- `enemies`: position, HP, and next allowed contact-damage time.
- `bullets`: position, weapon, fixed direction, damage, speed, and remaining
  range.
- `coins`: position; the coin ID reuses the defeated enemy ID.

Round-level variables track start time, next spawn/snapshot time, entity and
combat-event numbering, snapshot sequence, the previous tick time, and a
bounded recent-combat-event list.

## Round reset

`resetGame()` clears enemies, bullets, and coins; resets entity/snapshot counters; and starts a new 60-second clock.

It is called only when a connection arrives while `players.size === 0`. Existing players joining mid-round do not restart the clock or clear the world.

## Connection lifecycle

On connection:

1. Reset the game if this is the first connected player.
2. Create a UUID player at `x = players.size * 2`, `z = 0` with 100 HP, zero
   coins, and the pistol selected.
3. Initialize its bounded input queue and sequence counters.
4. Send an `init` message containing the assigned player ID.
5. Send a full state snapshot to the new socket.

On close, remove the player and broadcast the new state if other players remain.
Browser reconnection is a fresh connection and therefore receives a new UUID;
the server does not preserve the disconnected player's HP, coins, weapon, or
position.

## Input validation and queueing

The server accepts only messages satisfying all conditions:

- `type === "input"`.
- `sequence` is a safe integer and greater than the player's last received sequence.
- `moveX` and `moveZ` are finite numbers.

Accepted axes are clamped to `[-1, 1]` before queueing. When the four-entry queue is full, the oldest entry is dropped and treated as processed so the client can stop replaying it during reconciliation.

A `{ type: "weapon", weapon }` message is handled separately. The server accepts
only own-property IDs in `WEAPONS`; an unknown ID leaves the authoritative
selection unchanged. Switching weapons does not reset `nextShotAt`, preventing
clients from bypassing the current fire cooldown.

A `{ type: "ping", sentAt }` message with a finite numeric timestamp receives a
same-socket `pong` echo. It does not enter the input queue or mutate the player.

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
  +-- auto-shoot selected weapon
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

When an active tick finds no enemies, it creates an opening wave of ten. The
normal two-second spawn schedule runs independently; because it is immediately
due after reset, the first active tick adds one scheduled enemy after that wave.

`spawnEnemy()` chooses one of four map sides and a random offset on the other axis. Each enemy starts with 30 HP.

`findNearest()` compares squared XZ distance and ignores targets whose HP is
zero or below. Enemies use it to chase the nearest living player.

When an enemy is at least one unit away, its seek vector points toward the
player. `enemySeparation()` also accumulates a distance-weighted vector away
from every enemy within 1.25 units. Exact coordinate overlaps are split in a
stable direction based on entity ID.

At the start of each enemy update, the server buckets enemies into a spatial
grid whose cell size matches the 1.25-unit separation radius. Each enemy asks
only the surrounding cells for separation candidates. Movement vectors are
computed from that tick-start grid and then applied as a second phase, so loop
order does not change the neighborhood being evaluated. A fresh grid after
movement also limits each bullet's collision candidates to nearby cells.

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

`WEAPONS` is the authoritative data table:

| ID | Damage | Projectiles | Fire rate | Range | Speed | Spread |
|---|---:|---:|---:|---:|---:|---:|
| `pistol` | 10 | 1 | 2/s | 10 | 7 | 0° |
| `shotgun` | 6 | 5 | 1/s | 7 | 7 | 25° |
| `machineGun` | 4 | 1 | 10/s | 12 | 9 | 0° |

Each living player automatically aims at the nearest living enemy. It fires
only when that enemy is within the selected weapon's range and the shared
per-player cooldown has elapsed. `weaponDirections()` distributes multi-shot
projectiles evenly across the configured spread, so the shotgun uses angles
from -12.5° through +12.5° around the aim direction.

Projectiles travel in their initial direction rather than homing. Each tick
decrements remaining range by the distance moved. A projectile is deleted when
it comes within 0.6 units of the nearest enemy or exhausts its range. On a hit,
the server rolls a 15% critical chance. Normal hits apply base weapon damage;
critical hits apply twice that amount. Zero enemy HP creates a coin and removes
the enemy.

Every hit appends a presentation event with a monotonic ID, owner, amount,
critical/kill flags, and world position. Only the latest 64 events are retained.
These events report authoritative outcomes but do not drive simulation; clients
use them for local floating damage text and kill combos.

## Coin collection

For every coin, test all players. A player collects it when squared XZ distance is below `0.75²`.

Collection increments the authoritative `player.coins`, deletes the coin, and stops testing that coin against other players.

## Snapshot construction

`gameState()` returns the public state only. It deliberately excludes internal fields:

- Player `inputQueue`, `lastReceivedInput`, and `nextShotAt` are private.
- Enemy `nextDamageAt` is private.
- Bullet direction, damage, speed, and remaining range are private; clients
  receive only ID, weapon, and position.
- `lastProcessedInput` remains public because the client needs it for reconciliation.
- `combatEvents` exposes recent resolved hits for presentation. Its history is
  bounded and may be missed by a backpressured client, so gameplay must never
  depend on consuming every event.

Numeric values are rounded to three decimal places during JSON serialization. See [network-protocol.md](network-protocol.md) for exact schemas.

## Current limitations

- One shared room; every connection joins it.
- No maximum player count, authentication, names, teams, or ownership metadata.
- No explicit win/lose message.
- No respawn or round restart while a player remains connected.
- Combat events cover bullet damage and kills only. Generic projectile despawn
  and enemy death particles still come from entity lifecycle.
- Nearest-player and automatic aim selection still use linear scans; these are
  small at the current player count, while enemy separation and bullet collision
  use the spatial grid.
- No obstacle avoidance or pathfinding; static visual props remain outside the
  authoritative play area.
