import Head from "next/head";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import RoomLobby from "../components/RoomLobby";
import Game from "../components/Game";
import type { Session } from "../types";

export default function HomePage() {
  const { data: authSession, status } = useSession();
  const router = useRouter();
  const [page, setPage] = useState<"lobby" | "game">("lobby");
  const [roomSession, setRoomSession] = useState<Session | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      void router.replace("/login");
    }
  }, [status, router]);

  const handleRoomJoined = (session: Session) => {
    setRoomSession(session);
    setPage("game");
  };

  const handleLeaveGame = () => {
    setPage("lobby");
    setRoomSession(null);
  };

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading…</div>
      </div>
    );
  }

  const googleName = authSession?.user?.name ?? "";

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
        {/* Top-right user info */}
        {page === "lobby" && (
          <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
            {authSession?.user?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={authSession.user.image}
                alt={googleName}
                className="w-8 h-8 rounded-full border border-dark-400"
              />
            )}
            <span className="text-sm text-gray-300 hidden sm:block">{googleName}</span>
            <button
              onClick={() => void signOut({ callbackUrl: "/login" })}
              className="text-xs text-gray-500 hover:text-gray-300 transition"
            >
              Sign out
            </button>
          </div>
        )}
        {page === "lobby" ? (
          <RoomLobby onRoomJoined={handleRoomJoined} defaultPlayerName={googleName} />
        ) : roomSession ? (
          <Game session={roomSession} onLeave={handleLeaveGame} />
        ) : null}
      </div>
    </>
  );
}
