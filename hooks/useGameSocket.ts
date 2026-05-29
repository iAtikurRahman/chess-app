import { useState, useEffect, useCallback, useRef } from "react";
import { Chess } from "chess.js";
import { socket } from "../lib/socket";
import { useSound } from "./useSound";
import { useStockfishBrowser } from "./useStockfishBrowser";
import type { GameState, GameResult, Suggestion, Session, MoveInput } from "../types";

const INITIAL_STATE: GameState = {
  fen: "start",
  sanHistory: [],
  history: [],
  captured: { white: [], black: [] },
  turn: "white",
  isCheck: false,
  isCheckmate: false,
  isStalemate: false,
  isDraw: false,
  isGameOver: false,
  timers: { white: 600, black: 600 },
  players: { white: null, black: null },
  isPractice: false,
};

interface UndoRequest {
  requestedBy: string;
}

export function useGameSocket(session: Session) {
  const { roomId, color: myColor, isPractice } = session;

  const [gameState, setGameState] = useState<GameState>(session.state ?? INITIAL_STATE);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [undoRequest, setUndoRequest] = useState<UndoRequest | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("connected");
  const [waitingForOpponent, setWaitingForOpponent] = useState(
    isPractice ? false : !session.state?.players?.white || !session.state?.players?.black
  );

  const sounds = useSound();
  const { getBestMove: getBestMoveBrowser } = useStockfishBrowser(!!isPractice);
  const latestFenRef = useRef<string | null>(null);

  const computeBrowserSuggestion = useCallback(
    (fen: string) => {
      if (!isPractice) return;
      latestFenRef.current = fen;
      setSuggestion(null);
      getBestMoveBrowser(fen, 12).then((uciMove) => {
        if (latestFenRef.current !== fen) return;
        if (!uciMove || uciMove === "(none)") return;
        setSuggestion({
          from: uciMove.slice(0, 2),
          to: uciMove.slice(2, 4),
          promotion: uciMove[4] ?? null,
          uci: uciMove,
        });
      });
    },
    [isPractice, getBestMoveBrowser]
  );

  // Trigger first suggestion in practice mode on mount
  useEffect(() => {
    if (!isPractice) return;
    const t = setTimeout(() => {
      const fen =
        gameState.fen && gameState.fen !== "start"
          ? gameState.fen
          : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
      computeBrowserSuggestion(fen);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;
    const sock = socket;
    const applyState = (state: GameState) => setGameState(state);

    sock.on("game-started", ({ state }: { state: GameState }) => {
      applyState(state);
      setWaitingForOpponent(false);
      sock.emit("request-suggestion", { roomId });
    });

    sock.on("opponent-joined", ({ state }: { state: GameState }) => {
      applyState(state);
      setWaitingForOpponent(false);
    });

    sock.on("move-made", ({ move, state }: { move: { captured?: string; flags?: string }; state: GameState }) => {
      applyState(state);
      if (move.captured) sounds.playCapture();
      else if (move.flags?.includes("k") || move.flags?.includes("q")) sounds.playCastle();
      else sounds.playMove();
      if (state.isCheck) sounds.playCheck();
      if (isPractice && state.fen && !state.isGameOver) {
        computeBrowserSuggestion(state.fen);
      }
    });

    sock.on("suggestion", (data: Suggestion) => {
      if (!isPractice) setSuggestion(data);
    });

    sock.on("timer-update", ({ timers }: { timers: { white: number; black: number } }) => {
      setGameState((prev) => ({ ...prev, timers }));
    });

    sock.on("game-over", (result: GameResult) => {
      setGameResult(result);
      sounds.playGameOver();
      sock.emit("stop-timer", { roomId });
    });

    sock.on("undo-requested", ({ requestedBy }: { requestedBy: string }) => {
      setUndoRequest({ requestedBy });
    });

    sock.on("undo-accepted", ({ state }: { state: GameState }) => {
      applyState(state);
      setUndoRequest(null);
      setSuggestion(null);
      if (isPractice && state.fen && !state.isGameOver) {
        computeBrowserSuggestion(state.fen);
      }
    });

    sock.on("undo-rejected", () => {
      setUndoRequest(null);
    });

    sock.on("game-restarted", ({ state }: { state: GameState }) => {
      applyState(state);
      setGameResult(null);
      setSuggestion(null);
      if (isPractice && state.fen && !state.isGameOver) {
        computeBrowserSuggestion(state.fen);
      }
    });

    sock.on("player-disconnected", ({ color }: { color: string }) => {
      setConnectionStatus(`${color}-disconnected`);
    });

    sock.on("player-reconnected", () => {
      setConnectionStatus("connected");
      sock.emit("request-suggestion", { roomId });
    });

    sock.on("invalid-move", () => {
      sounds.playError();
    });

    sock.on("error", (err: { message: string }) => {
      console.error("[socket error]", err.message);
    });

    return () => {
      sock.off("game-started");
      sock.off("opponent-joined");
      sock.off("move-made");
      sock.off("suggestion");
      sock.off("timer-update");
      sock.off("game-over");
      sock.off("undo-requested");
      sock.off("undo-accepted");
      sock.off("undo-rejected");
      sock.off("game-restarted");
      sock.off("player-disconnected");
      sock.off("player-reconnected");
      sock.off("invalid-move");
      sock.off("error");
    };
  }, [roomId, sounds]); // eslint-disable-line react-hooks/exhaustive-deps

  const getChess = useCallback(() => {
    const c = new Chess();
    if (gameState.fen && gameState.fen !== "start") {
      try {
        c.load(gameState.fen);
      } catch {
        /* keep default */
      }
    }
    return c;
  }, [gameState.fen]);

  const makeMove = useCallback(
    (move: MoveInput) => {
      if (gameResult || gameState.isGameOver) return false;
      const isMyTurn = isPractice
        ? true
        : myColor !== "spectator" &&
          ((gameState.turn === "white" && myColor === "white") ||
            (gameState.turn === "black" && myColor === "black"));
      if (!isMyTurn) return false;
      socket?.emit("make-move", { roomId, move });
      setSuggestion(null);
      return true;
    },
    [roomId, myColor, isPractice, gameState.turn, gameState.isGameOver, gameResult]
  );

  const resign = useCallback(() => socket?.emit("resign", { roomId }), [roomId]);
  const requestUndo = useCallback(() => socket?.emit("request-undo", { roomId }), [roomId]);
  const acceptUndo = useCallback(() => {
    socket?.emit("accept-undo", { roomId });
    setUndoRequest(null);
  }, [roomId]);
  const rejectUndo = useCallback(() => {
    socket?.emit("reject-undo", { roomId });
    setUndoRequest(null);
  }, [roomId]);
  const restartGame = useCallback(() => socket?.emit("restart-game", { roomId }), [roomId]);

  return {
    gameState,
    suggestion,
    gameResult,
    undoRequest,
    connectionStatus,
    waitingForOpponent,
    getChess,
    actions: { makeMove, resign, requestUndo, acceptUndo, rejectUndo, restartGame },
  };
}
