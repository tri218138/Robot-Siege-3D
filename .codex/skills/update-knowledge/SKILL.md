---
name: update-knowledge
description: Keep `.codex/docs` synchronized with the implemented architecture, runtime behavior, network protocol, invariants, commands, and extension points. Use after code changes that affect system knowledge or when asked to document, refresh, or reconcile the project's technical knowledge. Do not use for user-facing product documentation or speculative roadmap writing.
---

# Update Knowledge

Maintain reusable agent knowledge in `.codex/docs` without duplicating source code or documenting unimplemented plans.

## Read First

Always read `.codex/docs/README.md`, then route by the code or behavior in scope:

- Cross-cutting ownership, data flow, file responsibilities, or invariants: `architecture.md`
- Authoritative simulation, gameplay rules, or entity lifecycle: `server-gameplay.md`
- Rendering, prediction, interpolation, animation, assets, VFX, camera, or HUD: `client-runtime.md`
- WebSocket messages, sequencing, snapshots, validation, or reconciliation: `network-protocol.md`
- Commands, dependencies, verification, ports, or operational constraints: `development.md`

Read the affected source files as well. The implementation is the source of truth; `PLAN.md` and `PLAN2.md` are roadmaps, not evidence that a feature exists.

## Update Workflow

1. Inspect `git status`, the relevant diff, and every source path affected by the change. Preserve unrelated user edits.
2. Identify which documented facts changed: responsibilities, runtime sequence, message fields, constants, invariants, commands, tests, assets, limitations, or extension points.
3. Update only the affected documents. Add a new document only when an existing topic can no longer stay focused.
4. Describe current behavior and why its constraints matter to future changes. Refer to stable file paths and symbol names; avoid fragile line numbers and large copied code blocks.
5. Keep cross-document links and `.codex/docs/README.md` accurate. Store each fact in one primary document and link to it instead of duplicating it.
6. Remove stale claims when behavior is deleted. Mark genuine current limitations explicitly; do not turn future roadmap ideas into present-tense behavior.
7. Compare the finished docs against the source and run `git diff --check`. Run the repository's relevant test/build commands when the same task changed executable code.

## Required Knowledge Properties

- Preserve the server-authoritative boundary: client input is intent, while the server owns positions, HP, coins, enemies, bullets, and the game clock.
- Keep coupled constants and flows visible, especially input cadence/prediction, snapshot acknowledgements, entity IDs, interpolation targets, and lifecycle-derived VFX.
- Document protocol schemas from the actual serializer and message handlers, including fields intentionally excluded from snapshots.
- Record meaningful ceilings and upgrade triggers, such as the single in-memory room and fixed particle pool.
- State known omissions plainly. Do not invent reconnect behavior, persistence, physics, rooms, database usage, or combat events that the code does not implement.

## Boundaries

Do not modify `PLAN.md` or `PLAN2.md` unless the user explicitly asks. Do not change application behavior merely to make it match existing docs; report the discrepancy or update the docs to match verified code. Do not create changelogs, duplicate READMEs, or generic tutorials.
