import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";

const TICK_MS = 50;
const PLAYER_SPEED = 3;
const ENEMY_SPEED = 1.2;
const BULLET_SPEED = 7;
const MAP_LIMIT = 9.5;
const GAME_DURATION_MS = 60_000;

// ponytail: One in-memory room is enough here; add rooms/storage for deployment.
const players = new Map();
const enemies = new Map();
const bullets = new Map();
const coins = new Map();
let startedAt;
let nextEnemyAt;
let nextEntityId = 0;
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
  startedAt = Date.now();
  nextEnemyAt = startedAt;
  lastTick = startedAt;
}

function gameState() {
  const elapsedSeconds = Math.min(
    Math.floor((Date.now() - startedAt) / 1000),
    GAME_DURATION_MS / 1000,
  );

  return {
    type: "state",
    elapsedSeconds,
    players: [...players.values()].map(({ input, nextShotAt, ...player }) => player),
    enemies: [...enemies.values()].map(({ nextDamageAt, ...enemy }) => enemy),
    bullets: [...bullets.values()],
    coins: [...coins.values()],
  };
}

function broadcastState(targets = server.clients) {
  const data = JSON.stringify(gameState());

  for (const client of targets) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
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

function updatePlayers(delta) {
  for (const player of players.values()) {
    if (player.hp === 0) continue;
    const length = Math.hypot(player.input.x, player.input.z) || 1;
    player.x = Math.max(
      -MAP_LIMIT,
      Math.min(MAP_LIMIT, player.x + (player.input.x / length) * PLAYER_SPEED * delta),
    );
    player.z = Math.max(
      -MAP_LIMIT,
      Math.min(MAP_LIMIT, player.z + (player.input.z / length) * PLAYER_SPEED * delta),
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

    if (distance < 1) {
      if (now >= enemy.nextDamageAt) {
        target.hp = Math.max(0, target.hp - 10);
        enemy.nextDamageAt = now + 1000;
      }
    } else {
      enemy.x += (x / distance) * ENEMY_SPEED * delta;
      enemy.z += (z / distance) * ENEMY_SPEED * delta;
    }
  }
}

function shoot(now) {
  for (const player of players.values()) {
    if (player.hp === 0 || now < player.nextShotAt) continue;
    const target = findNearest(enemies.values(), player);
    if (!target) continue;

    const bullet = {
      id: `bullet-${++nextEntityId}`,
      targetId: target.id,
      x: player.x,
      z: player.z,
    };
    bullets.set(bullet.id, bullet);
    player.nextShotAt = now + 500;
  }
}

function updateBullets(delta) {
  for (const bullet of bullets.values()) {
    const target = enemies.get(bullet.targetId);

    if (!target) {
      bullets.delete(bullet.id);
      continue;
    }

    const x = target.x - bullet.x;
    const z = target.z - bullet.z;
    const distance = Math.hypot(x, z);
    const step = BULLET_SPEED * delta;

    if (distance <= step + 0.6) {
      target.hp -= 10;
      bullets.delete(bullet.id);

      if (target.hp <= 0) {
        coins.set(target.id, { id: target.id, x: target.x, z: target.z });
        enemies.delete(target.id);
      }
    } else {
      bullet.x += (x / distance) * step;
      bullet.z += (z / distance) * step;
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
  updatePlayers(delta);

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

  broadcastState();
}

server.on("connection", (socket) => {
  if (players.size === 0) resetGame();

  const player = {
    id: randomUUID(),
    x: players.size * 2,
    z: 0,
    hp: 100,
    coins: 0,
    input: { x: 0, z: 0 },
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

    if (
      message.type !== "input" ||
      !Number.isFinite(message.moveX) ||
      !Number.isFinite(message.moveZ)
    ) {
      return;
    }

    player.input.x = Math.max(-1, Math.min(1, message.moveX));
    player.input.z = Math.max(-1, Math.min(1, message.moveZ));
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
