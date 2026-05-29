import type { NextApiRequest, NextApiResponse } from "next";
import { Chess } from "chess.js";
import { v4 as uuidv4 } from "uuid";
import { saveRoom, type RoomData } from "../../../lib/redis";
import { computeGameState } from "../../../lib/gameLogic";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { playerName, color, isPractice } = req.body as {
    playerName?: string;
    color?: string;
    isPractice?: boolean;
  };

  if (!playerName?.trim()) {
    return res.status(400).json({ error: "Player name required" });
  }

  const roomId = uuidv4().slice(0, 8).toUpperCase();
  const assignedColor = color === "black" ? "black" : "white";
  const chess = new Chess();

  const room: RoomData = {
    roomId,
    isPractice: isPractice || false,
    fen: chess.fen(),
    sanHistory: [],
    moves: [],
    gameStarted: isPractice || false,
    gameOver: false,
    winner: null,
    pendingUndo: null,
    timers: { white: 600, black: 600 },
    lastMoveAt: Date.now(),
    players: {
      white: isPractice || assignedColor === "white" ? { name: playerName.trim() } : null,
      black: isPractice || assignedColor === "black" ? { name: playerName.trim() } : null,
    },
  };

  await saveRoom(room);

  return res.status(200).json({
    roomId,
    color: isPractice ? "both" : assignedColor,
    isPractice: isPractice || false,
    state: computeGameState(room),
  });
}
