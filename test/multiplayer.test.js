import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { WebSocket } from "ws";

process.env.PORT = "0";
const { enemySeparation, rollDamage, server, WEAPONS, weaponDirections } =
  await import("../server.js");
await once(server, "listening");

function nextMessage(socket, predicate) {
  return new Promise((resolve) => {
    socket.on("message", function listener(rawMessage) {
      const message = JSON.parse(rawMessage.toString());

      if (predicate(message)) {
        socket.off("message", listener);
        resolve(message);
      }
    });
  });
}

test("enemy separation handles overlap and ignores distant enemies", () => {
  const enemyA = { id: "enemy-1", x: 0, z: 0 };
  const enemyB = { id: "enemy-2", x: 0, z: 0 };
  const distantEnemy = { id: "enemy-3", x: 5, z: 5 };

  assert.deepEqual(enemySeparation(enemyA, [enemyA, enemyB, distantEnemy]), {
    x: -1,
    z: 0,
  });
  assert.deepEqual(enemySeparation(enemyB, [enemyA, enemyB, distantEnemy]), {
    x: 1,
    z: 0,
  });
  assert.deepEqual(enemySeparation(distantEnemy, [enemyA, enemyB, distantEnemy]), {
    x: 0,
    z: 0,
  });
  assert.deepEqual(
    enemySeparation(enemyA, [enemyA, { id: "enemy-4", x: 0.5, z: 0 }]),
    { x: -0.6, z: 0 },
  );
});

test("weapon configuration creates the five-pellet shotgun spread", () => {
  const directions = weaponDirections(
    "shotgun",
    { x: 0, z: 0 },
    { x: 1, z: 0 },
  );

  assert.deepEqual(
    [
      WEAPONS.pistol.damage,
      WEAPONS.pistol.fireRate,
      WEAPONS.pistol.range,
      WEAPONS.shotgun.damage,
      WEAPONS.shotgun.projectiles,
      WEAPONS.shotgun.spread,
      WEAPONS.machineGun.damage,
      WEAPONS.machineGun.fireRate,
      WEAPONS.machineGun.range,
    ],
    [10, 2, 10, 6, 5, 25, 4, 10, 12],
  );
  assert.equal(directions.length, 5);
  assert.ok(
    Math.abs(
      Math.atan2(directions[0].z, directions[0].x) +
        (12.5 * Math.PI) / 180,
    ) < 1e-12,
  );
  assert.deepEqual(directions[2], { x: 1, z: 0 });
  assert.ok(
    Math.abs(
      Math.atan2(directions[4].z, directions[4].x) -
        (12.5 * Math.PI) / 180,
    ) < 1e-12,
  );
});

test("damage rolls preserve normal damage and double critical damage", () => {
  assert.deepEqual(rollDamage(10, 0.15), { amount: 10, critical: false });
  assert.deepEqual(rollDamage(10, 0.149), { amount: 20, critical: true });
});

test("server owns movement and broadcasts one shared world", async () => {
  const url = `ws://127.0.0.1:${server.address().port}`;
  const playerA = new WebSocket(url);
  const playerB = new WebSocket(url);
  const initA = nextMessage(playerA, ({ type }) => type === "init");

  await Promise.all([once(playerA, "open"), once(playerB, "open")]);
  const { playerId } = await initA;

  const pong = nextMessage(playerA, ({ type }) => type === "pong");
  playerA.send(JSON.stringify({ type: "ping", sentAt: 12345 }));
  assert.deepEqual(await pong, { type: "pong", sentAt: 12345 });

  const stateAfterSpoof = nextMessage(
    playerB,
    ({ type, players }) => type === "state" && players.some(({ id }) => id === playerId),
  );
  playerA.send(JSON.stringify({ type: "move", x: 200, z: 100, hp: 999999 }));
  const spoofedPlayer = (await stateAfterSpoof).players.find(({ id }) => id === playerId);
  assert.equal(spoofedPlayer.x, 0);
  assert.equal(spoofedPlayer.hp, 100);

  const movedState = nextMessage(
    playerB,
    ({ type, players }) =>
      type === "state" && players.find(({ id }) => id === playerId)?.x > 0,
  );
  playerA.send(
    JSON.stringify({ type: "input", sequence: 1, moveX: 1, moveZ: 0 }),
  );
  const movedPlayer = (await movedState).players.find(({ id }) => id === playerId);
  assert.ok(movedPlayer.x < 1);
  assert.equal(movedPlayer.lastProcessedInput, 1);

  const shotgunState = nextMessage(
    playerB,
    ({ type, players }) =>
      type === "state" &&
      players.find(({ id }) => id === playerId)?.weapon === "shotgun",
  );
  playerA.send(JSON.stringify({ type: "weapon", weapon: "shotgun" }));
  const selectedWeaponState = await shotgunState;
  assert.equal(
    selectedWeaponState.players.find(({ id }) => id === playerId).weapon,
    "shotgun",
  );

  const stateAfterInvalidWeapon = nextMessage(
    playerB,
    ({ type, sequence }) =>
      type === "state" && sequence > selectedWeaponState.sequence,
  );
  playerA.send(JSON.stringify({ type: "weapon", weapon: "laser" }));
  assert.equal(
    (await stateAfterInvalidWeapon).players.find(({ id }) => id === playerId).weapon,
    "shotgun",
  );

  const firingState = await nextMessage(
    playerB,
    ({ type, bullets }) =>
      type === "state" && bullets.some(({ ownerId }) => ownerId === playerId),
  );
  assert.ok(
    firingState.bullets.some(({ ownerId }) => ownerId === playerId),
  );

  const sharedStates = await Promise.all([
    nextMessage(playerA, ({ type, enemies }) => type === "state" && enemies.length > 0),
    nextMessage(playerB, ({ type, enemies }) => type === "state" && enemies.length > 0),
  ]);
  assert.deepEqual(sharedStates[0].enemies, sharedStates[1].enemies);
  assert.equal(sharedStates[0].status, "active");
  assert.equal(sharedStates[0].wave.id, "wave-1");
  assert.equal(sharedStates[0].wave.index, 1);
  assert.equal(sharedStates[0].wave.total, 4);
  assert.ok(
    sharedStates[0].enemies.every(
      ({ kind, hp, maxHp }) => kind === "normal" && hp <= maxHp,
    ),
  );

  playerA.close();
  playerB.close();
  await Promise.all([once(playerA, "close"), once(playerB, "close")]);
});

test.after(() => new Promise((resolve) => server.close(resolve)));
