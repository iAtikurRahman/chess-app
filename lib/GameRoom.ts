import { Chess, type Move } from "chess.js";
import type { Server } from "socket.io";

interface Player {
  id: string;
  name: string;
  connected: boolean;
}

interface PlayerState {
  name: string;
  connected: boolean;
}

interface GameState {
  fen: string;
  sanHistory: string[];
  history: Move[];
  captured: { white: string[]; black: string[] };
  turn: "white" | "black";
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  isGameOver: boolean;
  timers: { white: number; black: number };
  players: { white: PlayerState | null; black: PlayerState | null };
  isPractice: boolean;
}

type MoveInput = string | { from: string; to: string; promotion?: string };

class GameRoom {
  roomId: string;
  isPractice: boolean;
  chess: Chess;
  players: { white: Player | null; black: Player | null };
  spectators: { id: string; name: string }[];
  gameStarted: boolean;
  gameOver: boolean;
  winner: "white" | "black" | null;
  pendingUndo: { requestedBy: "white" | "black" } | null;
  timers: { white: number; black: number };
  private _timerInterval: ReturnType<typeof setInterval> | null;
  private _lastTick: number | null;

  constructor(roomId: string, isPractice = false) {
    this.roomId = roomId;
    this.isPractice = isPractice;
    this.chess = new Chess();
    this.players = { white: null, black: null };
    this.spectators = [];
    this.gameStarted = false;
    this.gameOver = false;
    this.winner = null;
    this.pendingUndo = null;
    this.timers = { white: 600, black: 600 };
    this._timerInterval = null;
    this._lastTick = null;
  }

  // ── Player management ──────────────────────────────────────────────────────

  addPlayer(socketId: string, name: string, preferredColor: string): "white" | "black" | null {
    const colors: Array<"white" | "black"> = ["white", "black"];

    if (
      preferredColor &&
      preferredColor !== "random" &&
      !this.players[preferredColor as "white" | "black"]
    ) {
      const c = preferredColor as "white" | "black";
      this.players[c] = { id: socketId, name, connected: true };
      return c;
    }

    const shuffled =
      preferredColor === "random"
        ? [...colors].sort(() => Math.random() - 0.5)
        : colors;

    for (const c of shuffled) {
      if (!this.players[c]) {
        this.players[c] = { id: socketId, name, connected: true };
        return c;
      }
    }

    return null;
  }

  addSpectator(socketId: string, name: string): void {
    this.spectators.push({ id: socketId, name });
  }

  reconnectPlayer(newSocketId: string, color: "white" | "black"): void {
    const p = this.players[color];
    if (p) {
      p.id = newSocketId;
      p.connected = true;
    }
  }

  removeParticipant(socketId: string): "white" | "black" | null | undefined {
    for (const color of ["white", "black"] as const) {
      if (this.players[color]?.id === socketId) {
        this.players[color]!.connected = false;
        return color;
      }
    }
    const idx = this.spectators.findIndex((s) => s.id === socketId);
    if (idx !== -1) {
      this.spectators.splice(idx, 1);
      return null;
    }
    return undefined;
  }

  getPlayerColor(socketId: string): "white" | "black" | null {
    for (const color of ["white", "black"] as const) {
      if (this.players[color]?.id === socketId) return color;
    }
    return null;
  }

  bothPlayersJoined(): boolean {
    return !!(this.players.white && this.players.black);
  }

  isEmpty(): boolean {
    return (
      !this.players.white?.connected &&
      !this.players.black?.connected &&
      this.spectators.length === 0
    );
  }

  // ── Move handling ──────────────────────────────────────────────────────────

  makeMove(move: MoveInput): Move | null {
    try {
      return this.chess.move(move as Parameters<Chess["move"]>[0]);
    } catch {
      return null;
    }
  }

  undoLastMove(): void {
    this.chess.undo();
  }

  undoLastTwoMoves(): void {
    this.chess.undo();
    this.chess.undo();
  }

  // ── State snapshot ─────────────────────────────────────────────────────────

  getState(): GameState {
    const chess = this.chess;
    const history = chess.history({ verbose: true });

    const captured: { white: string[]; black: string[] } = { white: [], black: [] };
    for (const move of history) {
      if (move.captured) {
        captured[move.color === "w" ? "white" : "black"].push(move.captured);
      }
    }

    return {
      fen: chess.fen(),
      sanHistory: chess.history(),
      history,
      captured,
      turn: chess.turn() === "w" ? "white" : "black",
      isCheck: chess.inCheck(),
      isCheckmate: chess.isCheckmate(),
      isStalemate: chess.isStalemate(),
      isDraw: chess.isDraw(),
      isGameOver: chess.isGameOver(),
      timers: { ...this.timers },
      players: {
        white: this.players.white
          ? { name: this.players.white.name, connected: this.players.white.connected }
          : null,
        black: this.players.black
          ? { name: this.players.black.name, connected: this.players.black.connected }
          : null,
      },
      isPractice: this.isPractice,
    };
  }

  // ── Timers ─────────────────────────────────────────────────────────────────

  startTimers(io: Server): void {
    this.stopTimers();
    this._lastTick = Date.now();
    this._timerInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - this._lastTick!) / 1000);
      if (elapsed < 1) return;
      this._lastTick = now;

      const turn = this.chess.turn() === "w" ? "white" : "black";
      this.timers[turn] = Math.max(0, this.timers[turn] - elapsed);

      io.to(this.roomId).emit("timer-update", { timers: { ...this.timers } });

      if (this.timers[turn] === 0) {
        this.gameOver = true;
        this.winner = turn === "white" ? "black" : "white";
        this.stopTimers();
        io.to(this.roomId).emit("game-over", {
          winner: this.winner,
          reason: "timeout",
        });
      }
    }, 1000);
  }

  stopTimers(): void {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  reset(): void {
    this.chess.reset();
    this.gameOver = false;
    this.winner = null;
    this.pendingUndo = null;
    this.timers = { white: 600, black: 600 };
    this.stopTimers();
  }
}

export default GameRoom;
