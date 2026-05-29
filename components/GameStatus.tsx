import type { GameState, GameResult } from "../types";

interface GameStatusProps {
  gameState: GameState;
  gameResult: GameResult | null;
  myColor: string;
  waitingForOpponent: boolean;
  isPractice?: boolean;
}

export default function GameStatus({
  gameState,
  gameResult,
  myColor,
  waitingForOpponent,
  isPractice,
}: GameStatusProps) {
  const { isCheck, isCheckmate, isStalemate, isDraw, turn } = gameState;

  if (waitingForOpponent) {
    return (
      <div className="flex items-center justify-center gap-2 text-gray-400 text-sm animate-pulse2">
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Waiting for opponent to join…
      </div>
    );
  }

  if (gameResult) {
    let icon = "🏆";
    let text = "";
    let cls = "text-accent-gold";

    if (gameResult.winner === null) {
      icon = "🤝";
      text = gameResult.reason === "stalemate" ? "Draw by stalemate!" : "Draw!";
      cls = "text-gray-300";
    } else if (isPractice) {
      text = `${gameResult.winner === "white" ? "White" : "Black"} wins!`;
      if (gameResult.reason === "checkmate") text += " (Checkmate)";
    } else if (gameResult.winner === myColor) {
      text = "You win!";
      if (gameResult.reason === "checkmate") text += " (Checkmate)";
      else if (gameResult.reason === "resign") text += " (Opponent resigned)";
      else if (gameResult.reason === "timeout") text += " (Timeout)";
    } else {
      icon = "💀";
      text = "You lose.";
      if (gameResult.reason === "checkmate") text += " (Checkmate)";
      else if (gameResult.reason === "resign") text += " (You resigned)";
      else if (gameResult.reason === "timeout") text += " (Time out)";
      cls = "text-accent-red";
    }

    return (
      <div className={`flex items-center justify-center gap-2 font-bold text-base ${cls}`}>
        <span>{icon}</span>
        <span>{text}</span>
      </div>
    );
  }

  if (isCheckmate) {
    return (
      <div className="flex items-center justify-center gap-2 text-accent-gold font-bold">
        <span>♚</span> Checkmate!
      </div>
    );
  }

  if (isStalemate || isDraw) {
    return (
      <div className="flex items-center justify-center gap-2 text-gray-300 font-medium">
        🤝 {isStalemate ? "Stalemate" : "Draw"}
      </div>
    );
  }

  const isMyTurn = turn === myColor;

  return (
    <div className="flex items-center justify-center gap-2 text-sm">
      <span
        className={`w-2.5 h-2.5 rounded-full ${
          turn === "white" ? "bg-white" : "bg-gray-800 border border-gray-500"
        }`}
      />
      <span className={isCheck ? "text-accent-red font-bold" : "text-gray-300"}>
        {isCheck
          ? `${turn === "white" ? "White" : "Black"} is in check!`
          : isPractice
          ? `${turn === "white" ? "White" : "Black"}'s turn`
          : isMyTurn
          ? "Your turn"
          : `${turn === "white" ? "White" : "Black"}'s turn`}
      </span>
    </div>
  );
}
