import Head from "next/head";
import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import Pusher from "pusher-js";
import RoomLobby from "../components/RoomLobby";
import Game from "../components/Game";
import type { Session } from "../types";

interface IncomingChallenge {
  roomId: string;
  fromName: string;
  fromEmail: string;
  opponentColor: "white" | "black";
  timeControl: number;
  expiresAt: number;
}

function personalChannel(email: string) {
  return `user-${email.replace(/[^a-zA-Z0-9]/g, "-")}`;
}

export default function HomePage() {
  const { data: authSession, status } = useSession();
  const router = useRouter();
  const [page, setPage] = useState<"lobby" | "game">("lobby");
  const [roomSession, setRoomSession] = useState<Session | null>(null);
  const [incomingChallenge, setIncomingChallenge] = useState<IncomingChallenge | null>(null);
  const [challengeCountdown, setChallengeCountdown] = useState(0);
  const [acceptingChallenge, setAcceptingChallenge] = useState(false);
  const pusherRef = useRef<InstanceType<typeof Pusher> | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      void router.replace("/login");
    }
  }, [status, router]);

  // Register user in Redis on login (so others can search them)
  useEffect(() => {
    if (status !== "authenticated" || !authSession?.user?.email) return;
    void fetch("/api/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: authSession.user.email,
        name: authSession.user.name ?? authSession.user.email,
      }),
    });
  }, [status, authSession]);

  // Subscribe to personal Pusher channel for incoming challenges
  useEffect(() => {
    if (status !== "authenticated" || !authSession?.user?.email) return;
    const email = authSession.user.email;
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
    pusherRef.current = pusher;

    const channel = pusher.subscribe(personalChannel(email));
    channel.bind("challenge-received", (data: IncomingChallenge) => {
      setIncomingChallenge(data);
      const secondsLeft = Math.max(0, Math.round((data.expiresAt - Date.now()) / 1000));
      setChallengeCountdown(secondsLeft);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(personalChannel(email));
      pusher.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, authSession?.user?.email]);

  // Countdown timer for incoming challenge
  useEffect(() => {
    if (!incomingChallenge) return;
    if (challengeCountdown <= 0) {
      setIncomingChallenge(null);
      return;
    }
    const t = setTimeout(() => setChallengeCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [incomingChallenge, challengeCountdown]);

  const handleAcceptChallenge = async () => {
    if (!incomingChallenge || !authSession?.user?.name) return;
    setAcceptingChallenge(true);
    try {
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: incomingChallenge.roomId,
          playerName: authSession.user.name,
          color: incomingChallenge.opponentColor,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setIncomingChallenge(null);
        handleRoomJoined({ ...data, playerName: authSession.user.name });
      }
    } catch {
      /* ignore */
    } finally {
      setAcceptingChallenge(false);
    }
  };

  const handleRoomJoined = (session: Session) => {
    setRoomSession(session);
    setPage("game");
  };

  const handleLeaveGame = () => {
    setPage("lobby");
    setRoomSession(null);
    void router.replace("/", undefined, { shallow: true });
  };

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading…</div>
      </div>
    );
  }

  const googleName = authSession?.user?.name ?? "";
  const googleEmail = authSession?.user?.email ?? "";
  const defaultRoomId = typeof router.query.room === "string" ? router.query.room.toUpperCase() : "";

  const timeLabel = (s: number) => {
    const m = Math.floor(s / 60);
    return m > 0 ? `${m} min` : `${s}s`;
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

        {/* Incoming challenge notification */}
        {incomingChallenge && page === "lobby" && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="card max-w-sm w-full space-y-4 animate-slide-up">
              <div className="flex items-center gap-3">
                <span className="text-3xl">⚔️</span>
                <div>
                  <p className="text-white font-bold text-lg">Challenge Received!</p>
                  <p className="text-gray-400 text-sm">
                    <span className="text-accent-blue font-semibold">{incomingChallenge.fromName}</span> challenges you
                  </p>
                </div>
              </div>
              <div className="bg-dark-600 rounded-lg px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-gray-400">Time control</span>
                <span className="text-white font-semibold">{timeLabel(incomingChallenge.timeControl)}</span>
              </div>
              <div className="bg-dark-600 rounded-lg px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-gray-400">Your color</span>
                <span className="font-semibold capitalize" style={{ color: incomingChallenge.opponentColor === "white" ? "#f4f4f4" : "#a0a0a0" }}>
                  {incomingChallenge.opponentColor === "white" ? "♔ White" : "♚ Black"}
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => void handleAcceptChallenge()}
                  disabled={acceptingChallenge}
                  className="flex-1 py-2.5 bg-accent-green/20 hover:bg-accent-green/30 text-accent-green rounded-lg text-sm font-semibold transition disabled:opacity-50"
                >
                  {acceptingChallenge ? "Joining…" : "✓ Accept"}
                </button>
                <button
                  onClick={() => setIncomingChallenge(null)}
                  className="flex-1 py-2.5 bg-accent-red/20 hover:bg-accent-red/30 text-accent-red rounded-lg text-sm font-semibold transition"
                >
                  ✕ Decline
                </button>
              </div>
              <p className="text-center text-xs text-gray-500">
                Expires in <span className="text-amber-400 font-mono">{challengeCountdown}s</span>
              </p>
            </div>
          </div>
        )}

        {page === "lobby" ? (
          <RoomLobby
            onRoomJoined={handleRoomJoined}
            defaultPlayerName={googleName}
            defaultRoomId={defaultRoomId}
            userEmail={googleEmail}
          />
        ) : roomSession ? (
          <Game session={roomSession} onLeave={handleLeaveGame} />
        ) : null}
      </div>
    </>
  );
}
