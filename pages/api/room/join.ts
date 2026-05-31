import type { NextApiRequest, NextApiResponse } from "next";
import { getRoom, saveRoom } from "../../../lib/redis";
import { pusherServer, channelName } from "../../../lib/pusher";
import { computeGameState } from "../../../lib/gameLogic";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { roomId, playerName, color } = req.body as {
    roomId?: string;
    playerName?: string;
    color?: string;
  };

  if (!roomId?.trim()) return res.status(400).json({ error: "Room ID required" });
  if (!playerName?.trim()) return res.status(400).json({ error: "Player name required" });

  const id = roomId.trim().toUpperCase();
  const room = await getRoom(id);
  if (!room) return res.status(404).json({ error: "Room not found. Check the room ID." });

  // Check if this player is rejoining
  const existingColor = (["white", "black"] as const).find(
    (c) => room.players[c]?.name === playerName.trim()
  );
  if (existingColor) {
    const state = computeGameState(room);
    await pusherServer.trigger(channelName(id), "player-reconnected", { color: existingColor });
    return res.status(200).json({ roomId: id, color: existingColor, isRejoin: true, state });
  }

  // Bot game rooms don't accept new human players — assign spectator directly
  if (room.isBotGame) {
    const state = computeGameState(room);
    return res.status(200).json({ roomId: id, color: "spectator", isRejoin: false, state });
  }

  // Assign a color to the new player
  const preferred = color === "white" || color === "black" ? color : "black";
  let assignedColor: "white" | "black" | "spectator";
  if (!room.players[preferred]) {
    assignedColor = preferred;
  } else {
    const other = preferred === "white" ? "black" : "white";
    assignedColor = !room.players[other] ? other : "spectator";
  }

  if (assignedColor !== "spectator") {
    room.players[assignedColor] = { name: playerName.trim() };
  }

  const wasStarted = room.gameStarted;
  const bothJoined = !!(room.players.white && room.players.black);
  if (bothJoined && !room.gameStarted) {
    room.gameStarted = true;
  }

  await saveRoom(room);
  const state = computeGameState(room);

  // Notify already-connected player that someone joined
  await pusherServer.trigger(channelName(id), "opponent-joined", {
    playerName: playerName.trim(),
    color: assignedColor,
    state,
  });

  // If the game just started, also fire game-started so player 1 unlocks the board
  if (bothJoined && !wasStarted) {
    await pusherServer.trigger(channelName(id), "game-started", { state });
  }

  return res.status(200).json({ roomId: id, color: assignedColor, isRejoin: false, state });
}
