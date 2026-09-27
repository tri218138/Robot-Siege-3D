import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { syncInstanceStore } from "./instance-store.js";

const hpElement = document.querySelector("#hp");
const coinCountElement = document.querySelector("#coin-count");
const timerElement = document.querySelector("#timer");
const weaponElement = document.querySelector("#weapon");
const connectionElement = document.querySelector("#connection");
const latencyElement = document.querySelector("#latency");
const PLAYER_SPEED = 3;
const MAP_LIMIT = 9.5;
const INPUT_MS = 50;
const PING_MS = 2000;
const RECONNECT_MS = 1000;
const INPUT_DISTANCE = PLAYER_SPEED * (INPUT_MS / 1000);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfe8f3);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
const cameraOffset = new THREE.Vector3(0, 12, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(24, 24),
  new THREE.MeshStandardMaterial({ color: 0x88aa66 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

scene.add(new THREE.HemisphereLight(0xffffff, 0x445533, 1.2));
const sunlight = new THREE.DirectionalLight(0xffffff, 2.5);
sunlight.position.set(5, 10, 7);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(1024, 1024);
sunlight.shadow.camera.left = -13;
sunlight.shadow.camera.right = 13;
sunlight.shadow.camera.top = 13;
sunlight.shadow.camera.bottom = -13;
sunlight.shadow.camera.near = 0.5;
sunlight.shadow.camera.far = 30;
sunlight.shadow.normalBias = 0.02;
scene.add(sunlight);

const environment = new THREE.Group();
scene.add(environment);
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

function addRoad(geometry, material, x, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, 0.015, z);
  mesh.receiveShadow = true;
  environment.add(mesh);
}

const roadMaterial = new THREE.MeshStandardMaterial({ color: 0xb8976a });
addRoad(new THREE.BoxGeometry(2.6, 0.03, 24), roadMaterial, 0, 0);
addRoad(new THREE.BoxGeometry(24, 0.03, 2.6), roadMaterial, 0, 2.5);

const [forestAsset, wallAsset, barrelAsset, houseAsset] = await Promise.all([
  gltfLoader.loadAsync("/models/environment/forest.glb"),
  gltfLoader.loadAsync("/models/environment/wall.glb"),
  gltfLoader.loadAsync("/models/environment/barrel.glb"),
  gltfLoader.loadAsync("/models/environment/house.glb"),
]);

function addEnvironmentModel(template, x, z, scale, rotationY = 0) {
  const model = template.clone();
  model.position.set(x, 0, z);
  model.rotation.y = rotationY;
  if (Array.isArray(scale)) model.scale.set(...scale);
  else model.scale.setScalar(scale);
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  environment.add(model);
}

function forestModel(name) {
  const model = forestAsset.scene.getObjectByName(name);
  if (!model) throw new Error(`Missing environment model: ${name}`);
  return model;
}

for (const [x, z, rotation] of [
  [-6.5, -10.15, 0],
  [6.5, -10.15, 0],
  [-6.5, 10.15, 0],
  [6.5, 10.15, 0],
  [-10.15, -6.5, Math.PI / 2],
  [-10.15, 6.5, Math.PI / 2],
  [10.15, -6.5, Math.PI / 2],
  [10.15, 6.5, Math.PI / 2],
]) {
  addEnvironmentModel(wallAsset.scene, x, z, [1.12, 0.32, 0.7], rotation);
}

// ponytail: Static props stay beyond MAP_LIMIT; the server boundary remains
// the only collider until obstacle collision becomes server-authoritative.
const treeModels = [
  forestModel("Tree_1_A_Color1"),
  forestModel("Tree_3_A_Color1"),
  forestModel("Tree_4_A_Color1"),
  forestModel("Tree_1_C_Color1"),
];
for (const [x, z, scale, modelIndex, rotation] of [
  [-10.6, -3.5, 0.75, 0, 0.4],
  [-10.6, 3.8, 0.8, 1, 1.2],
  [-7, -10.7, 0.65, 2, 2.1],
  [6.8, -10.7, 0.45, 3, 0.7],
  [10.6, -3.5, 0.8, 1, 2.6],
  [10.6, 4.5, 0.7, 0, 1.8],
  [-7.5, 10.6, 0.7, 2, 0.2],
  [6.5, 10.6, 0.48, 3, 2.9],
]) {
  addEnvironmentModel(treeModels[modelIndex], x, z, scale, rotation);
}

const rockModels = [
  forestModel("Rock_1_D_Color1"),
  forestModel("Rock_1_J_Color1"),
  forestModel("Rock_2_C_Color1"),
  forestModel("Rock_2_G_Color1"),
];
for (const [x, z, scale, modelIndex, rotation] of [
  [-10.4, 8.7, 0.75, 0, 0.3],
  [9.8, 9.8, 0.3, 1, 1.1],
  [10.5, -8.8, 0.65, 2, 2.3],
  [-8.8, -10.5, 0.28, 3, 0.8],
]) {
  addEnvironmentModel(rockModels[modelIndex], x, z, scale, rotation);
}

addEnvironmentModel(houseAsset.scene, -10.7, -10.7, 3, Math.PI / 5);
addEnvironmentModel(barrelAsset.scene, -8.9, -10.7, 0.5, 0.2);
addEnvironmentModel(barrelAsset.scene, -8.1, -10.7, 0.5, -0.3);

const enemyGeometry = new THREE.BoxGeometry(1, 1, 1);
const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0xff4444 });
const bulletGeometry = new THREE.SphereGeometry(0.15, 8, 8);
const bulletMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
const weaponStyles = {
  pistol: {
    label: "Pistol",
    color: new THREE.Color(0xffdd55),
    bulletColor: new THREE.Color(0xffcc33),
  },
  shotgun: {
    label: "Shotgun",
    color: new THREE.Color(0xff8844),
    bulletColor: new THREE.Color(0xff6633),
  },
  machineGun: {
    label: "Machine Gun",
    color: new THREE.Color(0x55ddff),
    bulletColor: new THREE.Color(0x33bbff),
  },
};
const weaponCycle = ["pistol", "shotgun", "machineGun"];
const coinGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.08, 16);
const coinMaterial = new THREE.MeshStandardMaterial({ color: 0xffd700 });

