import { useEffect, useRef, useCallback } from "react";

export function useStockfishBrowser(enabled: boolean) {
  const workerRef = useRef<Worker | null>(null);
  const resolveRef = useRef<((move: string | null) => void) | null>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<{ fen: string; depth: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const worker = new Worker("/stockfish.js#/stockfish.wasm");

    worker.onmessage = (e: MessageEvent<string>) => {
      const msg: string = typeof e === "string" ? e : (e?.data ?? "");
      if (!msg) return;

      if (msg === "readyok") {
        readyRef.current = true;
        if (resolveRef.current && pendingRef.current) {
          worker.postMessage(`position fen ${pendingRef.current.fen}`);
          worker.postMessage(`go depth ${pendingRef.current.depth}`);
          pendingRef.current = null;
        }
        return;
      }

      if (msg.startsWith("bestmove")) {
        const parts = msg.trim().split(/\s+/);
        const move = parts[1] && parts[1] !== "(none)" ? parts[1] : null;
        if (resolveRef.current) {
          const res = resolveRef.current;
          resolveRef.current = null;
          res(move);
        }
      }
    };

    worker.onerror = (err: ErrorEvent) => {
      console.error("[Stockfish]", err.message);
      if (resolveRef.current) {
        const res = resolveRef.current;
        resolveRef.current = null;
        res(null);
      }
    };

    worker.postMessage("uci");
    worker.postMessage("isready");
    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
      readyRef.current = false;
      resolveRef.current = null;
      pendingRef.current = null;
    };
  }, [enabled]);

  const getBestMove = useCallback(
    (fen: string, depth = 10): Promise<string | null> => {
      return new Promise((resolve) => {
        const worker = workerRef.current;
        if (!worker) {
          resolve(null);
          return;
        }

        if (resolveRef.current) {
          resolveRef.current(null);
          resolveRef.current = null;
        }

        resolveRef.current = resolve;

        if (readyRef.current) {
          worker.postMessage("stop");
          worker.postMessage(`position fen ${fen}`);
          worker.postMessage(`go depth ${depth}`);
        } else {
          pendingRef.current = { fen, depth };
        }

        const captured = resolve;
        setTimeout(() => {
          if (resolveRef.current === captured) {
            worker.postMessage("stop");
            resolveRef.current = null;
            captured(null);
          }
        }, 10000);
      });
    },
    []
  );

  return { getBestMove };
}
