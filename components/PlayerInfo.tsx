import type { PlayerData } from "../types";

interface PlayerInfoProps {
  player: PlayerData | null | undefined;
  color: string;
  timeLeft: number;
  isActive: boolean;
  isMe: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function PlayerInfo({ player, color, timeLeft, isActive, isMe }: PlayerInfoProps) {
  const isLow = timeLeft <= 30;

  return (
    <div
      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition
        ${isActive ? "border-accent-blue bg-accent-blue/10" : "border-dark-400 bg-dark-700/50"}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center text-xl border-2
            ${color === "white" ? "bg-gray-100 border-gray-300 text-gray-900" : "bg-gray-800 border-gray-600 text-gray-100"}`}
        >
          {color === "white" ? "♔" : "♚"}
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-white text-sm">
              {player?.name || (color === "white" ? "White" : "Black")}
            </span>
            {isMe && (
              <span className="text-xs text-accent-blue bg-accent-blue/10 px-1.5 py-0.5 rounded">
                You
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                player?.connected !== false ? "bg-accent-green" : "bg-gray-500"
              }`}
            />
            <span className="text-xs text-gray-500">
              {player?.connected !== false ? "Online" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>

      <div
        className={`font-mono font-bold text-lg tabular-nums
          ${isActive ? (isLow ? "text-accent-red animate-pulse2" : "text-white") : "text-gray-500"}`}
      >
        {formatTime(timeLeft)}
      </div>
    </div>
  );
}
