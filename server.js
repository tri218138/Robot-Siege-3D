import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";

const TICK_MS = 50;
const SNAPSHOT_MS = 100;
const MAX_BUFFERED_BYTES = 64 * 1024;
const MAX_INPUT_QUEUE = 4;
const PLAYER_SPEED = 3;
const ENEMY_SPEED = 1.2;
const ENEMY_SEPARATION_RADIUS = 1.25;
const ENEMY_SEPARATION_WEIGHT = 1.5;
const MAP_LIMIT = 9.5;
const GAME_DURATION_MS = 60_000;

export const WEAPONS = Object.freeze({
  pistol: {
    damage: 10,
    fireRate: 2,
    range: 10,
    projectileSpeed: 7,
    projectiles: 1,
    spread: 0,
  },
  shotgun: {
    damage: 6,
    fireRate: 1,
    range: 7,
    projectileSpeed: 7,
    projectiles: 5,
    spread: 25,
  },
  machineGun: {
    damage: 4,
    fireRate: 10,
    range: 12,
    projectileSpeed: 9,
    projectiles: 1,
    spread: 0,
  },
});

// ponytail: One in-memory room is enough here; add rooms/storage for deployment.
const players = new Map();
const enemies = new Map();
const bullets = new Map();
const coins = new Map();
let startedAt;
let nextEnemyAt;
let nextSnapshotAt;
let nextEntityId = 0;
let snapshotSequence = 0;
let lastTick = Date.now();

export const server = new WebSocketServer({
  host: "127.0.0.1",
  port: Number(process.env.PORT ?? 8080),
});

function resetGame() {
  enemies.clear();
  bullets.clear();
  coins.clear();
  nextEntityId = 0;
  snapshotSequence = 0;
  startedAt = Date.now();
  nextEnemyAt = startedAt;
  nextSnapshotAt = startedAt;
  lastTick = startedAt;
}

function gameState() {
  const elapsedSeconds = Math.min(
    Math.floor((Date.now() - startedAt) / 1000),
    GAME_DURATION_MS / 1000,
  );

  return {
    type: "state",
    sequence: ++snapshotSequence,
    elapsedSeconds,
    players: [...players.values()].map(
      ({ inputQueue, lastReceivedInput, nextShotAt, ...player }) => player,
    ),
    enemies: [...enemies.values()].map(({ nextDamageAt, ...enemy }) => enemy),
    bullets: [...bullets.values()].map(
      ({
        damage,
        directionX,
        directionZ,
        projectileSpeed,
        remainingRange,
        ...bullet
      }) => bullet,
    ),
    coins: [...coins.values()],
  };
}

function broadcastState(targets = server.clients) {
  // ponytail: Full snapshots recover from packet loss; add deltas only after profiling.
  const data = JSON.stringify(gameState(), (_key, value) =>
    typeof value === "number" ? Math.round(value * 1000) / 1000 : value,
  );

  for (const client of targets) {
    if (
      client.readyState === WebSocket.OPEN &&
      client.bufferedAmount < MAX_BUFFERED_BYTES
    ) {
      client.send(data);
    }
  }
}

