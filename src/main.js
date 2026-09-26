import * as THREE from "three";

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

const enemy = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xff4444 }),
);
enemy.position.set(8, 0.5, 8);
enemy.userData.hp = 30;
scene.add(enemy);

const enemies = [enemy];
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

  const target = findNearestEnemy();

  if (target) {
    direction.subVectors(player.position, target.position).normalize();
    target.position.add(direction.multiplyScalar(0.02));

    if (playerHP > 0 && target.position.distanceTo(player.position) < 1) {
      playerHP -= 10;
      console.log(`HP: ${playerHP}`);
    }

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
