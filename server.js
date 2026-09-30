import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import {
  advanceBossState,
  BOSS,
  initializeBossState,
  WAVES,
  waveAtElapsed,
} from "./src/game-rules.js";
import { buildSpatialGrid, querySpatialGrid } from "./src/performance.js";

const TICK_MS = 50;
const SNAPSHOT_MS = 100;
const MAX_BUFFERED_BYTES = 64 * 1024;
const MAX_INPUT_QUEUE = 4;
const PLAYER_SPEED = 3;
const ENEMY_SPEED = 1.2;
const ENEMY_SEPARATION_RADIUS = 1.25;
const ENEMY_SEPARATION_WEIGHT = 1.5;
const MAP_LIMIT = 9.5;
const CRITICAL_CHANCE = 0.15;
const CRITICAL_MULTIPLIER = 2;
const MAX_COMBAT_EVENTS = 64;

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
let currentWaveIndex;
let gameStatus;
let finishedAt;
let nextEntityId = 0;
let nextCombatEventId = 0;
let snapshotSequence = 0;
let lastTick = Date.now();
const combatEvents = [];

export const server = new WebSocketServer({
  host: "127.0.0.1",
  port: Number(process.env.PORT ?? 8080),
});

function resetGame() {
  enemies.clear();
  bullets.clear();
  coins.clear();
  nextEntityId = 0;
  nextCombatEventId = 0;
  snapshotSequence = 0;
  combatEvents.length = 0;
  startedAt = Date.now();
  currentWaveIndex = -1;
  gameStatus = "active";
  finishedAt = undefined;
  nextEnemyAt = Infinity;
  nextSnapshotAt = startedAt;
  lastTick = startedAt;
  enterWave(0, startedAt);
}

function publicWaveState(now) {
  const timelineNow = gameStatus === "active" ? now : (finishedAt ?? now);
  const { index, wave, elapsedInWave, remainingMs } = waveAtElapsed(
    timelineNow - startedAt,
  );
  const duration = wave.durationMs;

  return {
    id: wave.id,
    index: index + 1,
    total: WAVES.length,
    label: wave.label,
    kind: wave.kind,
    elapsedSeconds: Math.floor(elapsedInWave / 1000),
    remainingSeconds:
      remainingMs === null ? null : Math.ceil(remainingMs / 1000),
    progress: duration === null ? 1 : 1 - remainingMs / duration,
  };
}

