import { Chess } from "chess.js";
import type { RoomData, StoredMove } from "./redis";
import type { GameState } from "../types";

/** Replay all stored moves from the starting position to rebuild the Chess instance. */
export function buildChess(moves: StoredMove[]): Chess {
  const chess = new Chess();
  for (const m of moves) {
    chess.move({ from: m.from, to: m.to, promotion: m.promotion });
  }
  return chess;
}

/**
 * Compute a client-ready GameState snapshot from a RoomData.
 * Timer values are adjusted to reflect time elapsed since the last move,
 * so the returned timers are "live" (accurate as of the moment this is called).
 */
export function computeGameState(room: RoomData): GameState {
  // Load from cached FEN for speed; fall back to full replay on error.
  const chess = new Chess();
  try {
    chess.load(room.fen);
  } catch {
    const rebuilt = buildChess(room.moves);
    chess.load(rebuilt.fen());
  }

  // Compute captured pieces from move history
  const captured: { white: string[]; black: string[] } = { white: [], black: [] };
  for (const m of room.moves) {
    if (m.captured) {
      captured[m.color === "w" ? "white" : "black"].push(m.captured);
    }
  }

  // Deduct elapsed time from the active player so returned timers are live
  const elapsed = (Date.now() - room.lastMoveAt) / 1000;
  const activeSide: "white" | "black" = chess.turn() === "w" ? "white" : "black";
  const liveTimers = { ...room.timers };
  if (!room.gameOver) {
    liveTimers[activeSide] = Math.max(0, liveTimers[activeSide] - elapsed);
  }

  return {
    fen: chess.fen(),
    sanHistory: room.sanHistory,
    history: room.moves as never,
    captured,
    turn: chess.turn() === "w" ? "white" : "black",
    isCheck: chess.inCheck(),
    isCheckmate: chess.isCheckmate(),
    isStalemate: chess.isStalemate(),
    isDraw: chess.isDraw(),
    isGameOver: chess.isGameOver(),
    timers: liveTimers,
    players: {
      white: room.players.white ? { name: room.players.white.name, connected: true } : null,
      black: room.players.black ? { name: room.players.black.name, connected: true } : null,
    },
    isPractice: room.isPractice,
    isBotGame: room.isBotGame,
    timeControl: room.timeControl,
  };
}

interface ApplyMoveResult {
  room: RoomData;
  moveResult: StoredMove | null;
}

/**
 * Apply a move to the room, update timers, and return the new room data.
 * Returns `moveResult: null` if the move is invalid.
 */
export function applyMove(
  room: RoomData,
  move: string | { from: string; to: string; promotion?: string }
): ApplyMoveResult {
  const chess = buildChess(room.moves);
  try {
    const result = chess.move(move as Parameters<Chess["move"]>[0]);
    if (!result) return { room, moveResult: null };

    // Deduct elapsed time from the player who just moved
    const elapsed = (Date.now() - room.lastMoveAt) / 1000;
    const activeSide: "white" | "black" = result.color === "w" ? "white" : "black";
    const newTimers = { ...room.timers };
    newTimers[activeSide] = Math.max(0, newTimers[activeSide] - elapsed);

    const storedMove: StoredMove = {
      from: result.from,
      to: result.to,
      san: result.san,
      flags: result.flags,
      color: result.color,
      piece: result.piece,
      ...(result.captured !== undefined ? { captured: result.captured } : {}),
      ...(result.promotion !== undefined ? { promotion: result.promotion } : {}),
    };

    const newRoom: RoomData = {
      ...room,
      fen: chess.fen(),
      sanHistory: chess.history(),
      moves: [...room.moves, storedMove],
      timers: newTimers,
      lastMoveAt: Date.now(),
    };

    return { room: newRoom, moveResult: storedMove };
  } catch {
    return { room, moveResult: null };
  }
}

/** Remove the last `count` moves and rebuild board state. Timers are not restored. */
export function undoMoves(room: RoomData, count: number): RoomData {
  const newMoves = room.moves.slice(0, -count);
  const chess = buildChess(newMoves);
  return {
    ...room,
    fen: chess.fen(),
    sanHistory: chess.history(),
    moves: newMoves,
    pendingUndo: null,
  };
}
