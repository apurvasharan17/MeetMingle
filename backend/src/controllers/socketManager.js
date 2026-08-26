import { Server } from "socket.io";

const MAX_ROOM_SIZE = Number(process.env.MAX_ROOM_SIZE || 8);
const MAX_HISTORY_PER_ROOM = 200;
const MAX_MESSAGE_LENGTH = 2000;

// roomId -> [socketId]
const connections = {};
// roomId -> [{ sender, data, socketIdSender, at }]
const messages = {};
// socketId -> roomId, so disconnect is O(1) instead of scanning every room
const socketRoom = {};

const roomIsFull = (roomId) => (connections[roomId]?.length || 0) >= MAX_ROOM_SIZE;

export const connectToSocket = (server, allowedOrigins = []) => {
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins.length ? allowedOrigins : false,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("join-call", (roomId) => {
      if (typeof roomId !== "string" || !roomId.trim()) return;
      if (socketRoom[socket.id]) return; // already in a room

      if (roomIsFull(roomId)) {
        socket.emit("room-full", { max: MAX_ROOM_SIZE });
        return;
      }

      connections[roomId] = connections[roomId] || [];
      connections[roomId].push(socket.id);
      socketRoom[socket.id] = roomId;
      socket.join(roomId);

      io.to(roomId).emit("user-joined", socket.id, connections[roomId]);

      // Replay history to the newcomer only
      (messages[roomId] || []).forEach((m) => {
        socket.emit("chat-message", m.data, m.sender, m.socketIdSender);
      });
    });

    socket.on("signal", (toId, message) => {
      // Only relay between sockets in the same room
      if (!toId || socketRoom[socket.id] !== socketRoom[toId]) return;
      io.to(toId).emit("signal", socket.id, message);
    });

    socket.on("chat-message", (data, sender) => {
      const roomId = socketRoom[socket.id];
      if (!roomId) return;
      if (typeof data !== "string" || !data.trim()) return;

      const entry = {
        sender: String(sender || "Anonymous").slice(0, 64),
        data: data.slice(0, MAX_MESSAGE_LENGTH),
        socketIdSender: socket.id,
        at: Date.now(),
      };

      messages[roomId] = messages[roomId] || [];
      messages[roomId].push(entry);
      // Bounded — the old code grew this array for the process lifetime
      if (messages[roomId].length > MAX_HISTORY_PER_ROOM) messages[roomId].shift();

      io.to(roomId).emit("chat-message", entry.data, entry.sender, socket.id);
    });

    socket.on("disconnect", () => {
      const roomId = socketRoom[socket.id];
      if (!roomId) return;

      delete socketRoom[socket.id];

      const members = connections[roomId] || [];
      const index = members.indexOf(socket.id);
      if (index !== -1) members.splice(index, 1);

      socket.to(roomId).emit("user-left", socket.id);

      if (members.length === 0) {
        delete connections[roomId];
        delete messages[roomId];
      }
    });
  });

  return io;
};