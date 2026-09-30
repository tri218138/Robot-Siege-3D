# Third-Party Asset Credits

Robot Survivor Three.js is a personal learning project. The graphics, 3D models,
textures, music, and sound effects listed below remain the work of their
respective creators and are used under the licenses linked in this document.

This file covers third-party media assets only. It does not define a license for
the project's source code.

## 3D Models and Graphics

### Player

`public/models/player.glb` is **RobotExpressive** by Tomás Laulhé, modified by
Don McCurdy.

- Source: [Three.js RobotExpressive model](https://github.com/mrdoob/three.js/tree/r186/examples/models/gltf/RobotExpressive)
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)

### Enemy

`public/models/enemy.glb` is derived from `Skeleton_Minion.glb` in Kay Lousberg's
**KayKit Character Pack: Skeletons 1.0**.

- Source: [Pinned file in the official repository](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0/blob/15b62b9bad122f72926c10fb14d622c73819fa54/addons/kaykit_character_pack_skeletons/Characters/gltf/Skeleton_Minion.glb)
- License: [CC0 1.0 Universal](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0/blob/15b62b9bad122f72926c10fb14d622c73819fa54/LICENSE.txt)
- Original SHA-256: `6ffc003f895bed0b074791e0e490846210a2e2f8fc7da300aba53cc185f95968`

The asset build keeps the `Idle`, `Walking_D_Skeletons`, and
`Death_C_Skeletons` animations, resizes the gradient texture to 256², and
applies Meshopt compression.

### Environment

All environment assets are licensed under
[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

| Runtime files | Creator and pack | Source |
| --- | --- | --- |
| `public/models/environment/forest.glb` | Kay Lousberg, KayKit Forest Nature Pack | [Bundled GLB](https://github.com/Station-Sciences/bot-crossing/blob/d05ac2ffad9fce3d68e29ab446fce99b7123847b/public/assets/forest.glb), built from the [official pack](https://kaylousberg.itch.io/kaykit-forest) |
| `public/models/environment/wall.glb`, `barrel.glb` | Kay Lousberg, KayKit Dungeon Remastered | [Official repository](https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0/tree/b0ca9bd96a8072ab36a3a5464f00ed1e06a16d07/addons/kaykit_dungeon_remastered/Assets/gltf) |
| `public/models/environment/house.glb` | Kay Lousberg, KayKit Medieval Hexagon Pack | [Official repository](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0/tree/84fa4e91af6a88989be7c99e0891cede11f2ca38/addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/red) |

Original downloads are stored under `assets/source/`. Run `npm run assets` to
rebuild the optimized runtime files.

## Audio

All audio files are released under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

### Background Music

- `public/audio/bgm.ogg`: `levelmusicloop-tigrun.ogg` from
  [Two Simple Game Music Loops](https://opengameart.org/content/two-simple-game-music-loops)
  by qubodup.

### Sound Effects

The following files are from Kenney's
[Digital Audio](https://kenney.nl/assets/digital-audio) pack:

- `public/audio/shot-pistol.ogg`: `laser1.ogg`
- `public/audio/shot-shotgun.ogg`: `laser5.ogg`
- `public/audio/shot-machine-gun.ogg`: `laser8.ogg`

The following files are from Kenney's
[Impact Sounds](https://kenney.nl/assets/impact-sounds) pack:

- `public/audio/hit.ogg`: `impactGeneric_light_000.ogg`
- `public/audio/enemy-death.ogg`: `impactPunch_heavy_000.ogg`
- `public/audio/damage.ogg`: `impactSoft_heavy_000.ogg`

The following files are from Kenney's
[Interface Sounds](https://kenney.nl/assets/interface-sounds) pack:

- `public/audio/coin.ogg`: `confirmation_001.ogg`
- `public/audio/ui-click.ogg`: `select_001.ogg`
