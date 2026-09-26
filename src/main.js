import * as THREE from "three";

const hpElement = document.querySelector("#hp");
const coinCountElement = document.querySelector("#coin-count");
const timerElement = document.querySelector("#timer");
const PLAYER_SPEED = 3;
const MAP_LIMIT = 9.5;
const INPUT_MS = 50;
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
document.body.appendChild(renderer.domElement);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x88aa66 }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

scene.add(new THREE.HemisphereLight(0xffffff, 0x445533, 2));
const sunlight = new THREE.DirectionalLight(0xffffff, 3);
sunlight.position.set(5, 10, 7);
scene.add(sunlight);

const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
const localPlayerMaterial = new THREE.MeshStandardMaterial({ color: 0x4488ff });
const remotePlayerMaterial = new THREE.MeshStandardMaterial({ color: 0x44dd88 });
const enemyGeometry = new THREE.BoxGeometry(1, 1, 1);
const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0xff4444 });
const bulletGeometry = new THREE.SphereGeometry(0.15, 8, 8);
const bulletMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc33 });
const coinGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.08, 16);
const coinMaterial = new THREE.MeshStandardMaterial({ color: 0xffd700 });

const playerMeshes = new Map();
const enemyMeshes = new Map();
const bulletMeshes = new Map();
const coinMeshes = new Map();
const clock = new THREE.Clock();
let playerId;
let localPlayerAlive = true;
let lastSnapshotSequence = -1;
let nextInputSequence = 1;
let lastInputAt = -Infinity;
let pendingInputs = [];

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

function syncMeshes(items, meshes, createMesh, y) {
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
      scene.remove(mesh);
      meshes.delete(id);
    }
  }
}

function renderState(state) {
  syncMeshes(
    state.players,
    playerMeshes,
    (player) =>
      new THREE.Mesh(
        playerGeometry,
        player.id === playerId ? localPlayerMaterial : remotePlayerMaterial,
      ),
    0.5,
  );
  for (const [id, mesh] of playerMeshes) {
    mesh.material = id === playerId ? localPlayerMaterial : remotePlayerMaterial;
  }
  syncMeshes(
    state.enemies,
    enemyMeshes,
    () => new THREE.Mesh(enemyGeometry, enemyMaterial),
    0.5,
  );
  syncMeshes(
    state.bullets,
    bulletMeshes,
    () => new THREE.Mesh(bulletGeometry, bulletMaterial),
    0.5,
  );
  syncMeshes(
    state.coins,
    coinMeshes,
    () => new THREE.Mesh(coinGeometry, coinMaterial),
    0.08,
  );

  const player = state.players.find(({ id }) => id === playerId);
  if (!player) return;

  pendingInputs = pendingInputs.filter(
    ({ sequence }) => sequence > player.lastProcessedInput,
  );
  const localPlayer = playerMeshes.get(playerId);
  localPlayer.userData.targetPosition.set(player.x, 0.5, player.z);
  for (const input of pendingInputs) {
    applyInput(localPlayer.userData.targetPosition, input);
  }

  hpElement.textContent = player.hp;
  coinCountElement.textContent = player.coins;
  timerElement.textContent = state.elapsedSeconds;
  localPlayerAlive = player.hp > 0;
}

const socketProtocol = location.protocol === "https:" ? "wss" : "ws";
const socket = new WebSocket(`${socketProtocol}://${location.hostname}:8080`);

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);

  if (message.type === "init") playerId = message.playerId;
  if (message.type === "state" && message.sequence > lastSnapshotSequence) {
    lastSnapshotSequence = message.sequence;
    renderState(message);
  }
});

const keys = new Set();

function sendInput(now) {
  if (
    keys.size === 0 ||
    socket.readyState !== WebSocket.OPEN ||
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
    if (id !== playerId) mesh.position.lerp(mesh.userData.targetPosition, interpolation);
  }
  for (const meshes of [enemyMeshes, bulletMeshes]) {
    for (const mesh of meshes.values()) {
      mesh.position.lerp(mesh.userData.targetPosition, interpolation);
    }
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

  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
