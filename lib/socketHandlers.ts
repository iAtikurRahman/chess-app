import { v4 as uuidv4 } from "uuid";
import type { Server, Socket } from "socket.io";
import GameRoom from "./GameRoom";
import { getStockfishService } from "./StockfishService";

// In-memory room store — Map<roomId, GameRoom>
const rooms = new Map<string, GameRoom>();

async function emitSuggestion(io: Server, roomId: string, fen: string): Promise<void> {
  const room = rooms.get(roomId);
  if (!room || room.isPractice) return;
  try {
    const stockfish = getStockfishService();
    const bestMove = await stockfish.getBestMove(fen, 14);
    if (!bestMove) return;
    io.to(roomId).emit("suggestion", {
      from: bestMove.slice(0, 2),
      to: bestMove.slice(2, 4),
      promotion: bestMove[4] || null,
      uci: bestMove,
    });
  } catch (err) {
    console.error("[emitSuggestion]", (err as Error).message);
  }
}

export function setupSocketHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {
    console.log(`[socket] connect ${socket.id}`);

    // ── Create room ──────────────────────────────────────────────────────────
    socket.on(
      "create-room",
      ({ playerName, color }: { playerName?: string; color?: string } = {}) => {
        if (!playerName?.trim()) {
          socket.emit("error", { message: "Player name is required." });
          return;
        }

        const roomId = uuidv4().slice(0, 8).toUpperCase();
        const room = new GameRoom(roomId);
        rooms.set(roomId, room);

        const assignedColor = room.addPlayer(socket.id, playerName.trim(), color || "white");
        void socket.join(roomId);

        socket.emit("room-created", {
          roomId,
          color: assignedColor,
          state: room.getState(),
        });
      }
    );

    // ── Create PRACTICE room ─────────────────────────────────────────────────
    socket.on(
      "create-practice-room",
      ({ playerName }: { playerName?: string } = {}) => {
        if (!playerName?.trim()) {
          socket.emit("error", { message: "Player name is required." });
          return;
        }

        const roomId = uuidv4().slice(0, 8).toUpperCase();
        const room = new GameRoom(roomId, true);
        rooms.set(roomId, room);

        room.players.white = { id: socket.id, name: playerName.trim(), connected: true };
        room.players.black = { id: socket.id, name: playerName.trim(), connected: true };
        room.gameStarted = true;

        void socket.join(roomId);

        socket.emit("room-created", {
          roomId,
          color: "both",
          isPractice: true,
          state: room.getState(),
        });
      }
    );

    // ── Join room ────────────────────────────────────────────────────────────
    socket.on(
      "join-room",
      ({
        roomId,
        playerName,
        color,
      }: { roomId?: string; playerName?: string; color?: string } = {}) => {
        const room = rooms.get(roomId?.toUpperCase() ?? "");

        if (!room) {
          socket.emit("error", { message: "Room not found. Check the room ID." });
          return;
        }

        const existingEntry = Object.entries(room.players).find(
          ([, p]) => p && p.name === playerName?.trim()
        );

        if (existingEntry) {
          const [existingColor] = existingEntry as ["white" | "black", unknown];
          room.reconnectPlayer(socket.id, existingColor);
          void socket.join(roomId!.toUpperCase());
          socket.emit("room-joined", {
            roomId: roomId!.toUpperCase(),
            color: existingColor,
            isRejoin: true,
            state: room.getState(),
          });
          socket.to(roomId!.toUpperCase()).emit("player-reconnected", { color: existingColor });
          if (room.gameStarted && !room.gameOver && room.bothPlayersJoined()) {
            room.startTimers(io);
          }
          return;
        }

        const assignedColor = room.addPlayer(
          socket.id,
          playerName?.trim() || "Guest",
          color || "black"
        );

        if (!assignedColor) {
          room.addSpectator(socket.id, playerName?.trim() || "Spectator");
          void socket.join(roomId!.toUpperCase());
          socket.emit("room-joined", {
            roomId: roomId!.toUpperCase(),
            color: "spectator",
            isRejoin: false,
            state: room.getState(),
          });
          return;
        }

        void socket.join(roomId!.toUpperCase());
        socket.emit("room-joined", {
          roomId: roomId!.toUpperCase(),
          color: assignedColor,
          isRejoin: false,
          state: room.getState(),
        });

        socket.to(roomId!.toUpperCase()).emit("opponent-joined", {
          playerName: playerName?.trim(),
          color: assignedColor,
          state: room.getState(),
        });

        if (room.bothPlayersJoined() && !room.gameStarted) {
          room.gameStarted = true;
          io.to(roomId!.toUpperCase()).emit("game-started", { state: room.getState() });
          room.startTimers(io);
          void emitSuggestion(io, roomId!.toUpperCase(), room.chess.fen());
        }
      }
    );

    // ── Make move ────────────────────────────────────────────────────────────
    socket.on(
      "make-move",
      ({ roomId, move }: { roomId?: string; move?: unknown } = {}) => {
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room || room.gameOver) return;

        const currentTurn = room.chess.turn() === "w" ? "white" : "black";

        if (!room.isPractice) {
          const playerColor = room.getPlayerColor(socket.id);
          if (!playerColor) return;
          if (playerColor !== currentTurn) {
            socket.emit("error", { message: "It is not your turn." });
            return;
          }
        }

        const playerColor = currentTurn;

        const result = room.makeMove(
          move as string | { from: string; to: string; promotion?: string }
        );
        if (!result) {
          socket.emit("invalid-move", { move });
          return;
        }

        const state = room.getState();
        io.to(roomId).emit("move-made", { move: result, state });

        if (state.isCheckmate) {
          room.gameOver = true;
          room.winner = playerColor;
          room.stopTimers();
          io.to(roomId).emit("game-over", { winner: playerColor, reason: "checkmate" });
          return;
        }

        if (state.isStalemate || state.isDraw) {
          room.gameOver = true;
          room.stopTimers();
          io.to(roomId).emit("game-over", {
            winner: null,
            reason: state.isStalemate ? "stalemate" : "draw",
          });
          return;
        }

        void emitSuggestion(io, roomId, state.fen);
      }
    );

    // ── Request suggestion ───────────────────────────────────────────────────
    socket.on("request-suggestion", ({ roomId }: { roomId?: string } = {}) => {
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      void emitSuggestion(io, roomId, room.chess.fen());
    });

    // ── Resign ───────────────────────────────────────────────────────────────
    socket.on("resign", ({ roomId }: { roomId?: string } = {}) => {
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.gameOver) return;

      const playerColor = room.getPlayerColor(socket.id);
      if (!playerColor) return;

      const winner = playerColor === "white" ? "black" : "white";
      room.gameOver = true;
      room.winner = winner;
      room.stopTimers();
      io.to(roomId).emit("game-over", { winner, reason: "resign" });
    });

    // ── Request undo ─────────────────────────────────────────────────────────
    socket.on("request-undo", ({ roomId }: { roomId?: string } = {}) => {
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.gameOver) return;

      if (room.chess.history().length < 1) {
        socket.emit("error", { message: "No moves to undo." });
        return;
      }

      if (room.isPractice) {
        room.undoLastMove();
        const state = room.getState();
        io.to(roomId).emit("undo-accepted", { state });
        return;
      }

      const playerColor = room.getPlayerColor(socket.id);
      if (!playerColor) return;

      if (room.chess.history().length < 2) {
        socket.emit("error", { message: "Not enough moves to undo." });
        return;
      }

      room.pendingUndo = { requestedBy: playerColor };
      socket.to(roomId).emit("undo-requested", { requestedBy: playerColor });
    });

    // ── Accept undo ──────────────────────────────────────────────────────────
    socket.on("accept-undo", ({ roomId }: { roomId?: string } = {}) => {
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || !room.pendingUndo) return;

      room.undoLastTwoMoves();
      room.pendingUndo = null;

      const state = room.getState();
      io.to(roomId).emit("undo-accepted", { state });
      void emitSuggestion(io, roomId, state.fen);
    });

    // ── Reject undo ──────────────────────────────────────────────────────────
    socket.on("reject-undo", ({ roomId }: { roomId?: string } = {}) => {
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      room.pendingUndo = null;
      socket.to(roomId).emit("undo-rejected");
    });

    // ── Restart game ─────────────────────────────────────────────────────────
    socket.on("restart-game", ({ roomId }: { roomId?: string } = {}) => {
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      if (!room.isPractice) {
        const playerColor = room.getPlayerColor(socket.id);
        if (!playerColor) return;
      }

      const wasPractice = room.isPractice;
      room.reset();
      room.isPractice = wasPractice;
      room.gameStarted = true;

      if (wasPractice) {
        const name = room.players.white?.name || "Player";
        room.players.white = { id: socket.id, name, connected: true };
        room.players.black = { id: socket.id, name, connected: true };
      }

      io.to(roomId).emit("game-restarted", { state: room.getState() });
      if (!wasPractice) room.startTimers(io);
      void emitSuggestion(io, roomId, room.chess.fen());
    });

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`[socket] disconnect ${socket.id}`);

      for (const [roomId, room] of Array.from(rooms.entries())) {
        const color = room.removeParticipant(socket.id);
        if (color !== undefined) {
          if (color) {
            socket.to(roomId).emit("player-disconnected", { color });
            if (!room.gameOver) room.stopTimers();
          }
          if (room.isEmpty()) rooms.delete(roomId);
          break;
        }
      }
    });
  });
}
