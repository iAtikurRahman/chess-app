import { io, type Socket } from "socket.io-client";

const SERVER_URL =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_SERVER_URL || window.location.origin
    : "";

export const socket: Socket | null =
  typeof window !== "undefined"
    ? io(SERVER_URL, {
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1500,
        path: "/socket.io",
      })
    : null;