function gameState(now = Date.now()) {
  const timelineNow = gameStatus === "active" ? now : (finishedAt ?? now);
  const elapsedSeconds = Math.floor((timelineNow - startedAt) / 1000);

  return {
    type: "state",
    sequence: ++snapshotSequence,
    elapsedSeconds,
    status: gameStatus,
    wave: publicWaveState(now),
    combatEvents,
    players: [...players.values()].map(
      ({ inputQueue, lastReceivedInput, nextShotAt, ...player }) => player,
    ),
    enemies: [...enemies.values()].map(
      ({
        nextDamageAt,
        stateUntil,
        attackAt,
        attackApplied,
        collisionRadius,
        speed,
        ...enemy
      }) => enemy,
    ),
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

export function rollDamage(baseDamage, roll = Math.random()) {
  const critical = roll < CRITICAL_CHANCE;
  return {
    amount: baseDamage * (critical ? CRITICAL_MULTIPLIER : 1),
    critical,
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
    if (item.hp <= 0) continue;
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
    kind: "normal",
    x: side < 2 ? (side === 0 ? -MAP_LIMIT : MAP_LIMIT) : offset,
    z: side >= 2 ? (side === 2 ? -MAP_LIMIT : MAP_LIMIT) : offset,
    hp: 30,
    maxHp: 30,
    speed: ENEMY_SPEED,
    collisionRadius: 0.6,
    nextDamageAt: 0,
  };
  enemies.set(enemy.id, enemy);
}

function spawnBoss(now) {
  const boss = initializeBossState(
    {
      id: `boss-${++nextEntityId}`,
      kind: "boss",
      x: 0,
      z: -MAP_LIMIT,
      hp: BOSS.hp,
      maxHp: BOSS.hp,
      speed: BOSS.speed,
      collisionRadius: BOSS.collisionRadius,
      nextDamageAt: 0,
    },
    now,
  );
  enemies.set(boss.id, boss);
}

function enterWave(index, now) {
  currentWaveIndex = index;
  const wave = WAVES[index];

  if (wave.kind === "boss") {
    if (![...enemies.values()].some(({ kind }) => kind === "boss")) {
      spawnBoss(now);
    }
    nextEnemyAt = Infinity;
    return;
  }

  for (let count = 0; count < wave.openingCount; count += 1) spawnEnemy();
  nextEnemyAt = now + wave.spawnIntervalMs;
}

function updateWave(now) {
  const { index } = waveAtElapsed(now - startedAt);
  if (index !== currentWaveIndex) enterWave(index, now);

  const wave = WAVES[currentWaveIndex];
  if (wave.kind === "normal" && now >= nextEnemyAt) {
    spawnEnemy();
    nextEnemyAt = now + wave.spawnIntervalMs;
  }
}

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

function applyBossAttack(boss, now) {
  if (
    boss.attackApplied ||
    now < boss.attackAt ||
    (boss.bossState !== "attack1" && boss.bossState !== "attack2")
  ) {
    return;
  }

  const attack =
    boss.bossState === "attack1"
      ? { radius: BOSS.attack1Radius, damage: BOSS.attack1Damage }
      : { radius: BOSS.attack2Radius, damage: BOSS.attack2Damage };
  const damage = Math.round(
    attack.damage * (boss.enraged ? BOSS.enragedDamageMultiplier : 1),
  );

  for (const player of players.values()) {
    if (player.hp <= 0) continue;
    const distance = Math.hypot(player.x - boss.x, player.z - boss.z);
    if (distance <= attack.radius) player.hp = Math.max(0, player.hp - damage);
  }
  boss.attackApplied = true;
}

function updateBoss(boss, target, delta, now) {
  const x = target.x - boss.x;
  const z = target.z - boss.z;
  const distance = Math.hypot(x, z);
  advanceBossState(boss, now, distance);
  applyBossAttack(boss, now);

  if (boss.bossState !== "chase" || distance === 0) return undefined;
  boss.speed = boss.enraged ? BOSS.enragedSpeed : BOSS.speed;
  return {
    enemy: boss,
    x: (x / distance) * boss.speed * delta,
    z: (z / distance) * boss.speed * delta,
  };
}

function updateEnemies(delta, now) {
  const spatialGrid = buildSpatialGrid(
    enemies.values(),
    ENEMY_SEPARATION_RADIUS,
  );
  const movements = [];

  for (const enemy of enemies.values()) {
    const target = findNearest(players.values(), enemy);
    if (!target) continue;

    if (enemy.kind === "boss") {
      const movement = updateBoss(enemy, target, delta, now);
      if (movement) movements.push(movement);
      continue;
    }

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

    const separation = enemySeparation(
      enemy,
      querySpatialGrid(spatialGrid, enemy, ENEMY_SEPARATION_RADIUS),
    );
    moveX += separation.x * ENEMY_SEPARATION_WEIGHT;
    moveZ += separation.z * ENEMY_SEPARATION_WEIGHT;
    const moveLength = Math.hypot(moveX, moveZ);

    if (moveLength > 0) {
      movements.push({
        enemy,
        x: (moveX / moveLength) * enemy.speed * delta,
        z: (moveZ / moveLength) * enemy.speed * delta,
      });
    }
  }

  for (const movement of movements) {
    movement.enemy.x = Math.max(
      -MAP_LIMIT,
      Math.min(MAP_LIMIT, movement.enemy.x + movement.x),
    );
    movement.enemy.z = Math.max(
      -MAP_LIMIT,
      Math.min(MAP_LIMIT, movement.enemy.z + movement.z),
    );
  }

  return buildSpatialGrid(enemies.values(), ENEMY_SEPARATION_RADIUS);
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
        ownerId: player.id,
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

function findBulletHit(items, bullet) {
  let hit;
  let nearestDistance = Infinity;

  for (const enemy of items) {
    if (enemy.hp <= 0) continue;
    const distance =
      (enemy.x - bullet.x) ** 2 + (enemy.z - bullet.z) ** 2;
    if (
      distance <= enemy.collisionRadius ** 2 &&
      distance < nearestDistance
    ) {
      hit = enemy;
      nearestDistance = distance;
    }
  }
  return hit;
}

function updateBullets(delta, enemyGrid, now) {
  for (const bullet of bullets.values()) {
    const step = Math.min(bullet.projectileSpeed * delta, bullet.remainingRange);
    bullet.x += bullet.directionX * step;
    bullet.z += bullet.directionZ * step;
    bullet.remainingRange -= step;

    const target = findBulletHit(
      querySpatialGrid(enemyGrid, bullet, BOSS.collisionRadius),
      bullet,
    );
    if (target) {
      const { amount, critical } = rollDamage(bullet.damage);
      target.hp -= amount;
      bullets.delete(bullet.id);

      const killed = target.hp <= 0;
      combatEvents.push({
        id: ++nextCombatEventId,
        type: "damage",
        ownerId: bullet.ownerId,
        amount,
        critical,
        killed,
        x: target.x,
        z: target.z,
      });
      if (combatEvents.length > MAX_COMBAT_EVENTS) combatEvents.shift();

      if (killed) {
        enemies.delete(target.id);
        if (target.kind === "boss") {
          const owner = players.get(bullet.ownerId);
          if (owner) owner.coins += 25;
          gameStatus = "victory";
          finishedAt = now;
        } else {
          coins.set(target.id, { id: target.id, x: target.x, z: target.z });
        }
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

  updatePlayers();

  if (gameStatus === "active") {
    if (![...players.values()].some(({ hp }) => hp > 0)) {
      gameStatus = "defeat";
      finishedAt = now;
    } else {
      updateWave(now);
    }
  }

  if (gameStatus === "active") {
    const enemyGrid = updateEnemies(delta, now);
    shoot(now);
    updateBullets(delta, enemyGrid, now);
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
    if (message.type === "ping") {
      if (
        Number.isFinite(message.sentAt) &&
        socket.readyState === WebSocket.OPEN
      ) {
        socket.send(JSON.stringify({ type: "pong", sentAt: message.sentAt }));
      }
      return;
    }
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