// ponytail: 512 exceeds the current 60-second round load; grow only after
// profiling a larger room or longer round.
const MAX_INSTANCES = 512;
function createInstancedMesh(geometry, material, castShadow = false) {
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
  mesh.count = 0;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = castShadow;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  return mesh;
}

const enemyInstances = createInstancedMesh(
  enemyGeometry,
  enemyMaterial,
  true,
);
const bulletInstances = createInstancedMesh(bulletGeometry, bulletMaterial);
const coinInstances = createInstancedMesh(coinGeometry, coinMaterial, true);
const instanceMatrix = new THREE.Matrix4();

// ponytail: Fixed pool caps VFX cost; raise it only after profiling.
const MAX_PARTICLES = 512;
const particlePositions = new Float32Array(MAX_PARTICLES * 3);
const particleVelocities = new Float32Array(MAX_PARTICLES * 3);
const particleLifetimes = new Float32Array(MAX_PARTICLES);
const particleColors = new Float32Array(MAX_PARTICLES * 3);
for (let i = 1; i < particlePositions.length; i += 3) {
  particlePositions[i] = -100;
}
const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(particlePositions, 3),
);
particleGeometry.setAttribute(
  "color",
  new THREE.BufferAttribute(particleColors, 3),
);
particleGeometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
particleGeometry.attributes.color.setUsage(THREE.DynamicDrawUsage);
const particles = new THREE.Points(
  particleGeometry,
  new THREE.PointsMaterial({
    size: 0.18,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
);
particles.frustumCulled = false;
scene.add(particles);

const hitColor = new THREE.Color(0xff6633);
let nextParticle = 0;

const { scene: playerModel, animations: playerAnimations } =
  await gltfLoader.loadAsync("/models/player.glb");
const playerBounds = new THREE.Box3().setFromObject(playerModel);
const playerSize = playerBounds.getSize(new THREE.Vector3());
playerModel.scale.setScalar(1.8 / playerSize.y);
playerBounds.setFromObject(playerModel);
const playerCenter = playerBounds.getCenter(new THREE.Vector3());
playerModel.position.set(-playerCenter.x, -playerBounds.min.y, -playerCenter.z);
playerModel.traverse((object) => {
  if (!object.isMesh) return;
  object.castShadow = true;
  object.receiveShadow = true;
});

const playerClips = {
  idle: THREE.AnimationClip.findByName(playerAnimations, "Idle"),
  running: THREE.AnimationClip.findByName(playerAnimations, "Running"),
  death: THREE.AnimationClip.findByName(playerAnimations, "Death"),
};

const playerMeshes = new Map();
const enemies = new Map();
const bullets = new Map();
const coins = new Map();
const clock = new THREE.Clock();
let playerId;
let localPlayerAlive = true;
let lastSnapshotSequence = -1;
let nextInputSequence = 1;
let lastInputAt = -Infinity;
let pendingInputs = [];
let selectedWeapon = weaponCycle[0];

function createPlayerModel() {
  const model = clone(playerModel);
  const mixer = new THREE.AnimationMixer(model);
  const actions = Object.fromEntries(
    Object.entries(playerClips).map(([state, clip]) => [
      state,
      mixer.clipAction(clip),
    ]),
  );
  actions.death.setLoop(THREE.LoopOnce, 1);
  actions.death.clampWhenFinished = true;
  actions.idle.play();
  model.userData.animation = { mixer, actions, state: "idle" };
  return model;
}

function setPlayerAnimation(model, state) {
  const animation = model.userData.animation;
  if (animation.state === state) return;

  animation.actions[animation.state].fadeOut(0.2);
  animation.actions[state].reset().fadeIn(0.2).play();
  animation.state = state;
}

function emitParticles(x, y, z, color, count, speed, lifetime = 0.35) {
  for (let n = 0; n < count; n += 1) {
    const particle = nextParticle++ % MAX_PARTICLES;
    const offset = particle * 3;
    particlePositions[offset] = x;
    particlePositions[offset + 1] = y;
    particlePositions[offset + 2] = z;
    particleVelocities[offset] = (Math.random() - 0.5) * speed;
    particleVelocities[offset + 1] = Math.random() * speed;
    particleVelocities[offset + 2] = (Math.random() - 0.5) * speed;
    particleLifetimes[particle] = lifetime;
    particleColors[offset] = color.r;
    particleColors[offset + 1] = color.g;
    particleColors[offset + 2] = color.b;
  }
}

function updateParticles(delta) {
  for (let particle = 0; particle < MAX_PARTICLES; particle += 1) {
    if (particleLifetimes[particle] <= 0) continue;

    const offset = particle * 3;
    particleLifetimes[particle] -= delta;
    if (particleLifetimes[particle] <= 0) {
      particlePositions[offset + 1] = -100;
      continue;
    }

    particleVelocities[offset + 1] -= 2.5 * delta;
    particlePositions[offset] += particleVelocities[offset] * delta;
    particlePositions[offset + 1] += particleVelocities[offset + 1] * delta;
    particlePositions[offset + 2] += particleVelocities[offset + 2] * delta;
  }

  particleGeometry.attributes.position.needsUpdate = true;
  particleGeometry.attributes.color.needsUpdate = true;
}

function applyInput(position, input) {
  const length = Math.hypot(input.moveX, input.moveZ) || 1;
  position.x = THREE.MathUtils.clamp(
    position.x + (input.moveX / length) * INPUT_DISTANCE,
    -MAP_LIMIT,
    MAP_LIMIT,
  );
  position.z = THREE.MathUtils.clamp(
    position.z + (input.moveZ / length) * INPUT_DISTANCE,
    -MAP_LIMIT,
    MAP_LIMIT,
  );
}

function syncMeshes(items, meshes, createMesh, y, onRemove) {
  const currentIds = new Set();

  for (const item of items) {
    currentIds.add(item.id);
    let mesh = meshes.get(item.id);

    if (!mesh) {
      mesh = createMesh(item);
      mesh.userData.targetPosition = new THREE.Vector3(item.x, y, item.z);
      mesh.position.copy(mesh.userData.targetPosition);
      meshes.set(item.id, mesh);
      scene.add(mesh);
    } else {
      mesh.userData.targetPosition.set(item.x, y, item.z);
    }
  }

  for (const [id, mesh] of meshes) {
    if (!currentIds.has(id)) {
      onRemove?.(mesh);
      scene.remove(mesh);
      meshes.delete(id);
    }
  }
}

function syncInstances(items, instances, y, onCreate, onRemove) {
  syncInstanceStore(
    items,
    instances,
    MAX_INSTANCES,
    (item) => {
      const position = new THREE.Vector3(item.x, y, item.z);
      const instance = {
        position,
        targetPosition: position.clone(),
      };
      onCreate?.(instance, item);
      return instance;
    },
    (instance, item) => instance.targetPosition.set(item.x, y, item.z),
    onRemove,
  );
}

function updateInstances(mesh, instances, interpolation) {
  let index = 0;

  for (const instance of instances.values()) {
    instance.position.lerp(instance.targetPosition, interpolation);
    instanceMatrix.makeTranslation(
      instance.position.x,
      instance.position.y,
      instance.position.z,
    );
    mesh.setMatrixAt(index, instanceMatrix);
    if (instance.color) mesh.setColorAt(index, instance.color);
    index += 1;
  }

  mesh.count = index;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

function renderState(state) {
  syncMeshes(state.players, playerMeshes, createPlayerModel, 0);
  for (const player of state.players) {
    playerMeshes.get(player.id).userData.dead = player.hp === 0;
  }
  syncInstances(
    state.enemies,
    enemies,
    0.5,
    undefined,
    (enemy) =>
      emitParticles(
        enemy.position.x,
        enemy.position.y,
        enemy.position.z,
        hitColor,
        18,
        3,
        0.55,
      ),
  );
  syncInstances(
    state.bullets,
    bullets,
    0.5,
    (bullet, { x, z, weapon }) => {
      const style = weaponStyles[weapon] ?? weaponStyles.pistol;
      emitParticles(x, 0.5, z, style.color, 6, 2);
      bullet.color = style.bulletColor;
      bullet.trailColor = style.color;
    },
    (bullet) =>
      emitParticles(
        bullet.position.x,
        bullet.position.y,
        bullet.position.z,
        bullet.trailColor,
        5,
        1.5,
      ),
  );
  syncInstances(state.coins, coins, 0.08);

  const player = state.players.find(({ id }) => id === playerId);
  if (!player) return;

  pendingInputs = pendingInputs.filter(
    ({ sequence }) => sequence > player.lastProcessedInput,
  );
  const localPlayer = playerMeshes.get(playerId);
  localPlayer.userData.targetPosition.set(player.x, 0, player.z);
  for (const input of pendingInputs) {
    applyInput(localPlayer.userData.targetPosition, input);
  }

  hpElement.textContent = player.hp;
  coinCountElement.textContent = player.coins;
  timerElement.textContent = state.elapsedSeconds;
  weaponElement.textContent = weaponStyles[player.weapon]?.label ?? "Pistol";
  localPlayerAlive = player.hp > 0;
}

const keys = new Set();
const socketProtocol = location.protocol === "https:" ? "wss" : "ws";
const socketUrl = `${socketProtocol}://${location.hostname}:8080`;
let socket;
let pingTimer;
let reconnectTimer;

function setConnectionStatus(label, state) {
  connectionElement.textContent = label;
  connectionElement.dataset.state = state;
}

function connectSocket() {
  clearTimeout(reconnectTimer);
  playerId = undefined;
  lastSnapshotSequence = -1;
  nextInputSequence = 1;
  lastInputAt = -Infinity;
  pendingInputs = [];
  selectedWeapon = weaponCycle[0];
  localPlayerAlive = true;
  setConnectionStatus("Connecting…", "connecting");
  latencyElement.textContent = "--";

  const connection = new WebSocket(socketUrl);
  socket = connection;

  connection.addEventListener("open", () => {
    setConnectionStatus("Online", "online");

    const ping = () => {
      if (connection.readyState === WebSocket.OPEN) {
        connection.send(
          JSON.stringify({ type: "ping", sentAt: performance.now() }),
        );
      }
    };
    ping();
    pingTimer = setInterval(ping, PING_MS);
  });

  connection.addEventListener("message", (event) => {
    if (connection !== socket) return;
    const message = JSON.parse(event.data);

    if (message.type === "pong" && Number.isFinite(message.sentAt)) {
      latencyElement.textContent = Math.max(
        0,
        Math.round(performance.now() - message.sentAt),
      );
      return;
    }
    if (message.type === "init") playerId = message.playerId;
    if (message.type === "state" && message.sequence > lastSnapshotSequence) {
      lastSnapshotSequence = message.sequence;
      renderState(message);
    }
  });

  connection.addEventListener("close", () => {
    if (connection !== socket) return;
    clearInterval(pingTimer);
    keys.clear();
    pendingInputs = [];
    setConnectionStatus("Reconnecting…", "connecting");
    latencyElement.textContent = "--";
    // ponytail: Fixed retry is enough locally; add backoff for public hosting.
    reconnectTimer = setTimeout(connectSocket, RECONNECT_MS);
  });
}

connectSocket();

function sendInput(now) {
  if (
    keys.size === 0 ||
    socket?.readyState !== WebSocket.OPEN ||
    now - lastInputAt < INPUT_MS
  ) {
    return;
  }

  lastInputAt = now;
  const input = {
    type: "input",
    sequence: nextInputSequence++,
    moveX: Number(keys.has("d")) - Number(keys.has("a")),
    moveZ: Number(keys.has("s")) - Number(keys.has("w")),
  };
  pendingInputs.push(input);
  socket.send(JSON.stringify(input));

  const localPlayer = playerMeshes.get(playerId);
  if (localPlayerAlive && localPlayer) {
    applyInput(localPlayer.userData.targetPosition, input);
  }
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    if (!event.repeat && socket?.readyState === WebSocket.OPEN) {
      const currentIndex = weaponCycle.indexOf(selectedWeapon);
      selectedWeapon = weaponCycle[(currentIndex + 1) % weaponCycle.length];
      socket.send(JSON.stringify({ type: "weapon", weapon: selectedWeapon }));
    }
    return;
  }

  const key = event.key.toLowerCase();
  if (!"wasd".includes(key) || keys.has(key)) return;
  keys.add(key);
  lastInputAt = -Infinity;
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("blur", () => {
  keys.clear();
});

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);
  const interpolation = 1 - Math.exp(-15 * delta);
  sendInput(performance.now());

  for (const [id, mesh] of playerMeshes) {
    const moving =
      mesh.position.distanceToSquared(mesh.userData.targetPosition) > 0.0001;
    setPlayerAnimation(
      mesh,
      mesh.userData.dead ? "death" : moving ? "running" : "idle",
    );
    if (moving && !mesh.userData.dead) {
      mesh.lookAt(
        mesh.userData.targetPosition.x,
        mesh.position.y,
        mesh.userData.targetPosition.z,
      );
    }
    if (id !== playerId) {
      mesh.position.lerp(mesh.userData.targetPosition, interpolation);
    }
    mesh.userData.animation.mixer.update(delta);
  }
  updateInstances(enemyInstances, enemies, interpolation);
  updateInstances(bulletInstances, bullets, interpolation);
  updateInstances(coinInstances, coins, interpolation);
  for (const bullet of bullets.values()) {
    emitParticles(
      bullet.position.x,
      bullet.position.y,
      bullet.position.z,
      bullet.trailColor,
      1,
      0.15,
      0.2,
    );
  }

  const localPlayer = playerMeshes.get(playerId);
  if (localPlayer) {
    if (localPlayer.position.distanceToSquared(localPlayer.userData.targetPosition) > 4) {
      localPlayer.position.copy(localPlayer.userData.targetPosition);
    } else {
      localPlayer.position.lerp(
        localPlayer.userData.targetPosition,
        1 - Math.exp(-25 * delta),
      );
    }

    camera.position.copy(localPlayer.position).add(cameraOffset);
    camera.lookAt(localPlayer.position);
  }

  updateParticles(delta);
  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
