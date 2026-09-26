import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { WebSocket } from "ws";

process.env.PORT = "0";
const { server } = await import("../server.js");
await once(server, "listening");

function nextMessage(socket, type) {
  return new Promise((resolve) => {
    socket.on("message", function listener(rawMessage) {
      const message = JSON.parse(rawMessage.toString());

      if (message.type === type) {
        socket.off("message", listener);
        resolve(message);
      }
    });
  });
}

test("broadcasts one player's movement to the other player", async () => {
  const url = `ws://127.0.0.1:${server.address().port}`;
  const playerA = new WebSocket(url);
  const playerB = new WebSocket(url);
  const initA = nextMessage(playerA, "init");
  const initB = nextMessage(playerB, "init");

  await Promise.all([once(playerA, "open"), once(playerB, "open")]);
  const [{ playerId }] = await Promise.all([initA, initB]);
  const movement = nextMessage(playerB, "move");
  playerA.send(JSON.stringify({ type: "move", x: 5.2, z: 8.7 }));

  assert.deepEqual(await movement, {
    type: "move",
    playerId,
    x: 5.2,
    z: 8.7,
  });

  playerA.close();
  playerB.close();
  await Promise.all([once(playerA, "close"), once(playerB, "close")]);
});

test.after(() => new Promise((resolve) => server.close(resolve)));
