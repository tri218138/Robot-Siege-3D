# Player model

`player.glb` is RobotExpressive by Tomás Laulhé, modified by Don McCurdy.

- Source: https://github.com/mrdoob/three.js/tree/r186/examples/models/gltf/RobotExpressive
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)

# Enemy model

`enemy.glb` is derived from `Skeleton_Minion.glb` in Kay Lousberg's KayKit
Character Pack: Skeletons 1.0.

- Pinned source: [official repository at `15b62b9`](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0/blob/15b62b9bad122f72926c10fb14d622c73819fa54/addons/kaykit_character_pack_skeletons/Characters/gltf/Skeleton_Minion.glb)
- Original SHA-256: `6ffc003f895bed0b074791e0e490846210a2e2f8fc7da300aba53cc185f95968`
- License: [CC0 1.0 Universal](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0/blob/15b62b9bad122f72926c10fb14d622c73819fa54/LICENSE.txt)

`npm run assets` retains only `Idle`, `Walking_D_Skeletons`, and
`Death_C_Skeletons`, downsizes the gradient texture to 256², and applies
Meshopt compression for the runtime file.

Environment model provenance is recorded in
[`environment/CREDITS.md`](environment/CREDITS.md).