function findNearest(items, position) {
  let nearest;
  let nearestDistance = Infinity;

  for (const item of items) {
    if (item.hp === 0) continue;
    const distance = (item.x - position.x) ** 2 + (item.z - position.z) ** 2;

    if (distance < nearestDistance) {
      nearest = item;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  const offset = Math.random() * MAP_LIMIT * 2 - MAP_LIMIT;
  const enemy = {
    id: `enemy-${++nextEntityId}`,
    x: side < 2 ? (side === 0 ? -MAP_LIMIT : MAP_LIMIT) : offset,
    z: side >= 2 ? (side === 2 ? -MAP_LIMIT : MAP_LIMIT) : offset,
    hp: 30,
    nextDamageAt: 0,
  };
  enemies.set(enemy.id, enemy);
}

// ponytail: O(n²) is fine for this short round; add a spatial grid if the
// spawn ceiling grows enough to show up in profiling.
export function enemySeparation(enemy, allEnemies) {
  let x = 0;
  let z = 0;

  for (const other of allEnemies) {
    if (other.id === enemy.id) continue;
    const dx = enemy.x - other.x;
    const dz = enemy.z - other.z;
    const distance = Math.hypot(dx, dz);
    if (distance >= ENEMY_SEPARATION_RADIUS) continue;

    if (distance === 0) {
      x += enemy.id < other.id ? -1 : 1;
      continue;
    }

    const strength = 1 - distance / ENEMY_SEPARATION_RADIUS;
    x += (dx / distance) * strength;
    z += (dz / distance) * strength;
  }

  return { x, z };
}

export function weaponDirections(weaponId, source, target) {
  const weapon = WEAPONS[weaponId];
  const aim = Math.atan2(target.z - source.z, target.x - source.x);
  const spread = (weapon.spread * Math.PI) / 180;
  const firstAngle = aim - spread / 2;
  const angleStep =
    weapon.projectiles === 1 ? 0 : spread / (weapon.projectiles - 1);

  return Array.from({ length: weapon.projectiles }, (_, index) => {
    const angle = firstAngle + angleStep * index;
    return { x: Math.cos(angle), z: Math.sin(angle) };
  });
}

function updatePlayers() {
  for (const player of players.values()) {
    const input = player.inputQueue.shift();
    if (!input) continue;
    player.lastProcessedInput = input.sequence;
    if (player.hp === 0) continue;

    const length = Math.hypot(input.x, input.z) || 1;
    player.x = Math.max(
      -MAP_LIMIT,
      Math.min(
        MAP_LIMIT,
        player.x + (input.x / length) * PLAYER_SPEED * (TICK_MS / 1000),
      ),
    );
    player.z = Math.max(
      -MAP_LIMIT,
      Math.min(
        MAP_LIMIT,
        player.z + (input.z / length) * PLAYER_SPEED * (TICK_MS / 1000),
      ),
    );
  }
}

function updateEnemies(delta, now) {
  for (const enemy of enemies.values()) {
    const target = findNearest(players.values(), enemy);
    if (!target) continue;

    const x = target.x - enemy.x;
    const z = target.z - enemy.z;
    const distance = Math.hypot(x, z);
    let moveX = 0;
    let moveZ = 0;

    if (distance < 1) {
      if (now >= enemy.nextDamageAt) {
        target.hp = Math.max(0, target.hp - 10);
        enemy.nextDamageAt = now + 1000;
      }
    } else {
      moveX = x / distance;
      moveZ = z / distance;
    }

    const separation = enemySeparation(enemy, enemies.values());
    moveX += separation.x * ENEMY_SEPARATION_WEIGHT;
    moveZ += separation.z * ENEMY_SEPARATION_WEIGHT;
    const moveLength = Math.hypot(moveX, moveZ);

    if (moveLength > 0) {
      enemy.x = Math.max(
        -MAP_LIMIT,
        Math.min(
          MAP_LIMIT,
          enemy.x + (moveX / moveLength) * ENEMY_SPEED * delta,
        ),
      );
      enemy.z = Math.max(
        -MAP_LIMIT,
        Math.min(
          MAP_LIMIT,
          enemy.z + (moveZ / moveLength) * ENEMY_SPEED * delta,
        ),
      );
    }
  }
}

function shoot(now) {
  for (const player of players.values()) {
    if (player.hp === 0 || now < player.nextShotAt) continue;
    const target = findNearest(enemies.values(), player);
    if (!target) continue;
    const weapon = WEAPONS[player.weapon];
    const distance = Math.hypot(target.x - player.x, target.z - player.z);
    if (distance > weapon.range) continue;

    for (const direction of weaponDirections(player.weapon, player, target)) {
      const bullet = {
        id: `bullet-${++nextEntityId}`,
        weapon: player.weapon,
        x: player.x,
        z: player.z,
        directionX: direction.x,
        directionZ: direction.z,
        damage: weapon.damage,
        projectileSpeed: weapon.projectileSpeed,
        remainingRange: weapon.range,
      };
      bullets.set(bullet.id, bullet);
    }
    player.nextShotAt = now + 1000 / weapon.fireRate;
  }
}

function updateBullets(delta) {
  for (const bullet of bullets.values()) {
    const step = Math.min(bullet.projectileSpeed * delta, bullet.remainingRange);
    bullet.x += bullet.directionX * step;
    bullet.z += bullet.directionZ * step;
    bullet.remainingRange -= step;

    const target = findNearest(enemies.values(), bullet);
    if (
      target &&
      (target.x - bullet.x) ** 2 + (target.z - bullet.z) ** 2 <= 0.6 ** 2
    ) {
      target.hp -= bullet.damage;
      bullets.delete(bullet.id);

      if (target.hp <= 0) {
        coins.set(target.id, { id: target.id, x: target.x, z: target.z });
        enemies.delete(target.id);
      }
    } else if (bullet.remainingRange <= 0) {
      bullets.delete(bullet.id);
    }
  }
}

function collectCoins() {
  for (const coin of coins.values()) {
    for (const player of players.values()) {
      if ((coin.x - player.x) ** 2 + (coin.z - player.z) ** 2 < 0.75 ** 2) {
        player.coins += 1;
        coins.delete(coin.id);
        break;
      }
    }
  }
}

function tick() {
  const now = Date.now();
  const delta = Math.min((now - lastTick) / 1000, 0.1);
  lastTick = now;
  if (players.size === 0) return;

  const gameRunning = now - startedAt < GAME_DURATION_MS;
  updatePlayers();

  // Spawn 10 enemies at the beginning
  if (enemies.size === 0) {
    for (let i = 0; i < 10; i++) {
      spawnEnemy();
    }
  }

  if (gameRunning) {
    if (now >= nextEnemyAt) {
      spawnEnemy();
      nextEnemyAt = now + 2000;
    }
    updateEnemies(delta, now);
    shoot(now);
    updateBullets(delta);
    collectCoins();
  }

  if (now >= nextSnapshotAt) {
    broadcastState();
    nextSnapshotAt = now + SNAPSHOT_MS;
  }
}

server.on("connection", (socket) => {
  if (players.size === 0) resetGame();

  const player = {
    id: randomUUID(),
    x: players.size * 2,
    z: 0,
    hp: 100,
    coins: 0,
    weapon: "pistol",
    inputQueue: [],
    lastReceivedInput: 0,
    lastProcessedInput: 0,
    nextShotAt: 0,
  };
  players.set(player.id, player);
  socket.send(JSON.stringify({ type: "init", playerId: player.id }));
  broadcastState([socket]);

  socket.on("message", (rawMessage) => {
    let message;

    try {
      message = JSON.parse(rawMessage.toString());
    } catch {
      return;
    }

    if (!message || typeof message !== "object") return;
    if (message.type === "weapon") {
      if (Object.hasOwn(WEAPONS, message.weapon)) player.weapon = message.weapon;
      return;
    }

    if (
      message.type !== "input" ||
      !Number.isSafeInteger(message.sequence) ||
      message.sequence <= player.lastReceivedInput ||
      !Number.isFinite(message.moveX) ||
      !Number.isFinite(message.moveZ)
    ) {
      return;
    }

    player.lastReceivedInput = message.sequence;
    if (player.inputQueue.length === MAX_INPUT_QUEUE) {
      const droppedInput = player.inputQueue.shift();
      player.lastProcessedInput = droppedInput.sequence;
    }
    player.inputQueue.push({
      sequence: message.sequence,
      x: Math.max(-1, Math.min(1, message.moveX)),
      z: Math.max(-1, Math.min(1, message.moveZ)),
    });
  });

  socket.on("close", () => {
    players.delete(player.id);
    if (players.size > 0) broadcastState();
  });
});

const gameLoop = setInterval(tick, TICK_MS);
gameLoop.unref();

server.on("listening", () => {
  console.log(`WebSocket server: ws://127.0.0.1:${server.address().port}`);
});
