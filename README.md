# Robot Survivor Three.js

A small browser-based multiplayer survival game built with Three.js and
WebSockets. Guide a robot through escalating enemy waves, switch weapons, collect
coins, and survive the final boss encounter.

## Gameplay Demo

[![Watch the Robot Survivor Three.js gameplay demo](https://img.youtube.com/vi/IElEqI2E9lQ/maxresdefault.jpg)](https://youtu.be/IElEqI2E9lQ)

[Watch the gameplay demo on YouTube](https://youtu.be/IElEqI2E9lQ).

> [!NOTE]
> This is a personal learning project, created to explore real-time multiplayer
> networking, 3D rendering, game loops, animation, audio, and performance in the
> browser. It is not a commercial game or a production-ready multiplayer service.

## Features

- Server-authoritative multiplayer state synchronized over WebSockets
- Three timed enemy waves followed by a boss encounter
- Pistol, shotgun, and machine gun weapon modes
- Automatic targeting, critical hits, coins, and local kill combos
- Animated GLTF characters and a stylized 3D environment
- Sound effects, background music, particles, camera feedback, and HUD updates
- Spatial-grid queries, instanced meshes, and distance-based animation limits
- Automatic reconnect and live connection-latency feedback

## Tech Stack

- [Three.js](https://threejs.org/) for 3D rendering
- [Vite](https://vite.dev/) for local development and production builds
- [ws](https://github.com/websockets/ws) for the WebSocket game server
- [glTF Transform](https://gltf-transform.dev/) for asset optimization
- Node.js built-in test runner

## Requirements

- Node.js `20.19+` or `22.12+`
- npm

## Getting Started

Install the dependencies:

```bash
npm install
```

Start the WebSocket server in one terminal:

```bash
npm run server
```

The server listens on `ws://127.0.0.1:8080` by default.

Start the Vite development server in a second terminal:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in multiple browser tabs to
try the multiplayer synchronization locally.

## Controls

| Input | Action |
| --- | --- |
| `W`, `A`, `S`, `D` | Move the robot |
| `Space` | Cycle through weapons |

The robot automatically aims at and fires at the nearest enemy in range.

## Available Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run server` | Start the WebSocket game server |
| `npm test` | Run the automated test suite |
| `npm run assets` | Rebuild optimized runtime models from source assets |
| `npm run build` | Create a production client build |
| `npm run preview` | Preview the production build locally |

## Project Structure

```text
.
├── assets/source/       Original model and texture sources
├── docs/                Learning notes and project documentation
├── public/audio/        Runtime music and sound effects
├── public/models/       Optimized runtime 3D models
├── scripts/             Asset build tools
├── src/                 Client runtime and shared game utilities
├── test/                Automated tests
├── index.html           Game UI and browser entry page
└── server.js            Authoritative WebSocket game server
```

See [the learning roadmap](docs/LEARNING_ROADMAP.md) for the concepts explored by
the project and possible next steps.

## Third-Party Assets

The graphics, 3D models, textures, music, and sound effects used by this learning
project were created by their respective authors. Ownership and licensing details
are documented in [CREDITS.md](CREDITS.md).

The presence of a third-party asset in this repository does not transfer its
copyright or grant rights beyond the license provided by its original creator.
