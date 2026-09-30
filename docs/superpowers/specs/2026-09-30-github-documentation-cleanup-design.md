# GitHub Documentation Cleanup Design

## Purpose

Prepare the project for a public GitHub repository and a YouTube showcase while
keeping it clearly positioned as a personal learning project. All public-facing
project documentation and metadata will be written in English.

## Scope

This cleanup changes documentation, document names, and package metadata only.
It does not reorganize source code, change imports, move runtime assets, or alter
the application's build and runtime behavior.

## Project Identity

- Display name: **Robot Survivor Three.js**
- Recommended GitHub repository slug: **`robot-survivor-threejs`**
- npm package name: **`robot-survivor-threejs`**
- Positioning: a browser-based multiplayer survival game built to learn Three.js,
  real-time WebSocket networking, game-state synchronization, and web game
  performance techniques.

## Documentation Structure

The public documentation will use this structure:

- `README.md`: project overview, features, technology stack, controls, setup,
  scripts, high-level repository structure, learning-project notice, and a link
  to the root credits file.
- `CREDITS.md`: the single authoritative record for third-party graphics, 3D
  models, textures, music, and sound effects, including creators, source links,
  modifications, and licenses.
- `docs/LEARNING_ROADMAP.md`: a concise English roadmap distilled from the two
  existing Vietnamese planning files, `PLAN.md` and `PLAN2.md`.

The two generic planning files will be removed after their useful content is
consolidated. Nested credits documents will also be removed after all provenance
details are preserved in the root `CREDITS.md`. Runtime asset files and their
paths remain unchanged.

## README Content

The README will introduce the current game rather than describe aspirational
features. It will document:

- the survival loop, enemy waves, boss encounter, weapons, coins, multiplayer,
  audio, animation, and performance optimizations currently present;
- Node.js and npm requirements;
- separate commands for the WebSocket server and Vite client;
- keyboard controls and the default local URLs;
- available npm scripts and the asset-rebuild workflow;
- a compact repository map that reflects the existing source layout;
- an explicit notice that the repository is a personal learning project; and
- a clear statement that third-party graphics and audio remain the property of
  their respective creators and are documented in `CREDITS.md`.

The README will not claim production readiness, ownership of third-party assets,
or licensing rights beyond those recorded by the original creators.

## Credits Requirements

The root `CREDITS.md` will preserve every attribution currently recorded in:

- `public/models/README.md`;
- `public/models/environment/CREDITS.md`; and
- `public/audio/CREDITS.md`.

It will distinguish third-party asset licenses from the status of the project's
source code. No new source-code license will be selected as part of this task.

## External Publishing Copy

The final handoff will include:

- a recommended GitHub repository description and topic list; and
- one English YouTube title and description suitable for a project showcase.

This publishing copy will be delivered in the conversation and will not require
an additional repository file.

## Verification

After the documentation cleanup:

1. Search tracked public-facing Markdown and package metadata for obsolete
   project names, broken internal links, and remaining Vietnamese copy.
2. Run the automated test suite.
3. Run the asset build to confirm the consolidated credits cleanup does not
   affect asset generation.
4. Run the production build to confirm metadata and documentation changes do
   not affect the application bundle.

## Success Criteria

- A visitor can understand the game, run it locally, and identify its learning
  purpose from the root README.
- Public-facing repository documentation and metadata are in English.
- All existing graphics and audio attribution remains accessible from one root
  `CREDITS.md` file.
- Generic planning filenames are replaced by one descriptive roadmap document.
- Tests, asset generation, and the production build still pass.
