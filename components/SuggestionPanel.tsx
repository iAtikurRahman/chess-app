import type { Suggestion } from "../types";

interface SuggestionPanelProps {
  suggestion: Suggestion | null;
  isMyTurn: boolean;
  isSpectator: boolean;
}

export default function SuggestionPanel({
  suggestion,
  isMyTurn,
  isSpectator,
}: SuggestionPanelProps) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🤖</span>
        <h3 className="font-semibold text-white text-sm">AI Suggestion</h3>
        <span className="text-xs text-gray-500">(Stockfish)</span>
      </div>

      {!suggestion ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
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
          Calculating…
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 uppercase tracking-wider">From</span>
              <span className="font-mono font-bold text-accent-green bg-accent-green/10 px-2 py-0.5 rounded text-base">
                {suggestion.from}
              </span>
            </div>
            <span className="text-gray-500">→</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 uppercase tracking-wider">To</span>
              <span className="font-mono font-bold text-accent-gold bg-accent-gold/10 px-2 py-0.5 rounded text-base">
                {suggestion.to}
              </span>
            </div>
            {suggestion.promotion && (
              <span className="text-xs text-gray-400">={suggestion.promotion.toUpperCase()}</span>
            )}
          </div>

          {isMyTurn && !isSpectator ? (
            <p className="text-xs text-gray-500">
              ↑ Highlighted on board. You can follow or ignore this suggestion.
            </p>
          ) : (
            <p className="text-xs text-gray-500">Waiting for your turn…</p>
          )}
        </div>
      )}
    </div>
  );
}
