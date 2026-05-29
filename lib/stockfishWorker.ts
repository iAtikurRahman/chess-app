import { parentPort } from "worker_threads";
import path from "path";

// Resolve stockfish.asm.js from the installed stockfish package
// eslint-disable-next-line @typescript-eslint/no-require-imports
const stockfishPkg: string = require.resolve("stockfish/package.json");
const stockfishDir = path.dirname(stockfishPkg);
const stockfishPath = path.join(stockfishDir, "src", "stockfish.asm.js");

// Load the engine
// eslint-disable-next-line @typescript-eslint/no-require-imports
const stockfish = require(stockfishPath) as () => {
  onmessage: ((msg: string) => void) | null;
  postMessage: (msg: string) => void;
};

// Create engine instance
const engine = stockfish();

engine.onmessage = (msg: string) => {
  parentPort!.postMessage(msg);
};

parentPort!.on("message", (msg: string) => {
  engine.postMessage(msg);
});
