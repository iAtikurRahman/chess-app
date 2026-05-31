import type { NextApiRequest, NextApiResponse } from "next";
import { Chess } from "chess.js";
import { v4 as uuidv4 } from "uuid";
import { saveRoom, type RoomData } from "../../../lib/redis";
import { computeGameState } from "../../../lib/gameLogic";

const BOT_NAME = "Stockfish Bot";
const VALID_TIME_CONTROLS = [300, 600, 900, 1800]; // 5, 10, 15, 30 minutes

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { playerName, color, isPractice, isBotGame, timeControl } = req.body as {
    playerName?: string;
    color?: string;
    isPractice?: boolean;
    isBotGame?: boolean;
    timeControl?: number;
  };

  if (!playerName?.trim()) {
    return res.status(400).json({ error: "Player name required" });
  }

  const roomId = uuidv4().slice(0, 8).toUpperCase();
  const timeSeconds = VALID_TIME_CONTROLS.includes(Number(timeControl)) ? Number(timeControl) : 600;
  const chess = new Chess();

  // Resolve player color (support "random")
  let assignedColor: "white" | "black";
  if (color === "black") {
    assignedColor = "black";
  } else if (color === "random") {
    assignedColor = Math.random() < 0.5 ? "white" : "black";
  } else {
    assignedColor = "white";
  }

  // Assign player slots
  let whiteName: string | null = null;
  let blackName: string | null = null;
  if (isPractice) {
    whiteName = playerName.trim();
    blackName = playerName.trim();
  } else if (isBotGame) {
    whiteName = assignedColor === "white" ? playerName.trim() : BOT_NAME;
    blackName = assignedColor === "black" ? playerName.trim() : BOT_NAME;
  } else {
    whiteName = assignedColor === "white" ? playerName.trim() : null;
    blackName = assignedColor === "black" ? playerName.trim() : null;
  }

  const room: RoomData = {
    roomId,
    isPractice: isPractice || false,
    isBotGame: !isPractice && !!isBotGame,
    fen: chess.fen(),
    sanHistory: [],
    moves: [],
    gameStarted: isPractice || !!isBotGame,
    gameOver: false,
    winner: null,
    pendingUndo: null,
    timeControl: timeSeconds,
    timers: { white: timeSeconds, black: timeSeconds },
    lastMoveAt: Date.now(),
    players: {
      white: whiteName ? { name: whiteName } : null,
      black: blackName ? { name: blackName } : null,
    },
  };

  await saveRoom(room);

  return res.status(200).json({
    roomId,
    color: isPractice ? "both" : assignedColor,
    isPractice: isPractice || false,
    isBotGame: !isPractice && !!isBotGame,
    timeControl: timeSeconds,
    state: computeGameState(room),
  });
}
