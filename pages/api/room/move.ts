import type { NextApiRequest, NextApiResponse } from "next";
import { Chess } from "chess.js";
import { getRoom, saveRoom } from "../../../lib/redis";
import { pusherServer, channelName } from "../../../lib/pusher";
import { computeGameState, applyMove } from "../../../lib/gameLogic";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { roomId, move, playerName } = req.body as {
    roomId?: string;
    move?: unknown;
    playerName?: string;
  };

  if (!roomId) return res.status(400).json({ error: "Room ID required" });

  const id = roomId.toUpperCase();
  const room = await getRoom(id);
  if (!room) return res.status(404).json({ error: "Room not found" });
  if (room.gameOver) return res.status(400).json({ error: "Game is over" });
  if (!room.gameStarted) return res.status(400).json({ error: "Game not started yet" });

  // For multiplayer: validate it is the requesting player's turn
  if (!room.isPractice) {
    const chess = new Chess();
    chess.load(room.fen);
    const currentTurn: "white" | "black" = chess.turn() === "w" ? "white" : "black";
    const playerColor = (["white", "black"] as const).find(
      (c) => room.players[c]?.name === playerName
    );
    if (!playerColor || playerColor !== currentTurn) {
      return res.status(400).json({ error: "Not your turn" });
    }
  }

  const { room: newRoom, moveResult } = applyMove(
    room,
    move as string | { from: string; to: string; promotion?: string }
  );
  if (!moveResult) {
    return res.status(400).json({ error: "Invalid move" });
  }

  const ch = channelName(id);
  const activeSide: "white" | "black" = moveResult.color === "w" ? "white" : "black";

  // Timeout: the player who moved ran out of time before making this move
  if (newRoom.timers[activeSide] <= 0) {
    const winner: "white" | "black" = activeSide === "white" ? "black" : "white";
    newRoom.gameOver = true;
    newRoom.winner = winner;
    await saveRoom(newRoom);
    const state = computeGameState(newRoom);
    await pusherServer.trigger(ch, "move-made", { move: moveResult, state });
    await pusherServer.trigger(ch, "game-over", { winner, reason: "timeout" });
    return res.status(200).json({ success: true });
  }

  // Check game-over conditions from the new position
  const chessAfter = new Chess();
  chessAfter.load(newRoom.fen);
  let gameOverData: { winner: "white" | "black" | null; reason: string } | null = null;

  if (chessAfter.isCheckmate()) {
    newRoom.gameOver = true;
    newRoom.winner = activeSide;
    gameOverData = { winner: activeSide, reason: "checkmate" };
  } else if (chessAfter.isStalemate()) {
    newRoom.gameOver = true;
    newRoom.winner = null;
    gameOverData = { winner: null, reason: "stalemate" };
  } else if (chessAfter.isDraw()) {
    newRoom.gameOver = true;
    newRoom.winner = null;
    gameOverData = { winner: null, reason: "draw" };
  }

  await saveRoom(newRoom);
  const state = computeGameState(newRoom);
  await pusherServer.trigger(ch, "move-made", { move: moveResult, state });
  if (gameOverData) {
    await pusherServer.trigger(ch, "game-over", gameOverData);
  }

  return res.status(200).json({ success: true });
}
