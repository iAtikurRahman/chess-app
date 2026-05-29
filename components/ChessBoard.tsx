import { useState, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import type { Suggestion, MoveInput } from "../types";

interface ChessBoardProps {
  fen: string;
  orientation: "white" | "black";
  isMyTurn: boolean;
  suggestion: Suggestion | null;
  onMove: (move: MoveInput) => boolean | void;
  gameOver: boolean;
}

export default function ChessBoard({
  fen,
  orientation,
  isMyTurn,
  suggestion,
  onMove,
  gameOver,
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalSquares, setLegalSquares] = useState<string[]>([]);

  const getLegalSquares = useCallback(
    (square: string): string[] => {
      if (!fen || fen === "start") return [];
      try {
        const chess = new Chess();
        chess.load(fen);
        return chess.moves({ square: square as Parameters<Chess["moves"]>[0]["square"], verbose: true }).map((m) => m.to);
      } catch {
        return [];
      }
    },
    [fen]
  );

  const onSquareClick = useCallback(
    (square: string) => {
      if (!isMyTurn || gameOver) return;

      if (selectedSquare) {
        if (legalSquares.includes(square)) {
          onMove({ from: selectedSquare, to: square, promotion: "q" });
          setSelectedSquare(null);
          setLegalSquares([]);
          return;
        }
        setSelectedSquare(null);
        setLegalSquares([]);
      }

      const squares = getLegalSquares(square);
      if (squares.length > 0) {
        setSelectedSquare(square);
        setLegalSquares(squares);
      }
    },
    [isMyTurn, gameOver, selectedSquare, legalSquares, getLegalSquares, onMove]
  );

  const onPieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string): boolean => {
      if (!isMyTurn || gameOver) return false;
      setSelectedSquare(null);
      setLegalSquares([]);
      const success = onMove({ from: sourceSquare, to: targetSquare, promotion: "q" });
      return success !== false;
    },
    [isMyTurn, gameOver, onMove]
  );

  const onDragStart = useCallback(
    (_piece: string, sourceSquare: string): boolean => {
      if (!isMyTurn || gameOver) return false;
      const squares = getLegalSquares(sourceSquare);
      setSelectedSquare(sourceSquare);
      setLegalSquares(squares);
      return true;
    },
    [isMyTurn, gameOver, getLegalSquares]
  );

  const customSquareStyles: Record<string, React.CSSProperties> = {};

  if (selectedSquare) {
    customSquareStyles[selectedSquare] = { backgroundColor: "rgba(59, 130, 246, 0.35)" };
  }

  for (const sq of legalSquares) {
    customSquareStyles[sq] = {
      background: "radial-gradient(circle, rgba(59,130,246,0.55) 28%, transparent 28%)",
      cursor: "pointer",
    };
  }

  if (suggestion && !selectedSquare) {
    customSquareStyles[suggestion.from] = {
      backgroundColor: "rgba(34,197,94,0.40)",
      boxShadow: "inset 0 0 0 3px rgba(34,197,94,0.8)",
      borderRadius: "4px",
    };
    customSquareStyles[suggestion.to] = {
      backgroundColor: "rgba(245,158,11,0.35)",
      boxShadow: "inset 0 0 0 3px rgba(245,158,11,0.8)",
      borderRadius: "4px",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customArrows: any[] =
    suggestion && !selectedSquare ? [[suggestion.from, suggestion.to]] : [];

  return (
    <div className="board-shadow rounded-xl overflow-hidden w-full">
      <Chessboard
        id="main-board"
        position={fen === "start" ? "start" : fen}
        onPieceDrop={onPieceDrop}
        onPieceDragBegin={onDragStart}
        onSquareClick={onSquareClick}
        boardOrientation={orientation}
        arePiecesDraggable={isMyTurn && !gameOver}
        customSquareStyles={customSquareStyles}
        customArrows={customArrows}
        customArrowColor="rgba(34,197,94,0.75)"
        animationDuration={180}
        customBoardStyle={{ borderRadius: "8px", boxShadow: "none" }}
        customDarkSquareStyle={{ backgroundColor: "#4a7c59" }}
        customLightSquareStyle={{ backgroundColor: "#f0ead2" }}
      />
    </div>
  );
}
