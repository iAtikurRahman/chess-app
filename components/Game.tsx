import { useState, useCallback } from "react";
import { useGameSocket } from "../hooks/useGameSocket";
import ChessBoard from "./ChessBoard";
import PlayerInfo from "./PlayerInfo";
import MoveHistory from "./MoveHistory";
import SuggestionPanel from "./SuggestionPanel";
import CapturedPieces from "./CapturedPieces";
import GameStatus from "./GameStatus";
import type { Session, MoveInput } from "../types";

interface GameProps {
  session: Session;
  onLeave: () => void;
}

export default function Game({ session, onLeave }: GameProps) {
  const { roomId, color: myColor, playerName: _playerName, isPractice, practiceColor } = session;

  const {
    gameState,
    suggestion,
    gameResult,
    undoRequest,
    connectionStatus,
    waitingForOpponent,
    actions,
  } = useGameSocket(session);

  const [copied, setCopied] = useState(false);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);

  const boardOrientation =
    isPractice
      ? (practiceColor ?? "white")
      : myColor === "spectator"
      ? "white"
      : (myColor as "white" | "black");

  const isSpectator = myColor === "spectator";

  const isMyTurn = isPractice
    ? !gameResult && !gameState.isGameOver
    : !isSpectator &&
      !gameResult &&
      !gameState.isGameOver &&
      ((gameState.turn === "white" && myColor === "white") ||
        (gameState.turn === "black" && myColor === "black"));

  const activeColor: "white" | "black" | "spectator" = isPractice
    ? gameState.turn
    : (myColor as "white" | "black" | "spectator");
  const sideColor: "white" | "black" = isPractice
    ? gameState.turn === "white"
      ? "black"
      : "white"
    : myColor === "white"
    ? "black"
    : "white";

  const opponentColor = isPractice ? sideColor : myColor === "white" ? "black" : "white";
  const myPlayer =
    gameState.players?.[
      (activeColor === "spectator" ? "white" : activeColor) as "white" | "black"
    ];
  const opponentPlayer = gameState.players?.[opponentColor as "white" | "black"];

  const myActiveColor: "white" | "black" =
    activeColor === "spectator" ? "white" : (activeColor as "white" | "black");

  const capturedByMe =
    gameState.captured?.[
      isPractice ? myActiveColor : (myColor === "spectator" ? "white" : (myColor as "white" | "black"))
    ] ?? [];
  const capturedByOpponent = gameState.captured?.[opponentColor as "white" | "black"] ?? [];

  const handleCopyRoomLink = useCallback(() => {
    const text = `Join my Chess Arena game! Room ID: ${roomId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }

    function fallbackCopy(str: string) {
      const el = document.createElement("textarea");
      el.value = str;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [roomId]);

  const handleMove = useCallback(
    (move: MoveInput) => actions.makeMove(move),
    [actions]
  );

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-2 py-2 sm:px-4 sm:py-3 bg-dark-800 border-b border-dark-600">
        <div className="flex items-center gap-3">
          <span className="text-2xl">♟️</span>
          <span className="font-bold text-white hidden sm:block">Chess Arena</span>
          {isPractice && (
            <span className="text-xs bg-amber-600/20 text-amber-400 border border-amber-600/40 px-2 py-0.5 rounded-full font-medium">
              🎯 Practice Mode
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 hidden sm:block">Room:</span>
          <span className="font-mono font-bold text-accent-blue text-sm bg-dark-600 px-3 py-1 rounded-lg">
            {roomId}
          </span>
          {!isPractice && (
            <button
              onClick={handleCopyRoomLink}
              className="text-xs bg-dark-600 hover:bg-dark-500 text-gray-400 hover:text-white px-2 py-1 rounded transition"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {connectionStatus !== "connected" && (
            <span className="text-xs text-accent-red animate-pulse2">
              ⚠ Opponent disconnected
            </span>
          )}
          <button
            onClick={() => setShowConfirmLeave(true)}
            className="text-sm text-gray-400 hover:text-white transition"
          >
            Leave
          </button>
        </div>
      </header>

      {/* Confirm leave modal */}
      {showConfirmLeave && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card max-w-sm w-full mx-4 space-y-4">
            <p className="text-white font-semibold">Leave the game?</p>
            <p className="text-gray-400 text-sm">Your opponent will be notified.</p>
            <div className="flex gap-3">
              <button
                onClick={onLeave}
                className="flex-1 py-2 bg-accent-red/20 hover:bg-accent-red/30 text-accent-red rounded-lg text-sm font-medium transition"
              >
                Leave
              </button>
              <button
                onClick={() => setShowConfirmLeave(false)}
                className="flex-1 py-2 bg-dark-600 hover:bg-dark-500 text-gray-300 rounded-lg text-sm font-medium transition"
              >
                Stay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo request notification */}
      {undoRequest && (
        <div className="fixed bottom-4 right-4 card max-w-xs w-full space-y-3 z-50 animate-slide-up">
          <p className="text-white text-sm font-medium">
            {undoRequest.requestedBy === myColor
              ? "Waiting for opponent to accept undo…"
              : `${undoRequest.requestedBy === "white" ? "White" : "Black"} requests an undo.`}
          </p>
          {undoRequest.requestedBy !== myColor && (
            <div className="flex gap-2">
              <button
                onClick={actions.acceptUndo}
                className="flex-1 py-1.5 bg-accent-green/20 hover:bg-accent-green/30 text-accent-green rounded-lg text-xs font-medium transition"
              >
                Accept
              </button>
              <button
                onClick={actions.rejectUndo}
                className="flex-1 py-1.5 bg-accent-red/20 hover:bg-accent-red/30 text-accent-red rounded-lg text-xs font-medium transition"
              >
                Decline
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Main layout ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col xl:flex-row gap-2 sm:gap-4 p-2 sm:p-4 max-w-[1400px] mx-auto w-full">

        {/* ── Left sidebar ────────────────────────────────────────────────────── */}
        <aside className="xl:w-72 space-y-2 sm:space-y-3 order-2 xl:order-1">
          <div className="hidden xl:block">
            <PlayerInfo
              player={opponentPlayer}
              color={opponentColor}
              timeLeft={gameState.timers[opponentColor as "white" | "black"]}
              isActive={
                isPractice
                  ? gameState.turn === opponentColor && !gameResult
                  : !isMyTurn && !gameResult && !waitingForOpponent
              }
              isMe={!!isPractice}
            />
          </div>

          <div className="hidden xl:block card">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">
              {isPractice
                ? `${opponentColor} captured`
                : isSpectator
                ? `${opponentColor} captured`
                : "You lost"}
            </p>
            <CapturedPieces
              pieces={capturedByOpponent}
              capturedFrom={
                isPractice ? myActiveColor : myColor === "spectator" ? "white" : myColor
              }
            />
          </div>

          <div className="card flex-1">
            <h3 className="font-semibold text-white text-sm mb-3">Move History</h3>
            <div className="max-h-32 xl:max-h-none overflow-y-auto">
              <MoveHistory sanHistory={gameState.sanHistory} />
            </div>
          </div>

          <div className="hidden xl:block card">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">
              {isPractice
                ? `${activeColor} captured`
                : isSpectator
                ? `${myColor} captured`
                : "You captured"}
            </p>
            <CapturedPieces
              pieces={capturedByMe}
              capturedFrom={
                isPractice ? opponentColor : myColor === "spectator" ? "black" : opponentColor
              }
            />
          </div>

          <div className="hidden xl:block">
            <PlayerInfo
              player={myPlayer}
              color={
                isPractice
                  ? myActiveColor
                  : myColor === "spectator"
                  ? "white"
                  : myColor
              }
              timeLeft={
                gameState.timers[
                  isPractice
                    ? myActiveColor
                    : myColor === "spectator"
                    ? "white"
                    : (myColor as "white" | "black")
                ]
              }
              isActive={
                isPractice ? gameState.turn === activeColor && !gameResult : isMyTurn
              }
              isMe={true}
            />
          </div>
        </aside>

        {/* ── Center: board ────────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col items-center gap-2 sm:gap-4 order-1 xl:order-2">
          <div className="w-full max-w-[640px] card py-1.5 sm:py-2.5 text-center">
            <GameStatus
              gameState={gameState}
              gameResult={gameResult}
              myColor={isPractice ? gameState.turn : myColor}
              waitingForOpponent={waitingForOpponent}
              isPractice={isPractice}
            />
          </div>

          {/* Mobile: opponent info strip */}
          <div className="xl:hidden w-full max-w-[640px]">
            <PlayerInfo
              player={opponentPlayer}
              color={opponentColor}
              timeLeft={gameState.timers[opponentColor as "white" | "black"]}
              isActive={
                isPractice
                  ? gameState.turn === opponentColor && !gameResult
                  : !isMyTurn && !gameResult && !waitingForOpponent
              }
              isMe={!!isPractice}
              compact
            />
          </div>

          <div className="w-full max-w-[640px]">
            <ChessBoard
              fen={gameState.fen}
              orientation={boardOrientation}
              isMyTurn={isMyTurn}
              suggestion={suggestion}
              onMove={handleMove}
              gameOver={!!gameResult || gameState.isGameOver}
            />
          </div>

          {/* Mobile: my info strip */}
          <div className="xl:hidden w-full max-w-[640px]">
            <PlayerInfo
              player={myPlayer}
              color={
                isPractice
                  ? myActiveColor
                  : myColor === "spectator"
                  ? "white"
                  : myColor
              }
              timeLeft={
                gameState.timers[
                  isPractice
                    ? myActiveColor
                    : myColor === "spectator"
                    ? "white"
                    : (myColor as "white" | "black")
                ]
              }
              isActive={
                isPractice ? gameState.turn === activeColor && !gameResult : isMyTurn
              }
              isMe={true}
              compact
            />
          </div>

          {/* Mobile: controls */}
          {!isSpectator && (
            <div className="xl:hidden w-full max-w-[640px] flex gap-2">
              <button
                onClick={actions.requestUndo}
                disabled={!!gameResult || (gameState.sanHistory?.length ?? 0) < 1}
                className="flex-1 py-2 text-xs bg-dark-600 hover:bg-dark-500 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 rounded-lg transition"
              >
                ↩ Undo
              </button>
              <button
                onClick={actions.restartGame}
                disabled={waitingForOpponent}
                className="flex-1 py-2 text-xs bg-dark-600 hover:bg-dark-500 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 rounded-lg transition"
              >
                🔄 New
              </button>
              {!isPractice && (
                <button
                  onClick={actions.resign}
                  disabled={!!gameResult || waitingForOpponent}
                  className="flex-1 py-2 text-xs bg-accent-red/20 hover:bg-accent-red/30 disabled:opacity-40 disabled:cursor-not-allowed text-accent-red rounded-lg transition"
                >
                  🏳 Resign
                </button>
              )}
            </div>
          )}

          {/* spacer so fixed bar doesn't overlap controls on mobile */}
          <div className="xl:hidden h-14" />
        </main>

        {/* ── Mobile: fixed AI suggestion bar (never causes scroll) ─────────── */}
        {!isSpectator && (
          <div className="xl:hidden fixed bottom-0 left-0 right-0 z-40 bg-dark-800/95 backdrop-blur border-t border-dark-600 px-3 py-2 flex items-center gap-3">
            <span className="text-base shrink-0">🤖</span>
            {!suggestion ? (
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <svg className="animate-spin w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                AI calculating…
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
                <span className="text-gray-400 text-xs shrink-0">Best move:</span>
                <span className="font-mono font-bold text-accent-green bg-accent-green/10 px-2 py-0.5 rounded text-sm shrink-0">
                  {suggestion.from}
                </span>
                <span className="text-gray-500 shrink-0">→</span>
                <span className="font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded text-sm shrink-0">
                  {suggestion.to}
                </span>
                {suggestion.promotion && (
                  <span className="text-xs text-gray-400 shrink-0">={suggestion.promotion.toUpperCase()}</span>
                )}
                <span className="text-xs text-gray-500 ml-auto truncate">
                  {isMyTurn ? "highlighted on board" : "your turn next…"}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Right sidebar ────────────────────────────────────────────────────── */}
        <aside className="hidden xl:block xl:w-72 space-y-3 order-3">
          <SuggestionPanel
            suggestion={suggestion}
            isMyTurn={isMyTurn}
            isSpectator={isSpectator}
          />

          <div className="card space-y-2">
            <h3 className="font-semibold text-white text-sm mb-1">Controls</h3>

            {!isSpectator && (
              <>
                <button
                  onClick={actions.requestUndo}
                  disabled={!!gameResult || (gameState.sanHistory?.length ?? 0) < 1}
                  className="w-full py-2 text-sm bg-dark-600 hover:bg-dark-500 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 rounded-lg transition"
                >
                  {isPractice ? "↩ Undo Last Move" : "↩ Request Undo"}
                </button>

                <button
                  onClick={actions.restartGame}
                  disabled={waitingForOpponent}
                  className="w-full py-2 text-sm bg-dark-600 hover:bg-dark-500 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 rounded-lg transition"
                >
                  🔄 New Game
                </button>

                {!isPractice && (
                  <button
                    onClick={actions.resign}
                    disabled={!!gameResult || waitingForOpponent}
                    className="w-full py-2 text-sm bg-accent-red/20 hover:bg-accent-red/30 disabled:opacity-40 disabled:cursor-not-allowed text-accent-red rounded-lg transition"
                  >
                    🏳 Resign
                  </button>
                )}
              </>
            )}

            {isSpectator && (
              <p className="text-xs text-gray-500 text-center">
                Spectating — no controls available.
              </p>
            )}
          </div>

          {isSpectator && (
            <div className="card text-center">
              <span className="text-2xl">👁</span>
              <p className="text-sm text-gray-400 mt-1">You are spectating</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
