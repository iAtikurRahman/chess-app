import { useState, useEffect, useRef, useCallback } from "react";
import type { Session } from "../types";

const ADMIN_USERS: string[] = JSON.parse(
  process.env.NEXT_PUBLIC_ADMINUSERS ?? '["atikur911091","sobuj911091","admin911091"]'
);

const COLOR_OPTIONS = [
  { value: "white", label: "White", icon: "\u2654" },
  { value: "black", label: "Black", icon: "\u265a" },
  { value: "random", label: "Random", icon: "\uD83C\uDFB2" },
];

const TIME_CONTROLS = [
  { value: 300, label: "5 min" },
  { value: 600, label: "10 min" },
  { value: 900, label: "15 min" },
  { value: 1800, label: "30 min" },
];

interface RoomLobbyProps {
  onRoomJoined: (session: Session) => void;
  defaultPlayerName?: string;
  defaultRoomId?: string;
  userEmail?: string;
}

export default function RoomLobby({
  onRoomJoined,
  defaultPlayerName = "",
  defaultRoomId = "",
  userEmail = "",
}: RoomLobbyProps) {
  const [playerName, setPlayerName] = useState(defaultPlayerName);
  const [color, setColor] = useState("white");
  const [practiceColor, setPracticeColor] = useState<"white" | "black">("white");
  const [joinRoomId, setJoinRoomId] = useState(defaultRoomId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"create" | "join" | "challenge" | "practice">(
    defaultRoomId ? "join" : "create"
  );
  const [timeControl, setTimeControl] = useState(600);
  const [vsBotMode, setVsBotMode] = useState(false);

  // Challenge tab state
  const [challengeQuery, setChallengeQuery] = useState("");
  const [challengeResults, setChallengeResults] = useState<{ email: string; name: string }[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<{ email: string; name: string } | null>(null);
  const [challengeTimeControl, setChallengeTimeControl] = useState(600);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdmin = ADMIN_USERS.includes(playerName.trim());

  useEffect(() => {
    if (tab === "practice" && !isAdmin) setTab("create");
  }, [isAdmin, tab]);

  // Debounced email search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (challengeQuery.trim().length < 2) {
      setChallengeResults([]);
      return;
    }
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(challengeQuery.trim())}&exclude=${encodeURIComponent(userEmail)}`
        );
        const data = await res.json();
        setChallengeResults(data.users ?? []);
      } catch {
        setChallengeResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [challengeQuery, userEmail]);

  const validate = (): boolean => {
    if (!playerName.trim()) {
      setError("Enter your name first.");
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: playerName.trim(),
          color,
          isBotGame: vsBotMode,
          timeControl,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create room."); return; }
      onRoomJoined({ ...data, playerName: playerName.trim() });
    } catch {
      setError("Cannot reach the server.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!validate()) return;
    if (!joinRoomId.trim()) { setError("Enter a room ID."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: joinRoomId.trim().toUpperCase(),
          playerName: playerName.trim(),
          color,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to join room."); return; }
      onRoomJoined({ ...data, playerName: playerName.trim() });
    } catch {
      setError("Cannot reach the server.");
    } finally {
      setLoading(false);
    }
  };

  const handleChallenge = async () => {
    if (!validate()) return;
    if (!selectedTarget) { setError("Select a player to challenge."); return; }
    setError("");
    setChallengeLoading(true);
    try {
      const res = await fetch("/api/challenge/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromName: playerName.trim(),
          fromEmail: userEmail,
          toEmail: selectedTarget.email,
          toName: selectedTarget.name,
          timeControl: challengeTimeControl,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to send challenge."); return; }
      // Enter the room in waiting state
      onRoomJoined({ ...data, playerName: playerName.trim() });
    } catch {
      setError("Cannot reach the server.");
    } finally {
      setChallengeLoading(false);
    }
  };

  const handlePractice = async () => {
    if (!validate()) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: playerName.trim(), isPractice: true }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to start practice."); return; }
      onRoomJoined({ ...data, playerName: playerName.trim(), isPractice: true, practiceColor });
    } catch {
      setError("Cannot reach the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,transparent,transparent 62px,#fff 62px,#fff 63px), repeating-linear-gradient(90deg,transparent,transparent 62px,#fff 62px,#fff 63px)",
        }}
      />

      <div className="relative w-full max-w-md animate-slide-up">
        <div className="text-center mb-4 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">Chess Arena</h1>
          <p className="text-gray-400 mt-2 text-sm sm:text-base">Real-time chess with AI suggestions</p>
        </div>

        <div className="card space-y-5">
          {/* Player Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Your Name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => { setPlayerName(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && (tab === "create" ? handleCreate() : tab === "join" ? handleJoin() : undefined)}
              placeholder="Enter your name\u2026"
              maxLength={20}
              className="w-full bg-dark-600 border border-dark-400 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition"
            />
          </div>

          {/* Color Choice - only for create/join tabs */}
          {(tab === "create" || tab === "join") && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Play as</label>
              <div className="grid grid-cols-3 gap-2">
                {COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setColor(opt.value)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-sm font-medium transition
                      ${color === opt.value
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
                { id: "join", label: "Join / Watch" },
                { id: "challenge", label: "\u2694\uFE0F Challenge" },
                ...(isAdmin ? [{ id: "practice", label: "\uD83C\uDFAF Practice" }] : []),
              ] as { id: "create" | "join" | "challenge" | "practice"; label: string }[]
            ).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { setTab(id); setError(""); }}
                className={`flex-1 py-2.5 text-xs sm:text-sm font-medium transition
                  ${tab === id ? "bg-accent-blue text-white" : "bg-dark-600 text-gray-400 hover:text-white"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Create Room ── */}
          {tab === "create" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Time Control</label>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_CONTROLS.map((tc) => (
                    <button
                      key={tc.value}
                      onClick={() => setTimeControl(tc.value)}
                      className={`py-2 rounded-lg border text-sm font-semibold transition
                        ${timeControl === tc.value
                          ? "border-accent-green bg-accent-green/10 text-accent-green"
                          : "border-dark-400 bg-dark-600 text-gray-400 hover:border-gray-500"
                        }`}
                    >
                      {tc.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setVsBotMode((v) => !v)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-sm font-medium transition
                  ${vsBotMode
                    ? "border-purple-500 bg-purple-600/15 text-purple-300"
                    : "border-dark-400 bg-dark-600 text-gray-400 hover:border-gray-500"
                  }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-lg">\uD83E\uDD16</span>
                  Play vs Stockfish Bot
                </span>
                <span className={`w-9 h-5 rounded-full flex items-center transition-colors px-0.5 ${vsBotMode ? "bg-purple-600" : "bg-dark-400"}`}>
                  <span className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${vsBotMode ? "translate-x-4" : "translate-x-0"}`} />
                </span>
              </button>

              {vsBotMode && (
                <p className="text-xs text-purple-300/70 -mt-2">
                  Game starts immediately \u2014 Stockfish plays the other color.
                </p>
              )}

              <button
                onClick={handleCreate}
                disabled={loading}
                className="w-full py-3 bg-accent-green hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
              >
                {loading ? "Creating\u2026" : vsBotMode ? "Play vs Bot" : "Create Room"}
              </button>
            </div>
          )}

          {/* ── Join / Watch Room ── */}
          {tab === "join" && (
            <div className="space-y-3">
              <div className="bg-dark-600/50 border border-dark-400 rounded-lg px-3 py-2 text-xs text-gray-400">
                Enter a Room ID to join as a player or watch as a spectator.
              </div>
              <input
                type="text"
                value={joinRoomId}
                onChange={(e) => { setJoinRoomId(e.target.value.toUpperCase()); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="Room ID (e.g. AB12CD34)"
                maxLength={8}
                className="w-full bg-dark-600 border border-dark-400 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 font-mono tracking-widest focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition"
              />
              <button
                onClick={handleJoin}
                disabled={loading}
                className="w-full py-3 bg-accent-blue hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
              >
                {loading ? "Joining\u2026" : "Join / Watch Room"}
              </button>
            </div>
          )}

          {/* ── Challenge a Player ── */}
          {tab === "challenge" && (
            <div className="space-y-3">
              <div className="bg-dark-600/50 border border-dark-400 rounded-lg px-3 py-2 text-xs text-gray-400">
                Search a player by email, challenge them. Colors are assigned randomly.
              </div>

              {/* Email Search */}
              <div className="relative">
                <input
                  type="text"
                  value={challengeQuery}
                  onChange={(e) => {
                    setChallengeQuery(e.target.value);
                    setSelectedTarget(null);
                    setError("");
                  }}
                  placeholder="Search by email\u2026"
                  className="w-full bg-dark-600 border border-dark-400 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition pr-8"
                />
                {searchLoading && (
                  <svg className="animate-spin w-4 h-4 text-gray-400 absolute right-3 top-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
              </div>

              {/* Search Results */}
              {challengeResults.length > 0 && !selectedTarget && (
                <div className="bg-dark-700 border border-dark-400 rounded-lg overflow-hidden">
                  {challengeResults.map((u) => (
                    <button
                      key={u.email}
                      onClick={() => {
                        setSelectedTarget(u);
                        setChallengeQuery(u.email);
                        setChallengeResults([]);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-dark-600 text-left transition border-b border-dark-500 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-accent-blue/20 flex items-center justify-center text-accent-blue font-bold text-sm shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{u.name}</p>
                        <p className="text-gray-400 text-xs truncate">{u.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected target card */}
              {selectedTarget && (
                <div className="flex items-center gap-3 bg-accent-blue/10 border border-accent-blue/30 rounded-lg px-4 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-accent-blue/30 flex items-center justify-center text-accent-blue font-bold text-sm shrink-0">
                    {selectedTarget.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{selectedTarget.name}</p>
                    <p className="text-gray-400 text-xs truncate">{selectedTarget.email}</p>
                  </div>
                  <button
                    onClick={() => { setSelectedTarget(null); setChallengeQuery(""); }}
                    className="text-gray-500 hover:text-gray-300 text-xs transition"
                  >
                    \u2715
                  </button>
                </div>
              )}

              {/* Time Control for challenge */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Time Control</label>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_CONTROLS.map((tc) => (
                    <button
                      key={tc.value}
                      onClick={() => setChallengeTimeControl(tc.value)}
                      className={`py-1.5 rounded-lg border text-xs font-semibold transition
                        ${challengeTimeControl === tc.value
                          ? "border-accent-green bg-accent-green/10 text-accent-green"
                          : "border-dark-400 bg-dark-600 text-gray-400 hover:border-gray-500"
                        }`}
                    >
                      {tc.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>\uD83C\uDFB2</span>
                <span>Colors will be randomly assigned to both players.</span>
              </div>

              <button
                onClick={handleChallenge}
                disabled={challengeLoading || !selectedTarget}
                className="w-full py-3 bg-accent-blue hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
              >
                {challengeLoading ? "Sending\u2026" : selectedTarget ? `Challenge ${selectedTarget.name}` : "Select a player first"}
              </button>
            </div>
          )}

          {/* ── Practice Mode (admin only) ── */}
          {tab === "practice" && (
            <div className="space-y-3">
              <div className="bg-dark-600 border border-dark-400 rounded-lg p-3 text-sm text-gray-400">
                <p className="font-medium text-gray-300 mb-1">Solo Practice Mode</p>
                <p>Play both sides yourself. AI will suggest the best move after every turn.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Board Perspective</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: "white", label: "White", icon: "\u2654" },
                    { value: "black", label: "Black", icon: "\u265a" },
                  ] as { value: "white" | "black"; label: string; icon: string }[]).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPracticeColor(opt.value)}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition
                        ${practiceColor === opt.value
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
                {loading ? "Starting\u2026" : "Start Practice"}
              </button>
            </div>
          )}

          {error && (
            <p className="text-accent-red text-sm text-center animate-fade-in">{error}</p>
          )}
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Multiplayer vs Stockfish Bot Challenge friends AI hints Practice (admin)
        </p>
      </div>
    </div>
  );
}