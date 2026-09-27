# Development workflow

## Requirements

- A modern Node.js version supported by the installed Vite release.
- npm.
- A browser with WebGL support.

## Install

```bash
npm install
```

Runtime dependencies:

- `three`: scene rendering, GLB loading, skeletal cloning/animation, and particles.
- `ws`: Node.js WebSocket server and integration-test clients.

Development dependencies:

- `vite`: browser development server and production build.
- `@gltf-transform/cli`: validates, packs, and optimizes source models into
  runtime GLBs.

## Run locally

Use two terminals:

```bash
npm run server
```

```bash
npm run dev
```

Default endpoints:

- Browser: Vite's printed URL, normally `http://localhost:5173`.
- WebSocket: `ws://127.0.0.1:8080`.

The browser client requires the WebSocket server for players and gameplay entities to appear.

## Commands

| Command | Purpose |
|---|---|
| `npm run assets` | Rebuild and validate optimized environment GLBs. |
| `npm run dev` | Start Vite development server with HMR. |
| `npm run server` | Start the authoritative WebSocket simulation. |
| `npm test` | Run Node's built-in test runner. |
| `npm run build` | Create a production client build in `dist/`. |
| `npm run preview` | Serve the production build locally. |

The test and development servers bind localhost ports. In restricted environments they may require permission to listen on a local port.

## Static assets

Vite serves `public/` from the site root. Therefore:

```text
public/models/player.glb -> /models/player.glb
```

Keep model source/license information in `public/models/README.md`. The current RobotExpressive asset is rigged and contains the clips used by the client.

Environment source downloads live in `assets/source/environment/`. The
`npm run assets` command converts them into Meshopt-compressed GLBs in
`public/models/environment/`, embeds the house's external buffer and texture,
validates every output, and checks that the named forest templates used by the
client survived optimization. Outputs are built in a temporary directory and
only replace runtime files after every model succeeds. The browser loader must
keep its `MeshoptDecoder` configuration while these outputs are in use.

## Verification

Minimum checks after executable changes:

```bash
npm test
npm run build
git diff --check
```

Use a browser smoke test for changes involving WebGL, GLB loading, animation, camera behavior, HUD, or VFX because the Node integration test does not render the client.

## Current automated coverage

`test/multiplayer.test.js` starts the server on an ephemeral port, exercises the
pure separation steering helper, and connects two clients. It verifies:

- Overlapping enemies receive opposite separation vectors while distant enemies do not contribute.
- Weapon fire rates and the shotgun's five evenly distributed directions.
- A spoofed client message cannot set position or HP.
- Valid weapon selection is shared while an unknown weapon is ignored.
- Valid sequenced input moves the authoritative player by a bounded amount.
- `lastProcessedInput` acknowledges the processed input.
- Two clients receive the same enemy collection for the shared world.

`test/instance-store.test.js` verifies that instanced entity entries are reused,
missing IDs are removed, and the fixed capacity is respected.

It does not currently test the 60-second end state, damage cooldowns, bullet hits, coin collection, queue overflow, disconnect cleanup, rendering, animation, or particles.

## Change-impact guide

| Change | Required inspection/verification |
|---|---|
| Movement speed or cadence | Update/check server and client constants, prediction, reconciliation, protocol docs, test. |
| New server entity or field | Update serializer, client map/sync, protocol schema, authority test. |
| New removal reason | Stop relying only on missing IDs; add explicit lifecycle semantics if VFX/gameplay needs the reason. |
| Player model or clips | Check GLB path/license, bounds normalization, `SkeletonUtils.clone`, clip names, browser rendering. |
| Environment source model | Run `npm run assets`, check provenance, then build and browser-render the optimized output. |
| Animation state | Check per-player mixer ownership, transitions, server state/event source, browser behavior. |
| Particle behavior | Preserve fixed-buffer reuse, dynamic buffer updates, lifecycle trigger correctness, browser behavior. |
| Instanced entity behavior | Preserve the 512-entry ceiling, packed matrix/color updates, lifecycle VFX, and browser rendering. |
| WebSocket address/deployment | Reconcile bind host, browser URL, TLS proxy, and documentation. |

## Repository hygiene

- `node_modules/` and `dist/` are generated and ignored.
- Preserve unrelated working-tree changes.
- Do not treat roadmap text as implemented behavior.
- Use `$update-knowledge` whenever a code change alters facts recorded in `.codex/docs`.
