import { io, type Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || process.env.EVOLUTION_API_URL;

let socket: Socket | null = null;
let currentKey: string | null = null;

export const getEvoSocket = (apiKey: string | null) => {
  if (!API_URL || !apiKey) return null;
  if (socket && currentKey === apiKey) return socket;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  currentKey = apiKey;
  socket = io(API_URL.replace(/\/$/, ""), {
    query: { apikey: apiKey },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });
  return socket;
};

export const resetEvoSocket = () => {
  if (socket) {
    socket.disconnect();
  }
  socket = null;
  currentKey = null;
};
