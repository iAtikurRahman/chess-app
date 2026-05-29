import { useState, useEffect, useCallback, useRef } from "react";
import Pusher from "pusher-js";
import { Chess } from "chess.js";
import { useSound } from "./useSound";
import { useStockfishBrowser } from "./useStockfishBrowser";
import type { GameState, GameResult, Suggestion, Session, MoveInput } from "../types";

const INITIAL_STATE: GameState = {
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
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
  const { roomId, color: myColor, isPractice, playerName } = session;

  const [gameState, setGameState] = useState<GameState>(session.state ?? INITIAL_STATE);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [undoRequest, setUndoRequest] = useState<UndoRequest | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("connected");
  const [waitingForOpponent, setWaitingForOpponent] = useState(
    isPractice ? false : !session.state?.players?.white || !session.state?.players?.black
  );

  const sounds = useSound();
  // Always enable browser Stockfish for both practice and multiplayer suggestions
  const { getBestMove: getBestMoveBrowser } = useStockfishBrowser(true);
  const latestFenRef = useRef<string | null>(null);
  const gameStateRef = useRef<GameState>(session.state ?? INITIAL_STATE);

  // Keep ref in sync so action callbacks always see the latest state
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const computeSuggestion = useCallback(
    (fen: string) => {
      latestFenRef.current = fen;
      setSuggestion(null);
      getBestMoveBrowser(fen, isPractice ? 12 : 14).then((uciMove) => {
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

  // Compute initial suggestion for practice mode
  useEffect(() => {
    if (!isPractice) return;
    const fen = session.state?.fen ?? INITIAL_STATE.fen;
    const t = setTimeout(() => computeSuggestion(fen), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Client-side timer countdown (synced from server on each move-made event)
  useEffect(() => {
    if (gameResult || gameState.isGameOver) return;
    if (!gameState.players.white || !gameState.players.black) return;

    const interval = setInterval(() => {
      setGameState((prev) => {
        if (prev.isGameOver) return prev;
        const activeSide = prev.turn;
        const remaining = prev.timers[activeSide];
        if (remaining <= 0) return prev;
        return { ...prev, timers: { ...prev.timers, [activeSide]: remaining - 1 } };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [
    gameState.turn,
    gameState.players.white,
    gameState.players.black,
    gameResult,
    gameState.isGameOver,
  ]);

  // Pusher real-time subscription
  useEffect(() => {
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    const channel = pusher.subscribe(`game-${roomId}`);

    channel.bind("game-started", ({ state }: { state: GameState }) => {
      setGameState(state);
      setWaitingForOpponent(false);
      if (state.fen) computeSuggestion(state.fen);
    });

    channel.bind("opponent-joined", ({ state }: { state: GameState }) => {
      setGameState(state);
      setWaitingForOpponent(false);
    });

    channel.bind(
      "move-made",
      ({ move, state }: { move: { captured?: string; flags?: string }; state: GameState }) => {
        setGameState(state);
        if (move.captured) sounds.playCapture();
        else if (move.flags?.includes("k") || move.flags?.includes("q")) sounds.playCastle();
        else sounds.playMove();
        if (state.isCheck) sounds.playCheck();
        if (!state.isGameOver && state.fen) computeSuggestion(state.fen);
      }
    );

    channel.bind("game-over", (result: GameResult) => {
      setGameResult(result);
      sounds.playGameOver();
    });

    channel.bind("undo-requested", ({ requestedBy }: { requestedBy: string }) => {
      setUndoRequest({ requestedBy });
    });

    channel.bind("undo-accepted", ({ state }: { state: GameState }) => {
      setGameState(state);
      setUndoRequest(null);
      setSuggestion(null);
      if (!state.isGameOver && state.fen) computeSuggestion(state.fen);
    });

    channel.bind("undo-rejected", () => {
      setUndoRequest(null);
    });

    channel.bind("game-restarted", ({ state }: { state: GameState }) => {
      setGameState(state);
      setGameResult(null);
      setSuggestion(null);
      if (!state.isGameOver && state.fen) computeSuggestion(state.fen);
    });

    channel.bind("player-disconnected", ({ color }: { color: string }) => {
      setConnectionStatus(`${color}-disconnected`);
    });

    channel.bind("player-reconnected", () => {
      setConnectionStatus("connected");
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`game-${roomId}`);
      pusher.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  /** POST to /api/room/<endpoint> */
  const post = useCallback(async (endpoint: string, body: object) => {
    try {
      await fetch(`/api/room/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error(`[post ${endpoint}]`, err);
    }
  }, []);

  const makeMove = useCallback(
    (move: MoveInput) => {
      const state = gameStateRef.current;
      if (gameResult || state.isGameOver) return false;
      const isMyTurn = isPractice
        ? true
        : myColor !== "spectator" &&
          ((state.turn === "white" && myColor === "white") ||
            (state.turn === "black" && myColor === "black"));
      if (!isMyTurn) return false;
      void post("move", { roomId, move, playerName });
      setSuggestion(null);
      return true;
    },
    [roomId, playerName, myColor, isPractice, gameResult, post]
  );

  const getChess = useCallback(() => {
    const c = new Chess();
    const fen = gameStateRef.current.fen;
    if (fen && fen !== "start") {
      try { c.load(fen); } catch { /* keep default */ }
    }
    return c;
  }, []);

  const resign = useCallback(
    () => void post("action", { roomId, action: "resign", playerName }),
    [roomId, playerName, post]
  );
  const requestUndo = useCallback(
    () => void post("action", { roomId, action: "request-undo", playerName }),
    [roomId, playerName, post]
  );
  const acceptUndo = useCallback(() => {
    void post("action", { roomId, action: "accept-undo", playerName });
    setUndoRequest(null);
  }, [roomId, playerName, post]);
  const rejectUndo = useCallback(() => {
    void post("action", { roomId, action: "reject-undo", playerName });
    setUndoRequest(null);
  }, [roomId, playerName, post]);
  const restartGame = useCallback(
    () => void post("action", { roomId, action: "restart", playerName }),
    [roomId, playerName, post]
  );

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
