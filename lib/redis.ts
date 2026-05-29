import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface StoredMove {
  from: string;
  to: string;
  san: string;
  flags: string;
  color: string; // "w" or "b"
  piece?: string;
  captured?: string;
  promotion?: string;
}

export interface RoomData {
  roomId: string;
  isPractice: boolean;
  /** Current board FEN – cached from replaying moves */
  fen: string;
  /** SAN history – cached */
  sanHistory: string[];
  /** Authoritative move list – replay to rebuild board or undo */
  moves: StoredMove[];
  gameStarted: boolean;
  gameOver: boolean;
  winner: "white" | "black" | null;
  pendingUndo: { requestedBy: "white" | "black" } | null;
  /** Remaining seconds per player (accurate as of lastMoveAt) */
  timers: { white: number; black: number };
  /** Timestamp (ms) when the last move was made / game started */
  lastMoveAt: number;
  players: {
    white: { name: string } | null;
    black: { name: string } | null;
  };
}

const ROOM_TTL = 4 * 60 * 60; // 4 hours

export async function getRoom(roomId: string): Promise<RoomData | null> {
  return redis.get<RoomData>(`room:${roomId}`);
}

export async function saveRoom(room: RoomData): Promise<void> {
  await redis.set(`room:${room.roomId}`, room, { ex: ROOM_TTL });
}
