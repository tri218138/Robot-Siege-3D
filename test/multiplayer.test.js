import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { WebSocket } from "ws";

process.env.PORT = "0";
const { enemySeparation, server } = await import("../server.js");
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

test("server owns movement and broadcasts one shared world", async () => {
  const url = `ws://127.0.0.1:${server.address().port}`;
  const playerA = new WebSocket(url);
  const playerB = new WebSocket(url);
  const initA = nextMessage(playerA, ({ type }) => type === "init");

  await Promise.all([once(playerA, "open"), once(playerB, "open")]);
  const { playerId } = await initA;

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

  const sharedStates = await Promise.all([
    nextMessage(playerA, ({ type, enemies }) => type === "state" && enemies.length > 0),
    nextMessage(playerB, ({ type, enemies }) => type === "state" && enemies.length > 0),
  ]);
  assert.deepEqual(sharedStates[0].enemies, sharedStates[1].enemies);

  playerA.close();
  playerB.close();
  await Promise.all([once(playerA, "close"), once(playerB, "close")]);
});

test.after(() => new Promise((resolve) => server.close(resolve)));
