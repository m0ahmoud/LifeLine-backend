import { Server as SocketIOServer } from "socket.io";
import http from "http";

let io: SocketIOServer;

export const iniSocketServer = (server: http.Server) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*",
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected", socket.id);

    // When client connects, they emit their userId to join a private room
    socket.on("join", (userId: string) => {
      socket.join(userId);
      console.log(`User ${userId} joined room`);
    });

    socket.on("disconnect", () => {
      console.log("A user disconnected", socket.id);
    });
  });
};

export const getIo = (): SocketIOServer => {
  if (!io) {
    throw new Error("Socket.io is not initialized");
  }
  return io;
};
