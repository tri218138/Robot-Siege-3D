import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceDir = join(root, "assets/source/environment");
const enemySource = join(root, "assets/source/enemy/Skeleton_Minion.glb");
const outputDir = join(root, "public/models/environment");
const enemyOutput = join(root, "public/models/enemy.glb");
const cli = join(root, "node_modules/@gltf-transform/cli/bin/cli.js");
const workDir = await mkdtemp(join(tmpdir(), "robot-three-assets-"));
const assets = [
  ["forest.glb", "forest.glb"],
  ["wall.glb", "wall.glb"],
  ["barrel.glb", "barrel.glb"],
  ["building_home_A_red.gltf", "house.glb"],
];

function run(...args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(`gltf-transform ${args[0]} failed`);
}

async function assertForestModels(path) {
  const glb = await readFile(path);
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  const names = new Set(json.nodes.map((node) => node.name));
  for (const name of [
    "Tree_1_A_Color1",
    "Tree_3_A_Color1",
    "Tree_4_A_Color1",
    "Tree_1_C_Color1",
    "Rock_1_D_Color1",
    "Rock_1_J_Color1",
    "Rock_2_C_Color1",
    "Rock_2_G_Color1",
  ]) {
    if (!names.has(name)) throw new Error(`Optimized forest is missing ${name}`);
  }
}

async function assertEnemy(path) {
  const glb = await readFile(path);
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  const animations = json.animations.map(({ name }) => name).sort();
  const expected = ["Death_C_Skeletons", "Idle", "Walking_D_Skeletons"];
  if (animations.join() !== expected.join()) {
    throw new Error(`Unexpected enemy animations: ${animations.join(", ")}`);
  }
  const eyes = json.nodes.find(({ name }) => name === "Skeleton_Minion_Eyes");
  if (!eyes) {
    throw new Error("Optimized enemy is missing Skeleton_Minion_Eyes");
  }
  const glowMaterial = json.materials.findIndex(
    ({ name, emissiveFactor }) =>
      name === "Glow" && emissiveFactor?.some((value) => value > 0),
  );
  if (glowMaterial === -1) {
    throw new Error("Optimized enemy is missing its emissive Glow material");
  }
  if (
    !json.meshes[eyes.mesh].primitives.some(
      ({ material }) => material === glowMaterial,
    )
  ) {
    throw new Error("Optimized enemy eyes do not use the Glow material");
  }
}

async function buildEnemy() {
  const document = await new NodeIO().read(enemySource);
  const keepAnimations = new Set([
    "Idle",
    "Walking_D_Skeletons",
    "Death_C_Skeletons",
  ]);
  for (const animation of document.getRoot().listAnimations()) {
    if (!keepAnimations.has(animation.getName())) animation.dispose();
  }

  const prepared = join(workDir, "enemy-prepared.glb");
  const output = join(workDir, "enemy.glb");
  await new NodeIO().write(prepared, document);
  run(
    "optimize",
    prepared,
    output,
    "--compress",
    "meshopt",
    "--texture-compress",
    "webp",
    "--texture-size",
    "256",
    "--flatten",
    "false",
    "--join",
    "false",
    "--instance",
    "false",
    "--palette",
    "false",
    "--simplify",
    "false",
  );
  run("validate", output, "--ignore", "UNSUPPORTED_EXTENSION");
  return output;
}

try {
  await mkdir(outputDir, { recursive: true });
  for (const [inputName, outputName] of assets) {
    const input = join(sourceDir, inputName);
    const output = join(workDir, outputName);
    run(
      "optimize",
      input,
      output,
      "--compress",
      "meshopt",
      "--texture-compress",
      "webp",
      "--flatten",
      "false",
      "--join",
      "false",
      "--instance",
      "false",
      "--simplify",
      "false",
    );
    run("validate", output, "--ignore", "UNSUPPORTED_EXTENSION");
  }

  const builtEnemy = await buildEnemy();
  await assertForestModels(join(workDir, "forest.glb"));
  await assertEnemy(builtEnemy);
  for (const [, outputName] of assets) {
    const output = join(workDir, outputName);
    await copyFile(output, join(outputDir, outputName));
    console.log(`${outputName}: ${(await stat(output)).size} bytes`);
  }
  await copyFile(builtEnemy, enemyOutput);
  console.log(`enemy.glb: ${(await stat(builtEnemy)).size} bytes`);
} finally {
  await rm(workDir, { recursive: true, force: true });
}
