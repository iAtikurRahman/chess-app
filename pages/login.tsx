import Head from "next/head";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect } from "react";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      void router.replace("/");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading…</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Sign In — Chess Arena ♟️</title>
      </Head>
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
        {/* Background grid */}
        <div
          className="fixed inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 62px,#fff 62px,#fff 63px), repeating-linear-gradient(90deg,transparent,transparent 62px,#fff 62px,#fff 63px)",
          }}
        />

        <div className="relative w-full max-w-sm animate-slide-up">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-3">♟️</div>
            <h1 className="text-4xl font-bold tracking-tight text-white">Chess Arena</h1>
            <p className="text-gray-400 mt-2">Real-time chess with AI suggestions</p>
          </div>

          {/* Card */}
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-white text-center">Sign in to play</h2>

            <button
              onClick={() => void signIn("google")}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-gray-100 text-gray-800 font-semibold rounded-lg transition"
            >
              {/* Google SVG */}
              <svg className="w-5 h-5" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.8 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.5 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.2 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8H6.3C9.5 39.5 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C37 39 44 34 44 24c0-1.3-.1-2.7-.4-3.9z" />
              </svg>
              Continue with Google
            </button>

            <p className="text-xs text-gray-600 text-center pt-1">
              Your Google display name will be used as your player name.
            </p>
          </div>

          <p className="text-center text-xs text-gray-600 mt-6">
            Two players · Stockfish AI hints · Real-time via Pusher
          </p>
        </div>
      </div>
    </>
  );
}
