import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";

const players = new Map();

export const server = new WebSocketServer({
  host: "127.0.0.1",
  port: Number(process.env.PORT ?? 8080),
});

function broadcast(message, except) {
  const data = JSON.stringify(message);

  for (const client of server.clients) {
    if (client !== except && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

server.on("connection", (socket) => {
  const playerId = randomUUID();
  const position = { x: 0, z: 0 };
  players.set(playerId, position);

  socket.send(
    JSON.stringify({ type: "init", playerId, players: [...players] }),
  );
  broadcast({ type: "join", playerId, ...position }, socket);

  socket.on("message", (rawMessage) => {
    let message;

    try {
      message = JSON.parse(rawMessage.toString());
    } catch {
      return;
    }

    if (
      message.type !== "move" ||
      !Number.isFinite(message.x) ||
      !Number.isFinite(message.z)
    ) {
      return;
    }

    // ponytail: Level 9 trusts valid client positions; Level 10 owns movement.
    players.set(playerId, { x: message.x, z: message.z });
    broadcast({ type: "move", playerId, x: message.x, z: message.z }, socket);
  });

  socket.on("close", () => {
    players.delete(playerId);
    broadcast({ type: "leave", playerId });
  });
});

server.on("listening", () => {
  console.log(`WebSocket server: ws://127.0.0.1:${server.address().port}`);
});
