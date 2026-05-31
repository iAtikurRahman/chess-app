import type { Move } from "chess.js";

export type PlayerColor = "white" | "black";
export type ExtendedColor = PlayerColor | "spectator" | "both";

export interface PlayerData {
  name: string;
  connected: boolean;
}

export interface GameState {
  fen: string;
  sanHistory: string[];
  history: Move[];
  captured: { white: string[]; black: string[] };
  turn: PlayerColor;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  isGameOver: boolean;
  timers: { white: number; black: number };
  players: { white: PlayerData | null; black: PlayerData | null };
  isPractice: boolean;
  isBotGame?: boolean;
  timeControl?: number;
}

export interface Suggestion {
  from: string;
  to: string;
  promotion: string | null;
  uci: string;
}

export interface GameResult {
  winner: PlayerColor | null;
  reason: "checkmate" | "stalemate" | "draw" | "resign" | "timeout";
}

export interface Session {
  roomId: string;
  color: ExtendedColor;
  playerName?: string;
  isPractice?: boolean;
  practiceColor?: PlayerColor;
  isBotGame?: boolean;
  timeControl?: number;
  state?: GameState;
}

export interface MoveInput {
  from: string;
  to: string;
  promotion?: string;
}
