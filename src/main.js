import * as THREE from "three";

const hpElement = document.querySelector("#hp");
const coinCountElement = document.querySelector("#coin-count");
const timerElement = document.querySelector("#timer");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfe8f3);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 9, 10);
camera.lookAt(0, 0, 0);
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

const player = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x4488ff }),
);
player.position.y = 0.5;
scene.add(player);

const enemies = [];
const enemyGeometry = new THREE.BoxGeometry(1, 1, 1);
const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0xff4444 });

function createEnemy() {
  const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
  enemy.userData.hp = 30;
  return enemy;
}

function spawnEnemy() {
  const enemy = createEnemy();
  enemy.position.set(
    THREE.MathUtils.randFloatSpread(20),
    0.5,
    THREE.MathUtils.randFloatSpread(20),
  );
  enemies.push(enemy);
  scene.add(enemy);
}

spawnEnemy();
setInterval(spawnEnemy, 2000);

const coins = [];
const coinGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.08, 16);
const coinMaterial = new THREE.MeshStandardMaterial({ color: 0xffd700 });

function dropCoin(position) {
  const coin = new THREE.Mesh(coinGeometry, coinMaterial);
  coin.position.copy(position);
  coin.position.y = 0.08;
  coins.push(coin);
  scene.add(coin);
}

const bullet = new THREE.Mesh(
  new THREE.SphereGeometry(0.15, 8, 8),
  new THREE.MeshStandardMaterial({ color: 0xffcc33 }),
);
bullet.visible = false;
scene.add(bullet);

scene.add(new THREE.HemisphereLight(0xffffff, 0x445533, 2));

const sunlight = new THREE.DirectionalLight(0xffffff, 3);
sunlight.position.set(5, 10, 7);
scene.add(sunlight);

const keys = {};
const direction = new THREE.Vector3();
let playerHP = 100;
let collectedCoins = 0;
let elapsedSeconds = 0;

setInterval(() => {
  if (elapsedSeconds < 60) {
    elapsedSeconds += 1;
    timerElement.textContent = elapsedSeconds;
  }
}, 1000);

window.addEventListener("keydown", (event) => {
  keys[event.key.toLowerCase()] = true;
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

function findNearestEnemy() {
  let nearestEnemy = null;
  let nearestDistance = Infinity;

  for (const enemy of enemies) {
    const distance = player.position.distanceToSquared(enemy.position);

    if (distance < nearestDistance) {
      nearestEnemy = enemy;
      nearestDistance = distance;
    }
  }

  return nearestEnemy;
}

function animate() {
  requestAnimationFrame(animate);

  if (keys.w) player.position.z -= 0.05;
  if (keys.s) player.position.z += 0.05;
  if (keys.a) player.position.x -= 0.05;
  if (keys.d) player.position.x += 0.05;

  camera.position.copy(player.position).add(cameraOffset);
  camera.lookAt(player.position);

  for (const enemy of enemies) {
    direction.subVectors(player.position, enemy.position).normalize();
    enemy.position.add(direction.multiplyScalar(0.02));

    if (playerHP > 0 && enemy.position.distanceTo(player.position) < 1) {
      playerHP -= 10;
      hpElement.textContent = playerHP;
      console.log(`HP: ${playerHP}`);
    }
  }

  for (let index = coins.length - 1; index >= 0; index -= 1) {
    const coin = coins[index];

    if (coin.position.distanceTo(player.position) < 0.75) {
      scene.remove(coin);
      coins.splice(index, 1);
      collectedCoins += 1;
      coinCountElement.textContent = collectedCoins;
    }
  }

  const target = findNearestEnemy();

  if (target) {
    if (!bullet.visible) {
      bullet.position.copy(player.position);
      bullet.visible = true;
    }

    direction.subVectors(target.position, bullet.position).normalize();
    bullet.position.add(direction.multiplyScalar(0.1));

    if (bullet.position.distanceTo(target.position) < 0.6) {
      target.userData.hp -= 10;
      bullet.visible = false;
      console.log(`Enemy HP: ${target.userData.hp}`);

      if (target.userData.hp <= 0) {
        dropCoin(target.position);
        scene.remove(target);
        enemies.splice(enemies.indexOf(target), 1);
      }
    }
  }

  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
