import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import { setupSocketHandlers } from "./lib/socketHandlers";
import { config } from "dotenv";

// Load .env.local (then .env) so PORT is available before Next.js starts
config({ path: ".env.local" });
config(); // fallback to .env if present

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  setupSocketHandlers(io);

  httpServer.listen(port, () => {
    console.log(
      `> Chess Arena ready on http://localhost:${port} [${dev ? "dev" : "prod"}]`
    );
  });
});
