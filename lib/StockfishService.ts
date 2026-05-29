import { Worker } from "worker_threads";
import path from "path";

class StockfishService {
  private _worker: Worker | null;
  private _ready: boolean;
  private _queue: { fen: string; depth: number } | null;
  private _resolve: ((move: string | null) => void) | null;

  constructor() {
    this._worker = null;
    this._ready = false;
    this._queue = null;
    this._resolve = null;
    this._initWorker();
  }

  private _initWorker(): void {
    const workerPath = path.join(__dirname, "stockfishWorker.ts");
    this._worker = new Worker(workerPath, {
      execArgv: ["--require", "tsx/cjs"],
    });
    this._ready = false;

    this._worker.on("message", (msg: string) => {
      if (msg === "readyok") {
        this._ready = true;
        if (this._queue) {
          const { fen, depth } = this._queue;
          this._queue = null;
          this._sendPosition(fen, depth);
        }
        return;
      }

      if (msg.startsWith("bestmove")) {
        const parts = msg.trim().split(/\s+/);
        const move = parts[1] && parts[1] !== "(none)" ? parts[1] : null;
        if (this._resolve) {
          const res = this._resolve;
          this._resolve = null;
          res(move);
        }
      }
    });

    this._worker.on("error", (err: Error) => {
      console.error("[StockfishWorker error]", err.message);
      if (this._resolve) {
        const res = this._resolve;
        this._resolve = null;
        res(null);
      }
    });

    this._worker.on("exit", (code: number) => {
      if (code !== 0) {
        console.warn(`[StockfishWorker] exited with code ${code}, restarting…`);
        setTimeout(() => this._initWorker(), 500);
      }
    });

    this._worker.postMessage("uci");
    this._worker.postMessage("setoption name Threads value 1");
    this._worker.postMessage("isready");
  }

  private _sendPosition(fen: string, depth: number): void {
    this._worker!.postMessage("stop");
    this._worker!.postMessage(`position fen ${fen}`);
    this._worker!.postMessage(`go depth ${depth}`);
  }

  getBestMove(fen: string, depth = 14): Promise<string | null> {
    return new Promise((resolve) => {
      if (this._resolve) {
        const old = this._resolve;
        this._resolve = null;
        old(null);
      }

      this._resolve = resolve;

      if (this._ready) {
        this._sendPosition(fen, depth);
      } else {
        this._queue = { fen, depth };
        this._worker!.postMessage("stop");
      }

      const captured = resolve;
      setTimeout(() => {
        if (this._resolve === captured) {
          this._worker!.postMessage("stop");
          this._resolve = null;
          captured(null);
        }
      }, 8000);
    });
  }
}

let _instance: StockfishService | null = null;

export function getStockfishService(): StockfishService {
  if (!_instance) _instance = new StockfishService();
  return _instance;
}
