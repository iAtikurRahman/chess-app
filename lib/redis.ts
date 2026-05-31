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
  isBotGame: boolean;
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
  /** Time control in seconds per player */
  timeControl: number;
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
const USER_TTL = 7 * 24 * 60 * 60; // 7 days

export async function getRoom(roomId: string): Promise<RoomData | null> {
  return redis.get<RoomData>(`room:${roomId}`);
}

export async function saveRoom(room: RoomData): Promise<void> {
  await redis.set(`room:${room.roomId}`, room, { ex: ROOM_TTL });
}

export interface UserInfo {
  email: string;
  name: string;
}

/** Register/refresh a user in the global index (called on login). */
export async function registerUser(email: string, name: string): Promise<void> {
  await redis.set(`user:${email}`, { email, name } satisfies UserInfo, { ex: USER_TTL });
  // Upstash Redis sadd accepts a single member
  await redis.sadd("users:index", email);
}

/** Search users by email substring (case-insensitive). */
export async function searchUsers(query: string, excludeEmail?: string): Promise<UserInfo[]> {
  const allEmails = (await redis.smembers("users:index")) as string[];
  const q = query.toLowerCase().trim();
  const matched = allEmails
    .filter((e) => e !== excludeEmail && e.toLowerCase().includes(q))
    .slice(0, 8);
  if (matched.length === 0) return [];
  const users = await Promise.all(matched.map((e) => redis.get<UserInfo>(`user:${e}`)));
  return users.filter(Boolean) as UserInfo[];
}
