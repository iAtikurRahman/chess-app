import type { NextApiRequest, NextApiResponse } from "next";
import { Chess } from "chess.js";
import { getRoom, saveRoom } from "../../../lib/redis";
import { pusherServer, channelName } from "../../../lib/pusher";
import { computeGameState, undoMoves } from "../../../lib/gameLogic";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { roomId, action, playerName } = req.body as {
    roomId?: string;
    action?: string;
    playerName?: string;
  };

  if (!roomId || !action) return res.status(400).json({ error: "Missing params" });

  const id = roomId.toUpperCase();
  const room = await getRoom(id);
  if (!room) return res.status(404).json({ error: "Room not found" });

  const ch = channelName(id);

  switch (action) {
    case "resign": {
      if (room.gameOver) return res.status(400).json({ error: "Game already over" });
      const playerColor = (["white", "black"] as const).find(
        (c) => room.players[c]?.name === playerName
      );
      if (!playerColor) return res.status(403).json({ error: "Not a player in this room" });
      const winner: "white" | "black" = playerColor === "white" ? "black" : "white";
      room.gameOver = true;
      room.winner = winner;
      await saveRoom(room);
      await pusherServer.trigger(ch, "game-over", { winner, reason: "resign" });
      break;
    }

    case "request-undo": {
      if (room.gameOver) return res.status(400).json({ error: "Game already over" });
      if (room.moves.length < 1) return res.status(400).json({ error: "No moves to undo" });

      if (room.isPractice) {
        const updated = undoMoves(room, 1);
        await saveRoom(updated);
        await pusherServer.trigger(ch, "undo-accepted", { state: computeGameState(updated) });
      } else {
        if (room.moves.length < 2) return res.status(400).json({ error: "Not enough moves to undo" });
        const playerColor = (["white", "black"] as const).find(
          (c) => room.players[c]?.name === playerName
        );
        if (!playerColor) return res.status(403).json({ error: "Not a player in this room" });
        room.pendingUndo = { requestedBy: playerColor };
        await saveRoom(room);
        await pusherServer.trigger(ch, "undo-requested", { requestedBy: playerColor });
      }
      break;
    }

    case "accept-undo": {
      if (!room.pendingUndo) return res.status(400).json({ error: "No pending undo request" });
      const updated = undoMoves(room, 2);
      await saveRoom(updated);
      await pusherServer.trigger(ch, "undo-accepted", { state: computeGameState(updated) });
      break;
    }

    case "reject-undo": {
      room.pendingUndo = null;
      await saveRoom(room);
      await pusherServer.trigger(ch, "undo-rejected", {});
      break;
    }

    case "restart": {
      const chess = new Chess();
      const wasPractice = room.isPractice;
      const playerOneName = room.players.white?.name ?? room.players.black?.name ?? "Player";
      const playerTwoName = room.players.black?.name ?? playerOneName;
      const tc = room.timeControl ?? 600;

      room.fen = chess.fen();
      room.sanHistory = [];
      room.moves = [];
      room.gameOver = false;
      room.winner = null;
      room.pendingUndo = null;
      room.timers = { white: tc, black: tc };
      room.lastMoveAt = Date.now();
      room.gameStarted = true;

      if (wasPractice) {
        room.players.white = { name: playerOneName };
        room.players.black = { name: playerOneName };
      } else {
        room.players.white = room.players.white ? { name: playerOneName } : null;
        room.players.black = room.players.black ? { name: playerTwoName } : null;
      }

      await saveRoom(room);
      await pusherServer.trigger(ch, "game-restarted", { state: computeGameState(room) });
      break;
    }

    default:
      return res.status(400).json({ error: "Unknown action" });
  }

  return res.status(200).json({ success: true });
}
