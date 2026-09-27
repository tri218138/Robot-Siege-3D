# WebSocket protocol

The protocol is a small JSON message exchange between `src/main.js` and `server.js`.

## Endpoint

- Development server listens on `ws://127.0.0.1:8080` unless `PORT` overrides it.
- Browser connects to `${page protocol === https ? "wss" : "ws"}://${location.hostname}:8080`.
- The server binds only to `127.0.0.1`; external deployment needs an explicit hosting/proxy decision.

## Server-to-client: initialization

Sent once to the newly connected socket before its first snapshot:

```json
{
  "type": "init",
  "playerId": "uuid"
}
```

The client stores `playerId` to identify its local player in future snapshots.

## Client-to-server: movement intent

```json
{
  "type": "input",
  "sequence": 1,
  "moveX": 1,
  "moveZ": 0
}
```

Semantics:

- `sequence`: strictly increasing safe integer scoped to this client connection.
- `moveX`: horizontal intent; negative is A, positive is D.
- `moveZ`: depth intent; negative is W, positive is S.

The server rejects stale/non-integer sequences and non-finite axes, then clamps accepted axes to `[-1, 1]`.

Clients must not send positions or gameplay state. Messages such as `{ "type": "move", "x": 200, "hp": 999999 }` are ignored.

## Server-to-client: full state snapshot

```json
{
  "type": "state",
  "sequence": 42,
  "elapsedSeconds": 12,
  "players": [
    {
      "id": "uuid",
      "x": 1.2,
      "z": -0.3,
      "hp": 90,
      "coins": 2,
      "lastProcessedInput": 18
    }
  ],
  "enemies": [
    {
      "id": "enemy-7",
      "x": 8.4,
      "z": 1.1,
      "hp": 20
    }
  ],
  "bullets": [
    {
      "id": "bullet-8",
      "targetId": "enemy-7",
      "x": 2.5,
      "z": 0.2
    }
  ],
  "coins": [
    {
      "id": "enemy-4",
      "x": -2.1,
      "z": 3.7
    }
  ]
}
```

All numeric values are rounded to three decimal places during serialization.

## Snapshot sequence

The server increments snapshot `sequence` every time `gameState()` is built. The counter resets with a new round.

The client applies a snapshot only when:

```text
message.sequence > lastSnapshotSequence
```

This prevents older or duplicate snapshots from moving the rendered world backward.

## Input acknowledgement

Each public player contains `lastProcessedInput`.

For the local player, the client uses it as an acknowledgement:

```text
Authoritative server position
        +
Replay pending inputs whose sequence is newer than lastProcessedInput
        =
Predicted target position
```

The acknowledgement can advance when an input is simulated or deliberately dropped from an overflowing server queue. This prevents the client from replaying input forever.

## Cadence and backpressure

- Client sends input at most every 50 ms while movement keys are held.
- Server simulates at 50 ms intervals.
- Server normally broadcasts full snapshots every 100 ms.
- A socket is skipped for that broadcast when `bufferedAmount >= 64 KiB`.
- A later full snapshot restores current state, so skipped snapshots do not require retransmission.

## Entity lifecycle semantics

Snapshots are complete collections, not deltas:

- New ID: create the client object.
- Existing ID: update its target position/state.
- Missing prior ID: remove the client object.

The current client uses missing bullet/enemy IDs as hit/death VFX signals. If future rules can remove entities for timeout, culling, room transfer, or administrative reasons, extend the protocol with explicit lifecycle reasons or events.

## Protocol change checklist

When adding or changing a field:

1. Update the authoritative server state/serializer.
2. Update the client handler and prediction/interpolation assumptions.
3. Decide whether the field is public state or internal-only state.
4. Preserve monotonic snapshot and input sequencing.
5. Update `test/multiplayer.test.js` for authority/shared-world behavior.
6. Update this document and any affected client/server knowledge document.

There is no protocol version negotiation, reconnect token, session resume, binary encoding, compression, or explicit event channel today.
