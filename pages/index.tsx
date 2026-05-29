import Head from "next/head";
import { useState } from "react";
import RoomLobby from "../components/RoomLobby";
import Game from "../components/Game";
import { socket } from "../lib/socket";
import type { Session } from "../types";

export default function HomePage() {
  const [page, setPage] = useState<"lobby" | "game">("lobby");
  const [roomSession, setRoomSession] = useState<Session | null>(null);

  const handleRoomJoined = (session: Session) => {
    setRoomSession(session);
    setPage("game");
  };

  const handleLeaveGame = () => {
    socket?.disconnect();
    setPage("lobby");
    setRoomSession(null);
  };

  return (
    <>
      <Head>
        <title>Chess Arena ♟️</title>
        <meta name="description" content="Real-time multiplayer chess with AI suggestions" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>♟️</text></svg>"
        />
      </Head>
      <div className="min-h-screen bg-dark-900">
        {page === "lobby" ? (
          <RoomLobby onRoomJoined={handleRoomJoined} />
        ) : roomSession ? (
          <Game session={roomSession} onLeave={handleLeaveGame} />
        ) : null}
      </div>
    </>
  );
}
