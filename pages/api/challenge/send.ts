import type { NextApiRequest, NextApiResponse } from "next";
import { Chess } from "chess.js";
import { v4 as uuidv4 } from "uuid";
import { saveRoom, type RoomData } from "../../../lib/redis";
import { computeGameState } from "../../../lib/gameLogic";
import { pusherServer, personalChannel } from "../../../lib/pusher";

const VALID_TIME_CONTROLS = [300, 600, 900, 1800];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { fromName, fromEmail, toEmail, toName, timeControl } = req.body as {
    fromName?: string;
    fromEmail?: string;
    toEmail?: string;
    toName?: string;
    timeControl?: number;
  };

  if (!fromName?.trim() || !fromEmail?.trim() || !toEmail?.trim()) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (fromEmail.trim().toLowerCase() === toEmail.trim().toLowerCase()) {
    return res.status(400).json({ error: "Cannot challenge yourself" });
  }

  const timeSeconds = VALID_TIME_CONTROLS.includes(Number(timeControl)) ? Number(timeControl) : 600;

  // Random color assignment
  const challengerColor: "white" | "black" = Math.random() < 0.5 ? "white" : "black";
  const opponentColor: "white" | "black" = challengerColor === "white" ? "black" : "white";

  const roomId = uuidv4().slice(0, 8).toUpperCase();
  const chess = new Chess();

  const room: RoomData = {
    roomId,
    isPractice: false,
    isBotGame: false,
    fen: chess.fen(),
    sanHistory: [],
    moves: [],
    gameStarted: false,
    gameOver: false,
    winner: null,
    pendingUndo: null,
    timeControl: timeSeconds,
    timers: { white: timeSeconds, black: timeSeconds },
    lastMoveAt: Date.now(),
    players: {
      white: challengerColor === "white" ? { name: fromName.trim() } : null,
      black: challengerColor === "black" ? { name: fromName.trim() } : null,
    },
  };

  await saveRoom(room);

  // Send challenge notification to the target user's personal Pusher channel
  await pusherServer.trigger(personalChannel(toEmail.trim()), "challenge-received", {
    roomId,
    fromName: fromName.trim(),
    fromEmail: fromEmail.trim(),
    opponentColor,
    timeControl: timeSeconds,
    expiresAt: Date.now() + 90_000,
  });

  return res.status(200).json({
    roomId,
    color: challengerColor,
    timeControl: timeSeconds,
    state: computeGameState(room),
  });
}
