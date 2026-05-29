import { useState } from "react";
import { socket } from "../lib/socket";
import type { Session } from "../types";

const COLOR_OPTIONS = [
  { value: "white", label: "White", icon: "♔" },
  { value: "black", label: "Black", icon: "♚" },
  { value: "random", label: "Random", icon: "🎲" },
];

interface RoomLobbyProps {
  onRoomJoined: (session: Session) => void;
}

export default function RoomLobby({ onRoomJoined }: RoomLobbyProps) {
  const [playerName, setPlayerName] = useState("");
  const [color, setColor] = useState("white");
  const [practiceColor, setPracticeColor] = useState<"white" | "black">("white");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"create" | "join" | "practice">("create");

  const validate = (): boolean => {
    if (!playerName.trim()) {
      setError("Enter your name first.");
      return false;
    }
    return true;
  };

  const handleCreate = () => {
    if (!validate()) return;
    setError("");
    setLoading(true);

    socket!.connect();
    socket!.emit("create-room", { playerName: playerName.trim(), color });

    socket!.once("room-created", (data: Omit<Session, "playerName">) => {
      setLoading(false);
      onRoomJoined({ ...data, playerName: playerName.trim() });
    });

    socket!.once("connect_error", () => {
      setLoading(false);
      setError("Cannot reach the server. Make sure the backend is running.");
      socket!.disconnect();
    });
  };

  const handleJoin = () => {
    if (!validate()) return;
    if (!joinRoomId.trim()) {
      setError("Enter a room ID.");
      return;
    }
    setError("");
    setLoading(true);

    socket!.connect();
    socket!.emit("join-room", {
      roomId: joinRoomId.trim().toUpperCase(),
      playerName: playerName.trim(),
      color,
    });

    socket!.once("room-joined", (data: Omit<Session, "playerName">) => {
      setLoading(false);
      onRoomJoined({ ...data, playerName: playerName.trim() });
    });

    socket!.once("error", (err: { message: string }) => {
      setLoading(false);
      setError(err.message);
      socket!.disconnect();
    });

    socket!.once("connect_error", () => {
      setLoading(false);
      setError("Cannot reach the server.");
      socket!.disconnect();
    });
  };

  const handlePractice = () => {
    if (!validate()) return;
    setError("");
    setLoading(true);

    socket!.connect();
    socket!.emit("create-practice-room", { playerName: playerName.trim() });

    socket!.once("room-created", (data: Omit<Session, "playerName" | "isPractice" | "practiceColor">) => {
      setLoading(false);
      onRoomJoined({ ...data, playerName: playerName.trim(), isPractice: true, practiceColor });
    });

    socket!.once("connect_error", () => {
      setLoading(false);
      setError("Cannot reach the server. Make sure the backend is running.");
      socket!.disconnect();
    });
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      {/* Background grid decoration */}
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,transparent,transparent 62px,#fff 62px,#fff 63px), repeating-linear-gradient(90deg,transparent,transparent 62px,#fff 62px,#fff 63px)",
        }}
      />

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">♟️</div>
          <h1 className="text-4xl font-bold tracking-tight text-white">Chess Arena</h1>
          <p className="text-gray-400 mt-2">Real-time chess with AI suggestions</p>
        </div>

        {/* Card */}
        <div className="card space-y-5">
          {/* Player Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Your Name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => {
                setPlayerName(e.target.value);
                setError("");
              }}
              onKeyDown={(e) =>
                e.key === "Enter" && (tab === "create" ? handleCreate() : handleJoin())
              }
              placeholder="Enter your name…"
              maxLength={20}
              className="w-full bg-dark-600 border border-dark-400 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition"
            />
          </div>

          {/* Color Choice — hidden in practice tab */}
          {tab !== "practice" && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Play as</label>
              <div className="grid grid-cols-3 gap-2">
                {COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setColor(opt.value)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-sm font-medium transition
                      ${
                        color === opt.value
                          ? "border-accent-blue bg-accent-blue/10 text-accent-blue"
                          : "border-dark-400 bg-dark-600 text-gray-400 hover:border-gray-500"
                      }`}
                  >
                    <span className="text-2xl">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex rounded-lg overflow-hidden border border-dark-400">
            {(
              [
                { id: "create", label: "Create Room" },
                { id: "join", label: "Join Room" },
                { id: "practice", label: "🎯 Practice" },
              ] as { id: "create" | "join" | "practice"; label: string }[]
            ).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => {
                  setTab(id);
                  setError("");
                }}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-medium transition
                  ${tab === id ? "bg-accent-blue text-white" : "bg-dark-600 text-gray-400 hover:text-white"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Create Room */}
          {tab === "create" && (
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-3 bg-accent-green hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
            >
              {loading ? "Creating…" : "Create Room"}
            </button>
          )}

          {/* Join Room */}
          {tab === "join" && (
            <div className="space-y-3">
              <input
                type="text"
                value={joinRoomId}
                onChange={(e) => {
                  setJoinRoomId(e.target.value.toUpperCase());
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="Enter Room ID (e.g. AB12CD34)"
                maxLength={8}
                className="w-full bg-dark-600 border border-dark-400 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 font-mono tracking-widest focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition"
              />
              <button
                onClick={handleJoin}
                disabled={loading}
                className="w-full py-3 bg-accent-blue hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
              >
                {loading ? "Joining…" : "Join Room"}
              </button>
            </div>
          )}

          {/* Practice Mode */}
          {tab === "practice" && (
            <div className="space-y-3">
              <div className="bg-dark-600 border border-dark-400 rounded-lg p-3 text-sm text-gray-400">
                <p className="font-medium text-gray-300 mb-1">Solo Practice Mode</p>
                <p>Play both sides yourself. AI will suggest the best move after every turn.</p>
              </div>
              {/* Board perspective picker */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Board Perspective
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: "white", label: "White", icon: "♔" },
                      { value: "black", label: "Black", icon: "♚" },
                    ] as { value: "white" | "black"; label: string; icon: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPracticeColor(opt.value)}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition
                        ${
                          practiceColor === opt.value
                            ? "border-amber-500 bg-amber-600/20 text-amber-400"
                            : "border-dark-400 bg-dark-600 text-gray-400 hover:border-gray-500"
                        }`}
                    >
                      <span className="text-xl">{opt.icon}</span>
                      {opt.label} at bottom
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handlePractice}
                disabled={loading}
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
              >
                {loading ? "Starting…" : "Start Practice"}
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-accent-red text-sm text-center animate-fade-in">{error}</p>
          )}
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Two players · Stockfish AI hints · Real-time via Socket.IO · Solo practice mode
        </p>
      </div>
    </div>
  );
}
